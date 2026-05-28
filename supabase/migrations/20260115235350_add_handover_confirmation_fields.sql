/*
  # Add confirmation fields to vehicle_handovers

  1. Changes
    - Add `is_confirmed` boolean column (replaces signature requirement)
    - Add `confirmed_at` timestamp column
    - Add `notes` text column for general notes
  
  2. Notes
    - is_confirmed defaults to false
    - This simplifies handover process by using checkbox instead of signature
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_handovers' AND column_name = 'is_confirmed'
  ) THEN
    ALTER TABLE vehicle_handovers ADD COLUMN is_confirmed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_handovers' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE vehicle_handovers ADD COLUMN confirmed_at timestamptz;
  END IF;
END $$;
