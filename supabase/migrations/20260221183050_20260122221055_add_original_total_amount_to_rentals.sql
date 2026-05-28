/*
  # Add Original Total Amount Column to Rentals

  1. Changes
    - Add `original_total_amount` column to store the contract's original price before early return revision
    - This allows tracking the difference between planned vs. actual revenue

  2. Purpose
    - When a rental is returned early, the `total_amount` gets updated to the pro-rata price
    - `original_total_amount` preserves what the contract was originally worth
    - This enables showing "Erken Donus Revizesi" in rental history
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'original_total_amount'
  ) THEN
    ALTER TABLE rentals ADD COLUMN original_total_amount numeric(12,2) DEFAULT NULL;
  END IF;
END $$;