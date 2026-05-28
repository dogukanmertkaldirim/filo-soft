/*
  # Create VIP Transfers Table

  1. New Tables
    - `vip_transfers`
      - `id` (uuid, primary key)
      - `company_id` (uuid, FK to companies)
      - `customer_id` (uuid, FK to customers, nullable)
      - `customer_name` (text) - for quick display / walk-in clients
      - `vehicle_id` (uuid, FK to vehicles, nullable)
      - `driver_id` (uuid, FK to app_users, nullable)
      - `pickup_location` (text) - origin
      - `dropoff_location` (text) - destination
      - `transfer_date` (date)
      - `transfer_time` (time)
      - `price` (numeric, default 0)
      - `status` (text - bekliyor, yolda, tamamlandi, iptal)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `deleted_at` (timestamptz, nullable - soft delete)

  2. Security
    - Enable RLS on `vip_transfers` table
    - Add policies for authenticated users scoped to their company
*/

CREATE TABLE IF NOT EXISTS vip_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid,
  customer_name text NOT NULL DEFAULT '',
  vehicle_id uuid,
  driver_id uuid,
  pickup_location text NOT NULL DEFAULT '',
  dropoff_location text NOT NULL DEFAULT '',
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  transfer_time time NOT NULL DEFAULT '09:00',
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'bekliyor',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE vip_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company vip transfers"
  ON vip_transfers FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT au.company_id FROM app_users au
      WHERE au.id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert own company vip transfers"
  ON vip_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT au.company_id FROM app_users au
      WHERE au.id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can update own company vip transfers"
  ON vip_transfers FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT au.company_id FROM app_users au
      WHERE au.id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT au.company_id FROM app_users au
      WHERE au.id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own company vip transfers"
  ON vip_transfers FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT au.company_id FROM app_users au
      WHERE au.id::text = auth.uid()::text
    )
  );

CREATE POLICY "Anon can access vip transfers"
  ON vip_transfers FOR ALL
  TO anon
  USING (company_id IS NOT NULL)
  WITH CHECK (company_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_vip_transfers_company_id ON vip_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_vip_transfers_status ON vip_transfers(status);
CREATE INDEX IF NOT EXISTS idx_vip_transfers_date ON vip_transfers(transfer_date DESC);
