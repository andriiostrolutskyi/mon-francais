import { Hono } from "hono";
import { generateJson } from "../ai/provider";
import { feedbackPrompt, readingPrompt } from "../ai/prompts";
import { studyDay } from "../learning/study-day";
import { feedbackSchema, readingResponseSchema, readingContentSchema, readingActivitySchema, readingGenerationSchema, readingTitleSchema } from "../shared/learning";
import type { ReadingSummary, ReadingTarget } from "../shared/learning";
import { frenchWithArticle } from "../shared/vocabulary";
import { generateOnce } from "./generation";
import { fail, jsonInput } from "./http";
import { getReadingSelection } from "./reading-selection";
import { parseReadingAnnotations } from "./reading-annotations";
import { getReading, getUser, readingTarget } from "./store";
import type { WordRow } from "./store";
import type { AppEnvironment } from "./types";

export const readingRoutes = new Hono<AppEnvironment>();
readingRoutes.get("/reading-selection", async (context) =>
  context.json(await getReadingSelection(context.env.DB, context.get("learnerId"))));
readingRoutes.get("/readings", async (context) => {
  const db = context.env.DB;
  const userId = context.get("learnerId");
  const { results } = await db.prepare(`SELECT id, json_extract(content, '$.title') AS title
    FROM readings WHERE user_id = ? ORDER BY created_at DESC, id DESC`).bind(userId).all<ReadingSummary>();
  return context.json({ readings: results });
});
readingRoutes.get("/readings/:id", async (context) => context.json(await getReading(context.env.DB, context.get("learnerId"), context.req.param("id"))));
readingRoutes.patch("/readings/:id", async (context) => {
  const { title } = await jsonInput(context, readingTitleSchema);
  const reading = await context.env.DB.prepare(`UPDATE readings SET content = json_set(content, '$.title', ?)
    WHERE id = ? AND user_id = ? RETURNING id, json_extract(content, '$.title') AS title`)
    .bind(title, context.req.param("id"), context.get("learnerId")).first<ReadingSummary>();
  if (!reading) fail(404, "This reading has been removed.");
  return context.json(reading);
});
readingRoutes.delete("/readings/:id", async (context) => {
  await context.env.DB.prepare("DELETE FROM readings WHERE id = ? AND user_id = ?")
    .bind(context.req.param("id"), context.get("learnerId")).run();
  return context.json({ removed: true });
});
readingRoutes.post("/readings/generate", async (context) => {
  const { operationId, ...input } = await jsonInput(context, readingGenerationSchema);
  const { wordIds, ...settings } = input;
  const db = context.env.DB;
  const userId = context.get("learnerId");
  await generateOnce(db, userId, "reading", operationId, input, async () => {
    const user = await getUser(db, userId);
    const { results } = await db.prepare(`SELECT words.* FROM json_each(?) selected
      JOIN words ON words.id = selected.value WHERE words.user_id = ? ORDER BY CAST(selected.key AS INTEGER)`)
      .bind(JSON.stringify(wordIds), userId).all<WordRow>();
    if (results.length !== wordIds.length) fail(409, "A selected meaning has been removed. Remove it from your selection and try again.");
    const targets = results.map(readingTarget);
    const vocabulary = new Map<string, ReadingTarget>(targets.map((word, index) => [String(index + 1), word]));
    const content = await generateJson(context.env, readingContentSchema, readingPrompt, {
      ...settings,
      vocabulary: [...vocabulary].map(([ref, word]) => ({
        ref, french: frenchWithArticle(word), english: word.english, definition: word.definition,
      })),
    });
    const { text, occurrences } = parseReadingAnnotations(content.text, vocabulary);
    content.text = text;
    for (const question of content.questions) {
      const order = question.options.map((_, index) => index);
      for (let index = order.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [order[index], order[other]] = [order[other], order[index]];
      }
      question.options = order.map((index) => question.options[index]);
      question.answer = order.indexOf(question.answer);
    }
    const used = new Set(occurrences.map((occurrence) => occurrence.wordId));
    const now = new Date();
    return { output: { saved: true }, statements: [
      db.prepare("INSERT INTO readings (id, user_id, study_day, level, format, content, targets, occurrences, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(operationId, userId, studyDay(now, user.timezone), settings.level, settings.format, JSON.stringify(content), JSON.stringify(targets.filter((word) => used.has(word.id))), JSON.stringify(occurrences), now.getTime()),
    ] };
  });
  return context.json(await getReading(db, userId, operationId), 201);
});
readingRoutes.post("/readings/:id/activity", async (context) => {
  const data = await jsonInput(context, readingActivitySchema);
  const db = context.env.DB;
  const userId = context.get("learnerId");
  const id = context.req.param("id");
  const user = await getUser(db, userId);
  const day = studyDay(new Date(), user.timezone);
  let result;
  if (data.kind === "completed") {
    result = await db.prepare("UPDATE readings SET completed_day = COALESCE(completed_day, ?) WHERE id = ? AND user_id = ?")
      .bind(day, id, userId).run();
  } else {
    result = await db.prepare(`UPDATE readings SET
      quiz_day = COALESCE(quiz_day, ?),
      answers = ? WHERE id = ? AND user_id = ?`)
      .bind(day, JSON.stringify(data.answers), id, userId).run();
  }
  if (!result.meta.changes) fail(404, "This reading has been removed.");
  return context.json(await getReading(db, userId, id));
});
readingRoutes.post("/readings/:id/output", async (context) => {
  const data = await jsonInput(context, readingResponseSchema);
  const db = context.env.DB;
  const userId = context.get("learnerId");
  const reading = await getReading(db, userId, context.req.param("id"));
  const user = await getUser(db, userId);
  const day = studyDay(new Date(), user.timezone);
  const save = db.prepare(`UPDATE readings SET feedback = CASE WHEN response = ? THEN feedback ELSE NULL END,
    response = ?, response_day = COALESCE(response_day, ?) WHERE id = ? AND user_id = ?`)
    .bind(data.response, data.response, day, reading.id, userId);
  if (data.feedback) {
    await generateOnce(db, userId, "feedback", data.operationId, { readingId: reading.id, response: data.response }, async () => {
      await save.run();
      const feedback = await generateJson(context.env, feedbackSchema, feedbackPrompt, {
        level: reading.level, text: reading.content.text, task: reading.content.outputPrompt, response: data.response,
      });
      return { output: { saved: true }, statements: [
        db.prepare("UPDATE readings SET feedback = ? WHERE id = ? AND user_id = ? AND response = ?")
          .bind(JSON.stringify(feedback), reading.id, userId, data.response),
      ] };
    });
  } else await save.run();
  return context.json(await getReading(db, userId, reading.id));
});
