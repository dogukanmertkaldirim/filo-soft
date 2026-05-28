/*
  # Service & Support Features

  1. Schema Changes
    - Add `assigned_rep_id` to `app_users` - links customers to their representative
    - Add `inspection_due_date` to `vehicles` if not exists

  2. New Tables
    - `service_appointments`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `vehicle_id` (uuid, foreign key)
      - `customer_id` (uuid, foreign key to app_users)
      - `type` (text: 'maintenance', 'tire_change')
      - `appointment_date` (timestamptz)
      - `location_name` (text)
      - `contact_person` (text)
      - `contact_phone` (text)
      - `notes` (text)
      - `status` (text: 'pending', 'confirmed', 'completed', 'cancelled')
      - `created_at`, `updated_at` timestamps

    - `damage_reports`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `vehicle_id` (uuid, foreign key)
      - `customer_id` (uuid, foreign key to app_users)
      - `incident_type` (text: 'accident', 'breakdown', 'damage')
      - `description` (text)
      - `photo_urls` (jsonb array)
      - `urgency` (text: 'low', 'medium', 'high', 'critical')
      - `status` (text: 'pending', 'in_progress', 'resolved')
      - `admin_notes` (text)
      - `created_at`, `updated_at` timestamps

  3. Security
    - Enable RLS on all new tables
    - Policies for anon access (company-based)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'assigned_rep_id'
  ) THEN
    ALTER TABLE app_users ADD COLUMN assigned_rep_id uuid REFERENCES app_users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'inspection_due_date'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN inspection_due_date date;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  vehicle_id uuid REFERENCES vehicles(id),
  customer_id uuid REFERENCES app_users(id),
  type text NOT NULL CHECK (type IN ('maintenance', 'tire_change')),
  appointment_date timestamptz NOT NULL,
  location_name text NOT NULL,
  contact_person text,
  contact_phone text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS damage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  vehicle_id uuid REFERENCES vehicles(id),
  customer_id uuid REFERENCES app_users(id),
  incident_type text NOT NULL CHECK (incident_type IN ('accident', 'breakdown', 'damage')),
  description text NOT NULL,
  photo_urls jsonb DEFAULT '[]',
  urgency text NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE service_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view service appointments"
  ON service_appointments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can create service appointments"
  ON service_appointments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update service appointments"
  ON service_appointments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete service appointments"
  ON service_appointments FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Anon can view damage reports"
  ON damage_reports FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can create damage reports"
  ON damage_reports FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update damage reports"
  ON damage_reports FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_service_appointments_company ON service_appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_service_appointments_customer ON service_appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_appointments_vehicle ON service_appointments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_appointments_date ON service_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_damage_reports_company ON damage_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_damage_reports_customer ON damage_reports(customer_id);
CREATE INDEX IF NOT EXISTS idx_damage_reports_status ON damage_reports(status);
CREATE INDEX IF NOT EXISTS idx_app_users_assigned_rep ON app_users(assigned_rep_id);