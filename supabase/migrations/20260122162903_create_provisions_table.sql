/*
  # Deposit & Provision Management System

  1. New Tables
    - `provisions`: Track security deposits and provisions for rentals
      - `id` (uuid, PK): Unique identifier
      - `rental_id` (uuid, FK): Links to specific rental contract
      - `customer_id` (uuid, FK): Customer who paid the deposit
      - `company_id` (uuid, FK): Company tenant
      - `amount` (numeric): The blocked amount
      - `status` (text): active, released, captured, partial_captured
      - `payment_method` (text): credit_card, cash, transfer
      - `provider_ref` (text): Auth code or reference from POS
      - `capture_amount` (numeric): Amount captured if partial
      - `release_amount` (numeric): Amount released/refunded
      - `capture_reason` (text): Why the deposit was captured
      - `notes` (text): Additional notes
      - `captured_at` (timestamp): When capture occurred
      - `released_at` (timestamp): When release occurred
      - `created_at` (timestamp): Creation timestamp

  2. Security
    - Enable RLS on provisions table
    - Company-scoped access policies

  3. Notes
    - Provisions with status='active' are liabilities (not income)
    - Only 'captured' provisions become actual income
*/

CREATE TABLE IF NOT EXISTS provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  status text NOT NULL DEFAULT 'active',
  payment_method text NOT NULL DEFAULT 'cash',
  provider_ref text,
  capture_amount numeric(12, 2) DEFAULT 0,
  release_amount numeric(12, 2) DEFAULT 0,
  capture_reason text,
  notes text,
  captured_at timestamptz,
  released_at timestamptz,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE provisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provisions_select_own"
  ON provisions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "provisions_insert_own"
  ON provisions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "provisions_update_own"
  ON provisions FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "provisions_delete_own"
  ON provisions FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "provisions_anon_select"
  ON provisions FOR SELECT
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_provisions_rental_id ON provisions(rental_id);
CREATE INDEX IF NOT EXISTS idx_provisions_customer_id ON provisions(customer_id);
CREATE INDEX IF NOT EXISTS idx_provisions_company_id ON provisions(company_id);
CREATE INDEX IF NOT EXISTS idx_provisions_status ON provisions(status);
