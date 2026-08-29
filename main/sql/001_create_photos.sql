-- Create photos table for permanent image metadata
CREATE TABLE IF NOT EXISTS photos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url TEXT,
  title TEXT,
  caption TEXT,
  category TEXT,
  sub_category TEXT,
  date TEXT,
  is_featured INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Helpful index for common queries
CREATE INDEX IF NOT EXISTS photos_category_idx ON photos (category);
CREATE INDEX IF NOT EXISTS photos_sub_category_idx ON photos (sub_category);
