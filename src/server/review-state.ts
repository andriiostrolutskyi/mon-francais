import type { D1Database } from "@cloudflare/workers-types";
import { deserializeCard, intervals } from "../learning/scheduler";
import { studyDay } from "../learning/study-day";
import { cardTypes } from "../shared/reviews";
import type { CardType, ReviewQueue } from "../shared/reviews";
import { getUser, vocabularyItem } from "./store";
import type { ReviewCardRow } from "./store";

const hourMs = 3_600_000;
const dayMs = 24 * hourMs;
const kinds = `WITH kinds AS (SELECT key AS priority, value AS kind FROM json_each(?2))`;
const queueFilter = "scope_id = ?1 AND kind = kinds.kind";
const queueOrder = "due_at, created_at, word_order, card_id";

export async function reviewState(db: D1Database, userId: string, kind?: CardType, collectionId?: string): Promise<ReviewQueue> {
  const now = new Date();
  const user = await getUser(db, userId);
  const day = studyDay(now, user.timezone);
  const scopeId = collectionId === undefined ? `learner:${userId}` : `list:${userId}:${collectionId}`;
  const selectedKinds = JSON.stringify(kind ? [kind] : cardTypes);
  const timestamp = now.getTime();
  // Scheduling buckets use UTC. Review history uses the learner's study day.
  const startOfDay = Math.floor(timestamp / dayMs) * dayMs;
  const startOfHour = Math.floor(timestamp / hourMs) * hourMs;
  const [counts, completed, selected, undo] = await db.batch<Record<string, unknown>>([
    db.prepare(`${kinds} SELECT
      COALESCE(SUM((SELECT total FROM review_queue_counts WHERE ${queueFilter} AND bucket = 'new' AND starts_at = 0)), 0) AS newCards,
      SUM(
        (SELECT COALESCE(SUM(total), 0) FROM review_queue_counts WHERE ${queueFilter} AND bucket = 'day' AND starts_at < ?4)
        + (SELECT COALESCE(SUM(total), 0) FROM review_queue_counts WHERE ${queueFilter} AND bucket = 'hour'
          AND starts_at >= ?4 AND starts_at < ?5)
        + (SELECT COUNT(*) FROM review_queue INDEXED BY review_queue_schedule WHERE ${queueFilter} AND due_at BETWEEN ?5 AND ?3)
      ) AS due,
      MIN((SELECT due_at FROM review_queue INDEXED BY review_queue_schedule WHERE ${queueFilter}
        AND due_at > ?3 ORDER BY due_at LIMIT 1)) AS nextDueAt
      FROM kinds`).bind(scopeId, selectedKinds, timestamp, startOfDay, startOfHour),
    db.prepare(`SELECT COUNT(*) AS count FROM review_events ev INDEXED BY review_events_day
      CROSS JOIN review_queue queue
      WHERE ev.user_id = ?2 AND ev.study_day = ?4 AND ev.reverses_id IS NULL
      AND queue.card_id = ev.card_id AND queue.scope_id = ?1
      AND (?3 IS NULL OR queue.kind = ?3)
      AND NOT EXISTS (SELECT 1 FROM review_events undo WHERE undo.reverses_id = ev.id)`)
      .bind(scopeId, userId, kind ?? null, day),
    db.prepare(`${kinds}, due_candidates AS (
        SELECT (SELECT card_id FROM review_queue INDEXED BY review_queue_schedule WHERE ${queueFilter}
          AND due_at IS NOT NULL AND due_at <= ?3 ORDER BY ${queueOrder} LIMIT 1) AS id FROM kinds
      ), new_candidates AS (
        SELECT priority, (SELECT card_id FROM review_queue INDEXED BY review_queue_schedule WHERE ${queueFilter}
          AND due_at IS NULL ORDER BY ${queueOrder} LIMIT 1) AS id FROM kinds
      ), next_card AS (
        SELECT COALESCE(
          (SELECT queue.card_id FROM due_candidates candidate CROSS JOIN review_queue queue
            WHERE queue.card_id = candidate.id AND queue.scope_id = ?1
            ORDER BY ${queueOrder} LIMIT 1),
          (SELECT id FROM new_candidates WHERE id IS NOT NULL ORDER BY priority LIMIT 1)
        ) AS id
      )
      SELECT cards.id, cards.word_id, cards.kind, cards.revision, cards.fsrs_state, words.collection_id, words.content
      FROM next_card CROSS JOIN review_cards cards ON cards.id = next_card.id
      CROSS JOIN words ON words.id = cards.word_id`)
      .bind(scopeId, selectedKinds, timestamp),
    db.prepare(`SELECT ev.id FROM review_events ev
      CROSS JOIN review_queue queue ON queue.card_id = ev.card_id AND queue.scope_id = ?1
      CROSS JOIN review_cards cards ON cards.id = ev.card_id AND cards.revision = ev.applied_revision
      WHERE ev.user_id = ?2 AND ev.sequence = (SELECT MAX(sequence) FROM review_events WHERE user_id = ?2)
      AND ev.reverses_id IS NULL AND (?3 IS NULL OR queue.kind = ?3)`)
      .bind(scopeId, userId, kind ?? null),
  ]);
  const summary = counts.results[0] as { newCards: number; due: number; nextDueAt: number | null };
  const next = selected.results[0] as ReviewCardRow | undefined;
  return {
    timezone: user.timezone, counts: { due: summary.due, new: summary.newCards, completed: completed.results[0].count as number },
    nextDueAt: summary.nextDueAt, undo: undo.results[0] ? { eventId: undo.results[0].id as string } : null,
    card: next ? { id: next.id, kind: next.kind, revision: next.revision,
      content: vocabularyItem({ id: next.word_id, collection_id: next.collection_id, content: next.content }),
      intervals: intervals(deserializeCard(next.fsrs_state), now) } : null,
  };
}
