-- A null schedule denotes a new card. Existing FSRS state remains authoritative.
ALTER TABLE review_cards ADD COLUMN scheduled_at INTEGER GENERATED ALWAYS AS (
  CASE WHEN json_extract(fsrs_state, '$.state') <> 0 THEN due_at END
) VIRTUAL;

-- Each card is indexed once for All lists and once for its own list.
CREATE VIEW review_queue_word_scopes AS
  SELECT id AS word_id, 'learner:' || user_id AS scope_id, created_at, rowid AS word_order FROM words
  UNION ALL
  SELECT id, 'list:' || user_id || ':' || collection_id, created_at, rowid FROM words;

CREATE TABLE review_queue (
  card_id TEXT NOT NULL REFERENCES review_cards(id) ON DELETE CASCADE,
  scope_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  due_at INTEGER,
  created_at INTEGER NOT NULL,
  word_order INTEGER NOT NULL,
  due_hour INTEGER GENERATED ALWAYS AS (due_at - (due_at % 3600000 + 3600000) % 3600000) VIRTUAL,
  due_day INTEGER GENERATED ALWAYS AS (due_at - (due_at % 86400000 + 86400000) % 86400000) VIRTUAL,
  PRIMARY KEY (card_id, scope_id)
) WITHOUT ROWID;

INSERT INTO review_queue (card_id, scope_id, kind, due_at, created_at, word_order)
  SELECT card.id, scope.scope_id, card.kind, card.scheduled_at, scope.created_at, scope.word_order
  FROM review_cards card JOIN review_queue_word_scopes scope ON scope.word_id = card.word_id;

CREATE INDEX review_queue_schedule ON review_queue(scope_id, kind, due_at, created_at, word_order, card_id);

-- Completed days and hours are summed from counts. The current hour uses the exact schedule.
CREATE TABLE review_queue_counts (
  scope_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('new', 'day', 'hour')),
  starts_at INTEGER NOT NULL,
  total INTEGER NOT NULL CHECK (total >= 0),
  PRIMARY KEY (scope_id, kind, bucket, starts_at)
) WITHOUT ROWID;

INSERT INTO review_queue_counts (scope_id, kind, bucket, starts_at, total)
  SELECT scope_id, kind, bucket, starts_at, COUNT(*) FROM (
    SELECT scope_id, kind, 'new' AS bucket, 0 AS starts_at FROM review_queue WHERE due_at IS NULL
    UNION ALL SELECT scope_id, kind, 'day', due_day FROM review_queue WHERE due_at IS NOT NULL
    UNION ALL SELECT scope_id, kind, 'hour', due_hour FROM review_queue WHERE due_at IS NOT NULL
  ) GROUP BY scope_id, kind, bucket, starts_at;

CREATE VIEW review_queue_count_changes AS
  SELECT scope_id, kind, due_hour, due_day, 0 AS delta FROM review_queue WHERE 0;

CREATE TRIGGER review_queue_apply_count_change
INSTEAD OF INSERT ON review_queue_count_changes BEGIN
  INSERT INTO review_queue_counts (scope_id, kind, bucket, starts_at, total)
    SELECT NEW.scope_id, NEW.kind, change.bucket, change.starts_at, COALESCE(counts.total, 0) + NEW.delta
    FROM (
      SELECT 'new' AS bucket, 0 AS starts_at WHERE NEW.due_day IS NULL
      UNION ALL SELECT 'day', NEW.due_day WHERE NEW.due_day IS NOT NULL
      UNION ALL SELECT 'hour', NEW.due_hour WHERE NEW.due_hour IS NOT NULL
    ) change
    LEFT JOIN review_queue_counts counts ON counts.scope_id = NEW.scope_id AND counts.kind = NEW.kind
      AND counts.bucket = change.bucket AND counts.starts_at = change.starts_at
    WHERE true
    ON CONFLICT(scope_id, kind, bucket, starts_at) DO UPDATE SET total = excluded.total;
END;

CREATE TRIGGER review_queue_delete_empty_count
AFTER UPDATE OF total ON review_queue_counts WHEN NEW.total = 0 BEGIN
  DELETE FROM review_queue_counts WHERE scope_id = NEW.scope_id AND kind = NEW.kind
    AND bucket = NEW.bucket AND starts_at = NEW.starts_at;
END;

CREATE TRIGGER review_queue_count_insert
AFTER INSERT ON review_queue BEGIN
  INSERT INTO review_queue_count_changes VALUES (NEW.scope_id, NEW.kind, NEW.due_hour, NEW.due_day, 1);
END;

CREATE TRIGGER review_queue_count_delete
AFTER DELETE ON review_queue BEGIN
  INSERT INTO review_queue_count_changes VALUES (OLD.scope_id, OLD.kind, OLD.due_hour, OLD.due_day, -1);
END;

CREATE TRIGGER review_queue_count_update
AFTER UPDATE OF scope_id, due_at ON review_queue
WHEN OLD.scope_id <> NEW.scope_id OR OLD.due_hour IS NOT NEW.due_hour BEGIN
  INSERT INTO review_queue_count_changes VALUES (OLD.scope_id, OLD.kind, OLD.due_hour, OLD.due_day, -1);
  INSERT INTO review_queue_count_changes VALUES (NEW.scope_id, NEW.kind, NEW.due_hour, NEW.due_day, 1);
END;

CREATE TRIGGER review_queue_add_card
AFTER INSERT ON review_cards BEGIN
  INSERT INTO review_queue (card_id, scope_id, kind, due_at, created_at, word_order)
    SELECT NEW.id, scope_id, NEW.kind, NEW.scheduled_at, created_at, word_order
    FROM review_queue_word_scopes WHERE word_id = NEW.word_id;
END;

CREATE TRIGGER review_queue_reschedule_card
AFTER UPDATE OF fsrs_state ON review_cards WHEN OLD.scheduled_at IS NOT NEW.scheduled_at BEGIN
  UPDATE review_queue SET due_at = NEW.scheduled_at WHERE card_id = NEW.id;
END;

CREATE TRIGGER review_queue_move_word
AFTER UPDATE OF collection_id ON words WHEN OLD.collection_id <> NEW.collection_id BEGIN
  UPDATE review_queue SET scope_id = 'list:' || NEW.user_id || ':' || NEW.collection_id
    WHERE (card_id, scope_id) IN (
      SELECT id, 'list:' || OLD.user_id || ':' || OLD.collection_id FROM review_cards WHERE word_id = NEW.id
    );
END;
