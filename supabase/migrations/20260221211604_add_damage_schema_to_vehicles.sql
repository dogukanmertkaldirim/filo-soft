/*
  # Add damage_schema JSONB column to vehicles

  1. Modified Tables
    - `vehicles`
      - Added `damage_schema` (jsonb, nullable) - Stores per-part damage status as a JSON map
        e.g. {"hood": "boyali", "front_bumper": "degisen", "roof": "orijinal"}

  2. Important Notes
    - This replaces the plain-text initial_damage_status with a structured interactive schema
    - The existing initial_damage_status column is preserved for backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'damage_schema'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN damage_schema jsonb DEFAULT NULL;
  END IF;
END $$;
