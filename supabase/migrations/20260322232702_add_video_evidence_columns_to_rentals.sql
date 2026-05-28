/*
  # Add Video Evidence Columns to Rentals

  1. Modified Tables
    - `rentals`
      - `delivery_video_url` (text, nullable) - URL of video recorded during vehicle delivery
      - `return_video_url` (text, nullable) - URL of video recorded during vehicle return

  2. Important Notes
    - Videos are optional evidence for handover/return processes
    - Stored as URLs pointing to files in the rental-videos storage bucket
    - Max 25MB per video (~15 seconds) enforced at application level
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'delivery_video_url'
  ) THEN
    ALTER TABLE rentals ADD COLUMN delivery_video_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'return_video_url'
  ) THEN
    ALTER TABLE rentals ADD COLUMN return_video_url text;
  END IF;
END $$;
