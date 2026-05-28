/*
  # Update Accident Fault Rate to Flexible Number

  1. Changes
    - Modify `accidents` table
    - Change `driver_fault_rate` column from fixed values (0, 50, 100) to flexible integer (0-100)
    - This allows users to enter any fault percentage like 25%, 75%, etc.

  2. Notes
    - Existing data will be preserved
    - Column accepts values from 0 to 100
*/

-- Drop existing constraint if any and modify column type
ALTER TABLE accidents 
  ALTER COLUMN driver_fault_rate TYPE integer USING driver_fault_rate::integer;

-- Add check constraint to ensure values are between 0 and 100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'accidents_driver_fault_rate_check'
  ) THEN
    ALTER TABLE accidents 
      ADD CONSTRAINT accidents_driver_fault_rate_check 
      CHECK (driver_fault_rate >= 0 AND driver_fault_rate <= 100);
  END IF;
END $$;