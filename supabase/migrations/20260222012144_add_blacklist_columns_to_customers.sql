/*
  # Add Blacklist Columns to Customers Table

  1. New Columns
    - `is_blacklisted` (boolean, default false) - Flag to mark if customer is blacklisted
    - `blacklist_reason` (text, nullable) - Reason for blacklisting the customer

  2. Purpose
    - Allow fleet managers to flag problematic customers
    - Track reasons for blacklisting for audit purposes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'is_blacklisted'
  ) THEN
    ALTER TABLE customers ADD COLUMN is_blacklisted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'blacklist_reason'
  ) THEN
    ALTER TABLE customers ADD COLUMN blacklist_reason text DEFAULT NULL;
  END IF;
END $$;