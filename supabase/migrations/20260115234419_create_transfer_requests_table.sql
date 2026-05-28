/*
  # Transfer Requests Table (Transfer & Lojistik Talepleri)

  1. New Tables
    - `transfer_requests`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `customer_id` (uuid, foreign key to app_users - the requesting customer)
      - `status` (text: pending, offered, confirmed, cancelled, completed)
      - `vehicle_type` (text: sedan, vip_vito, minibus, bus, truck)
      - `passenger_count` (integer)
      - `pickup_location` (text)
      - `pickup_datetime` (timestamptz)
      - `dropoff_location` (text)
      - `notes` (text)
      - `admin_notes` (text - internal notes from admin)
      - `offered_price` (numeric - price offered by admin)
      - `created_at`, `updated_at` timestamps

  2. Security
    - Enable RLS on transfer_requests table
    - Allow anon access for company-based operations

  3. Purpose
    - Allows customers to request transfer/logistics services
    - Supports B2B corporate fleet management
*/

CREATE TABLE IF NOT EXISTS transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  customer_id uuid REFERENCES app_users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'offered', 'confirmed', 'cancelled', 'completed')),
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('sedan', 'vip_vito', 'minibus', 'bus', 'truck')),
  passenger_count integer DEFAULT 1,
  pickup_location text NOT NULL,
  pickup_datetime timestamptz NOT NULL,
  dropoff_location text NOT NULL,
  notes text,
  admin_notes text,
  offered_price numeric(10, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view transfer requests"
  ON transfer_requests FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can create transfer requests"
  ON transfer_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update transfer requests"
  ON transfer_requests FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_company ON transfer_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_customer ON transfer_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_datetime ON transfer_requests(pickup_datetime);
