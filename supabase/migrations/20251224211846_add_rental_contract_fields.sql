/*
  # Add Rental Contract Fields

  1. Changes to `rentals` table
    - Add `starting_km` (numeric) - Vehicle odometer reading at rental start
    - Add `fuel_status` (text) - Fuel level at start (empty, 1/4, 1/2, 3/4, full)
    - Add `deposit_amount` (numeric) - Security deposit amount
    - Change `start_date` and `end_date` to timestamp with time zone for precise date/time tracking
    
  2. Notes
    - Existing start_date and end_date columns will be converted to timestamptz
    - Default fuel_status to 'full'
    - Default deposit_amount to 0
*/

-- Add new columns to rentals table
ALTER TABLE rentals 
ADD COLUMN IF NOT EXISTS starting_km numeric,
ADD COLUMN IF NOT EXISTS fuel_status text DEFAULT 'full' CHECK (fuel_status IN ('empty', '1/4', '1/2', '3/4', 'full')),
ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0;

-- Convert date columns to timestamptz for better precision
-- First, create new columns with timestamptz type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rentals' AND column_name = 'start_datetime'
  ) THEN
    ALTER TABLE rentals ADD COLUMN start_datetime timestamptz;
    ALTER TABLE rentals ADD COLUMN end_datetime timestamptz;
    
    -- Copy existing date data to new datetime columns (set time to midnight)
    UPDATE rentals SET 
      start_datetime = start_date::timestamptz,
      end_datetime = end_date::timestamptz;
  END IF;
END $$;
