/*
  # Add vehicle fleet import columns

  1. Modified Tables
    - `vehicles`
      - `fuel_type` (text, nullable) - Fuel type (Benzin, Dizel, LPG, Elektrik, Hibrit)
      - `transmission` (text, nullable) - Transmission type (Manuel, Otomatik)
      - `daily_price` (numeric, nullable, default 0) - Daily rental price
      - `monthly_price` (numeric, nullable, default 0) - Monthly rental price

  2. Notes
    - These columns support bulk Excel import for large fleets
    - All columns are nullable to maintain backward compatibility with existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'fuel_type'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN fuel_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'transmission'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN transmission text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'daily_price'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN daily_price numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'monthly_price'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN monthly_price numeric DEFAULT 0;
  END IF;
END $$;