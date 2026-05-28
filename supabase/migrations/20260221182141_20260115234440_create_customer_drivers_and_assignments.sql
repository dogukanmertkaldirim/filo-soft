/*
  # Customer Drivers & Vehicle Assignments (Sub-Fleet Management)

  1. New Tables
    - `customer_drivers`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `customer_id` (uuid, foreign key to app_users - the corporate customer admin)
      - `driver_name` (text)
      - `driver_phone` (text)
      - `driver_license_no` (text, optional)
      - `notes` (text, optional)
      - `is_active` (boolean)
      - `created_at`, `updated_at` timestamps

    - `vehicle_driver_assignments`
      - `id` (uuid, primary key)
      - `company_id` (uuid)
      - `vehicle_id` (uuid, foreign key to vehicles)
      - `rental_id` (uuid, foreign key to rentals)
      - `driver_id` (uuid, foreign key to customer_drivers)
      - `assigned_by` (uuid, the customer who assigned)
      - `assigned_at` (timestamptz)
      - `notes` (text)

  2. Security
    - Enable RLS on both tables
    - Allow anon access for company-based operations

  3. Purpose
    - Allows corporate customers to manage their driver roster
    - Track which driver is assigned to which rented vehicle
*/

CREATE TABLE IF NOT EXISTS customer_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  customer_id uuid REFERENCES app_users(id),
  driver_name text NOT NULL,
  driver_phone text,
  driver_license_no text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customer_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view customer drivers"
  ON customer_drivers FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can create customer drivers"
  ON customer_drivers FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update customer drivers"
  ON customer_drivers FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete customer drivers"
  ON customer_drivers FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_customer_drivers_company ON customer_drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_drivers_customer ON customer_drivers(customer_id);


CREATE TABLE IF NOT EXISTS vehicle_driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  vehicle_id uuid REFERENCES vehicles(id),
  rental_id uuid REFERENCES rentals(id),
  driver_id uuid REFERENCES customer_drivers(id),
  assigned_by uuid REFERENCES app_users(id),
  assigned_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_driver_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view vehicle driver assignments"
  ON vehicle_driver_assignments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can create vehicle driver assignments"
  ON vehicle_driver_assignments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update vehicle driver assignments"
  ON vehicle_driver_assignments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete vehicle driver assignments"
  ON vehicle_driver_assignments FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_vehicle_driver_assignments_company ON vehicle_driver_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_driver_assignments_vehicle ON vehicle_driver_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_driver_assignments_rental ON vehicle_driver_assignments(rental_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_driver_assignments_driver ON vehicle_driver_assignments(driver_id);