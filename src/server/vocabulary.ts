import { Hono } from "hono";
import type { D1PreparedStatement } from "@cloudflare/workers-types";
import { generateJson } from "../ai/provider";
import { vocabularyPrompt } from "../ai/prompts";
import { createEmptyCard, State } from "ts-fsrs";
import { serializeCard } from "../learning/scheduler";
import { vocabularyGenerationSchema, vocabularyOutputSchema } from "../shared/learning";
import type { VocabularyResult } from "../shared/learning";
import { cardTypes } from "../shared/reviews";
import { normalizeTextKey, vocabularyEntryKey, vocabularyPageSize, vocabularySearchText, vocabularyUpdateSchema } from "../shared/vocabulary";
import { generateOnce } from "./generation";
import { fail, jsonInput } from "./http";
import { getCollection, vocabularyItem } from "./store";
import type { WordRow } from "./store";
import type { AppEnvironment } from "./types";

export const vocabularyRoutes = new Hono<AppEnvironment>();
vocabularyRoutes.get("/", async (context) => {
  const db = context.env.DB;
  const userId = context.get("learnerId");
  const collectionId = context.req.query("collectionId");
  if (collectionId !== undefined) await getCollection(db, userId, collectionId);
  const needle = normalizeTextKey(context.req.query("q") ?? "");
  const filter = "(? IS NULL OR collection_id = ?) AND instr(search_text, ?) > 0";
  const filters = [collectionId ?? null, collectionId ?? null, needle];
  const counts = await db.prepare(`SELECT COUNT(*) AS totalWords,
    COUNT(CASE WHEN ${filter} THEN 1 END) AS filteredCount FROM words WHERE user_id = ?`)
    .bind(...filters, userId).first<{ totalWords: number; filteredCount: number }>();
  const requestedPage = Number(context.req.query("page") ?? 0);
  const page = Math.min(Number.isFinite(requestedPage) ? Math.max(0, Math.trunc(requestedPage)) : 0,
    Math.max(0, Math.ceil(counts!.filteredCount / vocabularyPageSize) - 1));
  const { results } = await db.prepare(`SELECT words.*,
    NULLIF(MIN(CASE WHEN json_extract(cards.fsrs_state, '$.state') = ${State.New} THEN 0
      ELSE json_extract(cards.fsrs_state, '$.stability') END), 0) AS stability FROM words
    JOIN review_cards cards ON cards.word_id = words.id
    WHERE words.user_id = ? AND ${filter}
    GROUP BY words.id
    ORDER BY words.created_at DESC, words.id LIMIT ? OFFSET ?`)
    .bind(userId, ...filters, vocabularyPageSize, page * vocabularyPageSize).all<WordRow & { stability: number | null }>();
  return context.json({ items: results.map((row) => ({ ...vocabularyItem(row), stability: row.stability })), ...counts, page });
});
vocabularyRoutes.post("/", async (context) => {
  const { operationId, word, collectionId } = await jsonInput(context, vocabularyGenerationSchema);
  const db = context.env.DB;
  const userId = context.get("learnerId");
  await getCollection(db, userId, collectionId);
  const output = await generateOnce(db, userId, "vocabulary", operationId, { word, collectionId }, async () => {
    const generated = await generateJson(context.env, vocabularyOutputSchema, vocabularyPrompt, { word });
    const { results: savedWords } = await db.prepare(`SELECT entry_key FROM words WHERE user_id = ? AND collection_id = ?
      AND entry_key IN (SELECT value FROM json_each(?))`)
      .bind(userId, collectionId, JSON.stringify(generated.entries.map(vocabularyEntryKey))).all<{ entry_key: string }>();
    const existing = new Set(savedWords.map((row) => row.entry_key));
    const statements: D1PreparedStatement[] = [];
    const entries = new Set<string>();
    const notes = generated.note ? [generated.note] : [];
    const now = new Date();
    const timestamp = now.getTime();
    const state = serializeCard(createEmptyCard(now));
    for (const content of generated.entries) {
      const key = vocabularyEntryKey(content);
      if (entries.has(key)) continue;
      entries.add(key);
      if (existing.has(key)) {
        notes.push(`Already saved: ${content.french} — ${content.english}.`);
        continue;
      }
      const id = crypto.randomUUID();
      statements.push(
        db.prepare("INSERT INTO words (id, user_id, collection_id, entry_key, search_text, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(id, userId, collectionId, key, vocabularySearchText(content), JSON.stringify(content), timestamp),
        ...cardTypes.map((kind) => db.prepare("INSERT INTO review_cards (id, word_id, kind, fsrs_state) VALUES (?, ?, ?, ?)")
          .bind(crypto.randomUUID(), id, kind, state)),
      );
    }
    const output: VocabularyResult = { count: entries.size, note: notes.join(" ") };
    return { output, statements };
  });
  return context.json(output, 201);
});
vocabularyRoutes.patch("/:id", async (context) => {
  const { collectionId, ...content } = await jsonInput(context, vocabularyUpdateSchema);
  const db = context.env.DB;
  const userId = context.get("learnerId");
  const id = context.req.param("id");
  await getCollection(db, userId, collectionId);
  const key = vocabularyEntryKey(content);
  const duplicate = await db.prepare("SELECT id FROM words WHERE collection_id = ? AND entry_key = ? AND id <> ?")
    .bind(collectionId, key, id).first();
  if (duplicate) fail(409, "This meaning is already saved in this list.");
  const results = await db.batch([
    db.prepare("UPDATE words SET collection_id = ?, content = ?, entry_key = ?, search_text = ? WHERE id = ? AND user_id = ?")
      .bind(collectionId, JSON.stringify(content), key, vocabularySearchText(content), id, userId),
    db.prepare("UPDATE review_cards SET revision = revision + 1 WHERE word_id = ? AND word_id IN (SELECT id FROM words WHERE user_id = ?)")
      .bind(id, userId),
    db.prepare("UPDATE users SET review_revision = review_revision + 1 WHERE id = ? AND EXISTS (SELECT 1 FROM words WHERE id = ? AND user_id = ?)")
      .bind(userId, id, userId),
  ]);
  if (!results[0].meta.changes) fail(404, "This word has been removed.");
  return context.json({ saved: true });
});
vocabularyRoutes.delete("/:id", async (context) => {
  const db = context.env.DB;
  const userId = context.get("learnerId");
  await db.batch([
    db.prepare("DELETE FROM words WHERE id = ? AND user_id = ?").bind(context.req.param("id"), userId),
    db.prepare("UPDATE users SET review_revision = review_revision + 1 WHERE id = ? AND changes() > 0").bind(userId),
  ]);
  return context.json({ removed: true });
});
