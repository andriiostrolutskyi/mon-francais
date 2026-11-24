import type { D1Database } from "@cloudflare/workers-types";
import { State } from "ts-fsrs";
import type { ReadingSelection } from "../shared/learning";
import { readingTargetLimit } from "../shared/learning";
import { readingTarget } from "./store";
import type { WordRow } from "./store";

const readingGap = 7 * 86400000;

export async function getReadingSelection(db: D1Database, userId: string): Promise<ReadingSelection> {
  const { results } = await db.prepare(`WITH recent_words AS (
      SELECT json_extract(occurrence.value, '$.wordId') AS word_id
      FROM readings, json_each(readings.occurrences) occurrence
      WHERE readings.user_id = ? AND readings.created_at > ?
    )
    SELECT words.*,
      NULLIF(MIN(CASE WHEN json_extract(cards.fsrs_state, '$.state') = ${State.New} THEN 0
        ELSE json_extract(cards.fsrs_state, '$.stability') END), 0) AS stability FROM words
    JOIN review_cards cards ON cards.word_id = words.id
    WHERE words.user_id = ? AND words.id NOT IN (SELECT word_id FROM recent_words WHERE word_id IS NOT NULL)
    GROUP BY words.id
    ORDER BY COALESCE(stability, 0), words.created_at, words.rowid, words.id
    LIMIT ?`).bind(userId, Date.now() - readingGap, userId, readingTargetLimit)
    .all<WordRow & { stability: number | null }>();
  return { words: results.map((row) => ({ ...readingTarget(row), stability: row.stability })) };
}
