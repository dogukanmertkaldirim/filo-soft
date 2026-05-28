/*
  # Add Position Column to Notes Table

  1. Changes
    - Add `position` (integer) column to `notes` table for custom ordering
    - Set default position based on creation order for existing notes
    - Create index for efficient ordering queries

  2. Notes
    - Position is used for drag-and-drop reordering
    - Lower position numbers appear first
    - New notes will get the next available position
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'position'
  ) THEN
    ALTER TABLE notes ADD COLUMN position integer DEFAULT 0;
  END IF;
END $$;

UPDATE notes 
SET position = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM notes
  WHERE position = 0 OR position IS NULL
) AS subquery
WHERE notes.id = subquery.id;

CREATE INDEX IF NOT EXISTS idx_notes_position ON notes(position);