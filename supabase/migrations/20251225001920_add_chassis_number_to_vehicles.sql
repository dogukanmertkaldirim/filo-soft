/*
  # Add Chassis Number to Vehicles

  1. Changes
    - Adds `chassis_number` column to `vehicles` table
    - This field stores the vehicle's chassis/VIN number for contracts
    - Column is optional (nullable) to maintain compatibility with existing data

  2. Notes
    - Chassis number is important for rental contracts
    - Field is recommended but not required
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'chassis_number'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN chassis_number text;
  END IF;
END $$;
