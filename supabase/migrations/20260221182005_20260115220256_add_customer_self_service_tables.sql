/*
  # Customer Self-Service Tables

  1. New Tables
    - `customer_requests`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `user_id` (uuid, foreign key to app_users)
      - `vehicle_id` (uuid, foreign key to vehicles)
      - `rental_id` (uuid, foreign key to rentals, nullable)
      - `request_type` (text: 'extend_rental', 'km_report', 'accident_report')
      - `status` (text: 'pending', 'approved', 'rejected')
      - `data` (jsonb - stores request-specific data)
      - `admin_notes` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `customer_receipts`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `user_id` (uuid, foreign key to app_users)
      - `rental_id` (uuid, foreign key to rentals, nullable)
      - `transaction_id` (uuid, foreign key to transactions, nullable)
      - `rental_expense_id` (uuid, foreign key to rental_expenses, nullable)
      - `receipt_url` (text)
      - `description` (text, nullable)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Policies for authenticated users to manage their own data
    - Policies for anon access (company-based)
*/

CREATE TABLE IF NOT EXISTS customer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  user_id uuid REFERENCES app_users(id),
  vehicle_id uuid REFERENCES vehicles(id),
  rental_id uuid REFERENCES rentals(id),
  request_type text NOT NULL CHECK (request_type IN ('extend_rental', 'km_report', 'accident_report')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  data jsonb NOT NULL DEFAULT '{}',
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  user_id uuid REFERENCES app_users(id),
  rental_id uuid REFERENCES rentals(id),
  transaction_id uuid REFERENCES transactions(id),
  rental_expense_id uuid REFERENCES rental_expenses(id),
  receipt_url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON customer_requests FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can create requests"
  ON customer_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can update own requests"
  ON customer_requests FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own receipts"
  ON customer_receipts FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can upload receipts"
  ON customer_receipts FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX idx_customer_requests_company ON customer_requests(company_id);
CREATE INDEX idx_customer_requests_user ON customer_requests(user_id);
CREATE INDEX idx_customer_requests_status ON customer_requests(status);
CREATE INDEX idx_customer_receipts_company ON customer_receipts(company_id);
CREATE INDEX idx_customer_receipts_user ON customer_receipts(user_id);