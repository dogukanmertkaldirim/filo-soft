/*
  # Add Early Return Tracking Fields

  1. New Columns on `rentals` table
    - `actual_return_date` (date) - The actual date vehicle was returned
    - `early_return_days` (integer) - Number of days returned early
    - `early_return_refund` (decimal) - Pro-rata refund amount for early return

  2. Purpose
    - Track actual return dates vs planned end dates
    - Calculate and record early return refunds
    - Enable pro-rata billing adjustments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'actual_return_date'
  ) THEN
    ALTER TABLE rentals ADD COLUMN actual_return_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'early_return_days'
  ) THEN
    ALTER TABLE rentals ADD COLUMN early_return_days integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'early_return_refund'
  ) THEN
    ALTER TABLE rentals ADD COLUMN early_return_refund decimal(12,2);
  END IF;
END $$;

COMMENT ON COLUMN rentals.actual_return_date IS 'The actual date the vehicle was returned';
COMMENT ON COLUMN rentals.early_return_days IS 'Number of days the vehicle was returned before the planned end date';
COMMENT ON COLUMN rentals.early_return_refund IS 'Pro-rata refund amount calculated for early return';