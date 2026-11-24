-- Keep existing learner IDs and their data while removing the old ID constraint.
-- Foreign keys directly referencing users use NO ACTION.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE users_new (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  review_revision INTEGER NOT NULL DEFAULT 0 CHECK (review_revision >= 0)
);

INSERT INTO users_new (id, name, timezone, review_revision)
  SELECT id, name, timezone, review_revision FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

PRAGMA defer_foreign_keys = OFF;
