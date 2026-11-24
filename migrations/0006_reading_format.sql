-- Older readings have no recorded format. Preserve them without guessing one.
ALTER TABLE readings ADD COLUMN format TEXT CHECK (format IS NULL OR length(trim(format)) > 0);
