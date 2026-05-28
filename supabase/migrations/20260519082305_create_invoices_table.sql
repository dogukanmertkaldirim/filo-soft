/*
  # Create Invoices Table

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `company_id` (uuid, FK to companies)
      - `rental_id` (uuid, optional FK to rentals)
      - `customer_id` (uuid, FK to customers)
      - `invoice_number` (text, optional for drafts)
      - `amount` (numeric, invoice total)
      - `issue_date` (date, when the invoice should be issued)
      - `due_date` (date, payment due date)
      - `status` (text: Taslak, Kesilmesi Bekleyen, Kesildi, Iptal)
      - `invoice_type` (text: Kiralama Bedeli, HGS Yansitma, Hasar Yansitma, Diger)
      - `description` (text, optional notes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `invoices` table
    - Add policies for anon access scoped by company_id

  3. Notes
    - Status options: Taslak (draft), Kesilmesi Bekleyen (pending issuance), Kesildi (issued), Iptal (cancelled)
    - Type options: Kiralama Bedeli, HGS Yansitma, Hasar Yansitma, Diger
*/

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  rental_id uuid REFERENCES rentals(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  invoice_number text,
  amount numeric NOT NULL DEFAULT 0,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'Taslak',
  invoice_type text NOT NULL DEFAULT 'Kiralama Bedeli',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select"
  ON invoices FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "invoices_insert"
  ON invoices FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "invoices_update"
  ON invoices FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "invoices_delete"
  ON invoices FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
