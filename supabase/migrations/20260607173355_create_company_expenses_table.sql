/*
  # Create Company Expenses Table

  1. New Tables
    - `company_expenses`
      - `id` (uuid, PK)
      - `company_id` (uuid, FK to companies)
      - `category` (text) - expense category
      - `amount` (numeric) - expense amount
      - `due_date` (date) - when payment is due
      - `payment_date` (date, nullable) - when actually paid
      - `status` (text) - 'pending' or 'paid'
      - `description` (text)
      - `is_recurring` (boolean) - auto-repeat monthly
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - RLS enabled with policies for authenticated and anon (matching app pattern)
*/

CREATE TABLE IF NOT EXISTS company_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  payment_date date,
  status text NOT NULL DEFAULT 'pending',
  description text,
  is_recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read company_expenses"
  ON company_expenses FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated insert company_expenses"
  ON company_expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update company_expenses"
  ON company_expenses FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated delete company_expenses"
  ON company_expenses FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anon read company_expenses"
  ON company_expenses FOR SELECT TO anon USING (true);

CREATE POLICY "Anon insert company_expenses"
  ON company_expenses FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update company_expenses"
  ON company_expenses FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon delete company_expenses"
  ON company_expenses FOR DELETE TO anon USING (true);

CREATE INDEX idx_company_expenses_company ON company_expenses(company_id, status);
CREATE INDEX idx_company_expenses_due_date ON company_expenses(due_date);
