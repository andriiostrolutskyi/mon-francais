import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import { State } from "ts-fsrs";
import { deserializeCard, scheduler, serializeCard } from "../learning/scheduler";
import { cardTypeSchema, gradeInputSchema, undoInputSchema } from "../shared/reviews";
import type { ReviewInput } from "../shared/reviews";
import { reviewState } from "./review-state";
import { studyDay } from "../learning/study-day";
import { getCollection, getLastReviewEvent, getUser } from "./store";
import { fail, jsonInput } from "./http";
import type { AppEnvironment } from "./types";

const conflict = "Your reviews changed in another tab. Refresh before continuing.";

async function reviewSaved(db: D1Database, userId: string, data: ReviewInput) {
  const event = await db.prepare("SELECT card_id, rating, applied_revision, reverses_id FROM review_events WHERE id = ? AND user_id = ?")
    .bind(data.operationId, userId).first<{ card_id: string; rating: number | null; applied_revision: number; reverses_id: string | null }>();
  if (!event) return false;
  const matches = "cardId" in data
    ? event.reverses_id === null && event.card_id === data.cardId && event.rating === data.rating && event.applied_revision === data.revision + 1
    : event.reverses_id === data.eventId;
  if (!matches) fail(409, "This review request changed. Refresh before continuing.");
  return true;
}
export const reviewRoutes = new Hono<AppEnvironment>();
reviewRoutes.get("/queue", async (context) => {
  const kind = cardTypeSchema.optional().safeParse(context.req.query("kind"));
  if (!kind.success) fail(400, "Choose a valid card type.");
  const db = context.env.DB;
  const userId = context.get("learnerId");
  const collectionId = context.req.query("collectionId");
  if (collectionId !== undefined) await getCollection(db, userId, collectionId);
  return context.json(await reviewState(db, userId, kind.data, collectionId));
});
reviewRoutes.on("POST", ["/grade", "/undo"], async (context) => {
  const data = context.req.path.endsWith("/grade")
    ? await jsonInput(context, gradeInputSchema) : await jsonInput(context, undoInputSchema);
  const isGrade = "cardId" in data;
  const db = context.env.DB;
  const userId = context.get("learnerId");
  const now = new Date();
  if (await reviewSaved(db, userId, data)) return context.json({ saved: true, eventId: data.operationId });
  const user = await getUser(db, userId);
  const lastEvent = isGrade ? null : await getLastReviewEvent(db, userId);
  const cardId = isGrade ? data.cardId : lastEvent?.card_id;
  if (!cardId) fail(409, conflict);
  const card = await db.prepare(`SELECT cards.id, cards.revision, cards.fsrs_state, cards.due_at
    FROM review_cards cards JOIN words ON words.id = cards.word_id
    WHERE cards.id = ? AND words.user_id = ?`).bind(cardId, userId)
    .first<{ id: string; revision: number; fsrs_state: string; due_at: number }>();
  const day = studyDay(now, user.timezone);
  if (!card) fail(409, conflict);
  let nextState: string;
  if (isGrade) {
    if (card.revision !== data.revision) fail(409, conflict);
    const memory = deserializeCard(card.fsrs_state);
    if (memory.state !== State.New && card.due_at > now.getTime()) fail(409, conflict);
    const result = scheduler.next(memory, now, data.rating);
    nextState = serializeCard(result.card);
  } else {
    if (!lastEvent?.previous_state || lastEvent.id !== data.eventId || card.revision !== lastEvent.applied_revision) fail(409, conflict);
    nextState = lastEvent.previous_state;
  }
  const sequence = user.review_revision + 1;
  const results = await db.batch([
    db.prepare(`INSERT INTO review_events (id, user_id, card_id, sequence, rating,
      study_day, previous_state, applied_revision, reverses_id)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND review_revision = ?)
      AND EXISTS (SELECT 1 FROM review_cards WHERE id = ? AND revision = ?)
      ON CONFLICT DO NOTHING`)
      .bind(data.operationId, userId, card.id, sequence, isGrade ? data.rating : null, isGrade ? day : null,
        isGrade ? card.fsrs_state : null, card.revision + 1, isGrade ? null : data.eventId, userId, user.review_revision, card.id, card.revision),
    db.prepare("UPDATE review_cards SET fsrs_state = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND changes() > 0")
      .bind(nextState, card.id, card.revision),
    db.prepare("UPDATE users SET review_revision = review_revision + 1 WHERE id = ? AND review_revision = ? AND changes() > 0")
      .bind(userId, user.review_revision),
  ]);
  if (!results[0].meta.changes && !await reviewSaved(db, userId, data)) fail(409, conflict);
  return context.json({ saved: true, eventId: data.operationId });
});
