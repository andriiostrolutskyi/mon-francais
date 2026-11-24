-- Explicit model annotations replace inferred matches. Keep existing reading
-- content and activity, but discard their inferred vocabulary associations.
ALTER TABLE readings ADD COLUMN occurrences TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(occurrences) AND json_type(occurrences) = 'array');

UPDATE readings SET targets = '[]';
