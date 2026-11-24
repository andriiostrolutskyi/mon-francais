import type { D1Database } from "@cloudflare/workers-types";
import type { Collection, VocabularyInput, VocabularyItem } from "../shared/vocabulary";
import type { Feedback, Learner, Reading, ReadingContent, ReadingOccurrence, ReadingTarget } from "../shared/learning";
import type { CardType } from "../shared/reviews";
import { fail } from "./http";

type UserRow = Learner & { review_revision: number };
export type WordRow = { id: string; user_id: string; collection_id: string; content: string; created_at: number };
export type ReviewCardRow = Pick<WordRow, "collection_id" | "content"> & {
  id: string; word_id: string; kind: CardType; fsrs_state: string; revision: number;
};

async function findUser(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}
export async function ensureUser(db: D1Database, { id, name, timezone }: Learner) {
  if (await findUser(db, id)) return;
  await db.prepare("INSERT INTO users (id, name, timezone) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(id, name, timezone).run();
}
export async function getUser(db: D1Database, id: string) {
  const user = await findUser(db, id);
  if (!user) fail(404, "This learner profile has been removed.");
  return user;
}
export async function getCollection(db: D1Database, userId: string, id: string) {
  const collection = await db.prepare("SELECT id, name FROM collections WHERE id = ? AND user_id = ?")
    .bind(id, userId).first<Collection>();
  if (!collection) fail(404, "This list has been removed. Choose another list.");
  return collection;
}
export async function getWord(db: D1Database, userId: string, id: string) {
  const row = await db.prepare("SELECT * FROM words WHERE user_id = ? AND id = ?").bind(userId, id).first<WordRow>();
  if (!row) fail(404, "This word has been removed.");
  return vocabularyItem(row);
}
export function vocabularyItem(row: Pick<WordRow, "id" | "collection_id" | "content">): VocabularyItem {
  return { ...(JSON.parse(row.content) as VocabularyInput), id: row.id, collectionId: row.collection_id };
}
export function readingTarget(row: WordRow): ReadingTarget {
  const { id, french, article, english, definition, gender } = vocabularyItem(row);
  return { id, french, article, english, definition, gender };
}

export function getLastReviewEvent(db: D1Database, userId: string) {
  return db.prepare("SELECT id, card_id, previous_state, applied_revision FROM review_events WHERE user_id = ? ORDER BY sequence DESC LIMIT 1")
    .bind(userId).first<{ id: string; card_id: string; previous_state: string | null; applied_revision: number }>();
}

type ReadingRow = Pick<Reading, "id" | "level" | "format"> & { study_day: string; content: string; targets: string; occurrences: string;
  completed_day: string | null; answers: string | null; response: string; feedback: string | null };
export async function getReading(db: D1Database, userId: string, id: string): Promise<Reading> {
  const row = await db.prepare("SELECT * FROM readings WHERE id = ? AND user_id = ?").bind(id, userId).first<ReadingRow>();
  if (!row) fail(404, "This reading has been removed.");
  const content = JSON.parse(row.content) as ReadingContent;
  const answers = row.answers === null ? null : JSON.parse(row.answers) as number[];
  return {
    id: row.id, studyDay: row.study_day, level: row.level, format: row.format, content,
    targets: JSON.parse(row.targets) as ReadingTarget[], occurrences: JSON.parse(row.occurrences) as ReadingOccurrence[],
    completed: Boolean(row.completed_day), response: row.response,
    feedback: row.feedback === null ? null : JSON.parse(row.feedback) as Feedback,
    comprehension: answers === null ? null : {
      answers, total: content.questions.length,
      correct: content.questions.filter((question, index) => answers[index] === question.answer).length,
    },
  };
}
