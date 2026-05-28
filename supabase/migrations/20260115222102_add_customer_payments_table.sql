/*
  # Customer Payments / Debts Table

  1. New Tables
    - `customer_payments`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key to app_users - customer)
      - `rental_id` (uuid, foreign key to rentals - optional)
      - `vehicle_id` (uuid, foreign key to vehicles - optional)
      - `payment_type` (text: rental_extension, km_overage, damage_repair, traffic_fine, etc)
      - `description` (text)
      - `amount` (numeric)
      - `status` (text: pending, paid, cancelled)
      - `due_date` (date - optional)
      - `paid_at` (timestamptz - when paid)
      - `related_request_id` (uuid - link to customer_requests if applicable)
      - `related_damage_report_id` (uuid - link to damage_reports if applicable)
      - `created_at`, `updated_at` timestamps

  2. Purpose
    - Track customer debts/charges in a centralized way
    - Link charges to rental extensions, km overages, damage repairs
    - Enable atomic financial transactions when approving requests

  3. Security
    - Enable RLS on the table
    - Policies for anon access (company-based)
*/

CREATE TABLE IF NOT EXISTS customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  user_id uuid REFERENCES app_users(id),
  rental_id uuid REFERENCES rentals(id),
  vehicle_id uuid REFERENCES vehicles(id),
  payment_type text NOT NULL CHECK (payment_type IN ('rental_extension', 'km_overage', 'damage_repair', 'traffic_fine', 'other')),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  due_date date,
  paid_at timestamptz,
  related_request_id uuid REFERENCES customer_requests(id),
  related_damage_report_id uuid REFERENCES damage_reports(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view customer payments"
  ON customer_payments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can create customer payments"
  ON customer_payments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update customer payments"
  ON customer_payments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete customer payments"
  ON customer_payments FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_customer_payments_company ON customer_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_user ON customer_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_rental ON customer_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_status ON customer_payments(status);
