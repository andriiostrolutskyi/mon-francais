-- Development reset: discard incompatible records instead of converting them.
-- This is also the complete schema for a fresh database.
DROP TABLE IF EXISTS review_events;
DROP TABLE IF EXISTS review_cards;
DROP TABLE IF EXISTS words;
DROP TABLE IF EXISTS collections;
DROP TABLE IF EXISTS reading_quiz_days;
DROP TABLE IF EXISTS readings;
DROP TABLE IF EXISTS generation_requests;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  review_revision INTEGER NOT NULL DEFAULT 0 CHECK (review_revision >= 0)
);

CREATE TABLE collections (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  name_key TEXT NOT NULL CHECK (length(name_key) > 0),
  UNIQUE (user_id, name_key),
  UNIQUE (id, user_id)
);

-- The owner key lets queries scope words directly; the composite foreign key
-- guarantees that it always agrees with the list owner.
-- Normalized keys are written with content because SQLite does not normalize Unicode.
CREATE TABLE words (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  collection_id TEXT NOT NULL,
  entry_key TEXT NOT NULL CHECK (length(entry_key) > 0),
  search_text TEXT NOT NULL CHECK (length(search_text) > 0),
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  created_at INTEGER NOT NULL,
  UNIQUE (collection_id, entry_key),
  FOREIGN KEY (collection_id, user_id) REFERENCES collections(id, user_id) ON DELETE CASCADE
);
CREATE INDEX words_owner ON words(user_id, created_at DESC, id);
CREATE INDEX words_collection ON words(user_id, collection_id, created_at DESC, id);

-- FSRS dates are Unix milliseconds. due_at is a query projection, never a second write.
CREATE TABLE review_cards (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('recognition', 'production', 'cloze', 'listening')),
  fsrs_state TEXT NOT NULL CHECK (json_valid(fsrs_state) AND json_type(fsrs_state) = 'object'
    AND json_type(fsrs_state, '$.due') IS 'integer'
    AND json_type(fsrs_state, '$.state') IS 'integer'
    AND json_extract(fsrs_state, '$.state') BETWEEN 0 AND 3),
  due_at INTEGER GENERATED ALWAYS AS (json_extract(fsrs_state, '$.due')) VIRTUAL NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  UNIQUE (word_id, kind)
);

-- Grades retain only what progress, retry detection, and undo need.
-- An undo references its grade; it does not duplicate the schedule or study day.
CREATE TABLE review_events (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  card_id TEXT NOT NULL REFERENCES review_cards(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  rating INTEGER CHECK (rating BETWEEN 1 AND 4),
  study_day TEXT,
  previous_state TEXT CHECK (previous_state IS NULL OR (json_valid(previous_state) AND json_type(previous_state) = 'object')),
  applied_revision INTEGER NOT NULL CHECK (applied_revision > 0),
  reverses_id TEXT UNIQUE REFERENCES review_events(id) ON DELETE CASCADE,
  UNIQUE (user_id, sequence),
  CHECK ((reverses_id IS NULL AND rating IS NOT NULL AND study_day IS NOT NULL AND previous_state IS NOT NULL)
    OR (reverses_id IS NOT NULL AND rating IS NULL AND study_day IS NULL AND previous_state IS NULL)),
  CHECK (reverses_id IS NULL OR reverses_id <> id)
);
CREATE INDEX review_events_day ON review_events(user_id, study_day);
CREATE INDEX review_events_card ON review_events(card_id);

-- Request receipts make retries idempotent. Outputs contain small acknowledgements,
-- not copies of vocabulary, reading content, or feedback.
CREATE TABLE generation_requests (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('vocabulary', 'reading', 'feedback')),
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'failed')),
  input_hash TEXT NOT NULL,
  lease TEXT NOT NULL,
  output_json TEXT CHECK (output_json IS NULL OR (json_valid(output_json) AND json_type(output_json) = 'object')),
  started_at INTEGER NOT NULL,
  CHECK ((status = 'complete') = (output_json IS NOT NULL))
);
CREATE UNIQUE INDEX generation_running ON generation_requests(user_id, kind) WHERE status = 'running';

CREATE TABLE readings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  study_day TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1')),
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  targets TEXT NOT NULL CHECK (json_valid(targets) AND json_type(targets) = 'array'),
  created_at INTEGER NOT NULL,
  completed_day TEXT,
  quiz_day TEXT,
  answers TEXT CHECK (answers IS NULL OR (json_valid(answers) AND json_type(answers) = 'array' AND json_array_length(answers) = 3)),
  response TEXT NOT NULL DEFAULT '',
  response_day TEXT,
  feedback TEXT CHECK (feedback IS NULL OR (json_valid(feedback) AND json_type(feedback) = 'object')),
  CHECK ((answers IS NULL) = (quiz_day IS NULL)),
  CHECK ((response = '') = (response_day IS NULL)),
  CHECK (response = '' OR length(trim(response)) > 0),
  CHECK (feedback IS NULL OR response <> '')
);
CREATE INDEX readings_owner ON readings(user_id, created_at DESC, id DESC);
