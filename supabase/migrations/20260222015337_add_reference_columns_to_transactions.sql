/*
  # Add Reference Columns to Transactions

  1. New Columns
    - `reference_id` (text) - ID of the related entity (e.g., rental_payment_schedule)
    - `reference_type` (text) - Type of the related entity for polymorphic lookup

  2. Purpose
    - Enable tracking which payment or entity created a transaction
    - Allow reversing/deleting transactions when payments are reverted
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'reference_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN reference_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'reference_type'
  ) THEN
    ALTER TABLE transactions ADD COLUMN reference_type text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_id, reference_type);