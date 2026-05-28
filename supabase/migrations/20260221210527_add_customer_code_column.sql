/*
  # Add Customer Code (Cari Kod) to customers table

  1. Modified Tables
    - `customers`
      - Added `customer_code` (text, unique per company) - Used as the accounting identifier for each customer

  2. Important Notes
    - customer_code is unique within each company scope (compound unique constraint)
    - Existing customers without a code will need to have one assigned
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'customer_code'
  ) THEN
    ALTER TABLE customers ADD COLUMN customer_code text DEFAULT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_code_company
  ON customers (company_id, customer_code)
  WHERE customer_code IS NOT NULL AND deleted_at IS NULL;
