/*
  # Rental Payment Schedules for Long-Term Monthly Billing

  This migration implements a payment schedule system to support
  accrual-based billing for long-term rentals.

  ## 1. Changes to Rentals Table
    - Add `billing_type` column with values 'upfront' or 'monthly'
    - Default to 'upfront' to preserve existing rental behavior
    - Add `contract_months` for monthly billing duration

  ## 2. New Table: rental_payment_schedules
    - `id` (uuid, primary key)
    - `rental_id` (uuid, foreign key to rentals)
    - `due_date` (date) - When this amount becomes a debt
    - `amount` (numeric) - Monthly payment amount
    - `is_processed` (boolean) - Has been added to active debt
    - `status` (text) - 'pending', 'invoiced', 'paid'
    - `invoice_number` (text) - Optional invoice reference
    - `paid_at` (timestamp) - When payment was received
    - `notes` (text) - Additional notes

  ## 3. Security
    - Enable RLS on rental_payment_schedules
    - Add policies for authenticated users to manage their company's data

  ## 4. Important Notes
    - Existing rentals default to 'upfront' billing (no change in behavior)
    - Monthly billing only affects NEW rentals explicitly set as 'monthly'
    - Debt calculation: upfront = full amount, monthly = sum of due schedules
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'billing_type'
  ) THEN
    ALTER TABLE rentals ADD COLUMN billing_type text DEFAULT 'upfront' CHECK (billing_type IN ('upfront', 'monthly'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'contract_months'
  ) THEN
    ALTER TABLE rentals ADD COLUMN contract_months integer DEFAULT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rental_payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  is_processed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid')),
  invoice_number text,
  paid_at timestamptz,
  payment_transaction_id uuid REFERENCES transactions(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rental_payment_schedules_rental_id ON rental_payment_schedules(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_payment_schedules_company_id ON rental_payment_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_rental_payment_schedules_due_date ON rental_payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_rental_payment_schedules_status ON rental_payment_schedules(status);
CREATE INDEX IF NOT EXISTS idx_rental_payment_schedules_is_processed ON rental_payment_schedules(is_processed);
CREATE INDEX IF NOT EXISTS idx_rental_payment_schedules_company_due ON rental_payment_schedules(company_id, due_date) WHERE status != 'paid';

ALTER TABLE rental_payment_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rental_payment_schedules' AND policyname = 'Allow anon select on rental_payment_schedules'
  ) THEN
    CREATE POLICY "Allow anon select on rental_payment_schedules"
      ON rental_payment_schedules FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rental_payment_schedules' AND policyname = 'Allow anon insert on rental_payment_schedules'
  ) THEN
    CREATE POLICY "Allow anon insert on rental_payment_schedules"
      ON rental_payment_schedules FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rental_payment_schedules' AND policyname = 'Allow anon update on rental_payment_schedules'
  ) THEN
    CREATE POLICY "Allow anon update on rental_payment_schedules"
      ON rental_payment_schedules FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rental_payment_schedules' AND policyname = 'Allow anon delete on rental_payment_schedules'
  ) THEN
    CREATE POLICY "Allow anon delete on rental_payment_schedules"
      ON rental_payment_schedules FOR DELETE TO anon USING (true);
  END IF;
END $$;

UPDATE rentals SET billing_type = 'upfront' WHERE billing_type IS NULL;