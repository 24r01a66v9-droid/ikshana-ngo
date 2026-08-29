-- Ensure leadership_members and events tables have image columns
ALTER TABLE IF EXISTS leadership_members
  ADD COLUMN IF NOT EXISTS image TEXT;

ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS image TEXT;

-- If events table is missing created_at, ensure it exists for ordering
ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
