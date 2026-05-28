/*
  # Add KM Overage Fee Column

  1. Changes
    - Add `per_km_overage_fee` column to `rentals` table
    - This stores the fee charged per kilometer when daily KM limit is exceeded
    - Default value is 0 (no penalty)

  2. Notes
    - Fee is stored in TL per kilometer
    - Used in conjunction with `daily_km_limit` to calculate penalties on return
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'per_km_overage_fee'
  ) THEN
    ALTER TABLE rentals ADD COLUMN per_km_overage_fee decimal(10,2) DEFAULT 0;
  END IF;
END $$;