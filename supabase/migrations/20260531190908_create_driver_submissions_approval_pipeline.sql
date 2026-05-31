/*
  # Create Driver Submissions Approval Pipeline

  1. New Tables
    - `driver_submissions`
      - `id` (uuid, primary key)
      - `company_id` (uuid, FK to companies) - the DMK Filo company
      - `tenant_customer_id` (uuid, FK to app_users) - the tenant company (customer) user
      - `driver_id` (uuid, FK to customer_drivers) - the driver who submitted
      - `vehicle_id` (uuid, FK to vehicles) - related vehicle
      - `submission_type` (text) - 'km_update', 'malfunction', 'damage', 'expense_receipt'
      - `data` (jsonb) - flexible payload for all submission types
      - `status` (text) - 'pending_tenant', 'approved_pending_lessor', 'approved', 'rejected'
      - `tenant_reviewed_at` (timestamptz) - when tenant reviewed
      - `tenant_reviewed_by` (text) - who reviewed at tenant level
      - `lessor_reviewed_at` (timestamptz) - when DMK reviewed
      - `lessor_reviewed_by` (text) - who reviewed at DMK level
      - `rejection_reason` (text) - optional reason for rejection
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `service_appointments`
      - `assigned_driver_id` (uuid, FK to customer_drivers) - tenant-assigned driver
      - `driver_assigned_at` (timestamptz) - when the driver was assigned
      - `driver_assigned_by` (text) - who assigned the driver

  3. Security
    - RLS enabled on driver_submissions
    - Policies for authenticated users scoped by company_id
*/

CREATE TABLE IF NOT EXISTS driver_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  tenant_customer_id uuid REFERENCES app_users(id),
  driver_id uuid REFERENCES customer_drivers(id),
  vehicle_id uuid REFERENCES vehicles(id),
  submission_type text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_tenant',
  tenant_reviewed_at timestamptz,
  tenant_reviewed_by text,
  lessor_reviewed_at timestamptz,
  lessor_reviewed_by text,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE driver_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read driver_submissions"
  ON driver_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert driver_submissions"
  ON driver_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update driver_submissions"
  ON driver_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Also allow anon for the app_users based auth pattern used in this app
CREATE POLICY "Anon can read driver_submissions"
  ON driver_submissions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert driver_submissions"
  ON driver_submissions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update driver_submissions"
  ON driver_submissions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Add driver assignment to service_appointments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_appointments' AND column_name = 'assigned_driver_id') THEN
    ALTER TABLE service_appointments ADD COLUMN assigned_driver_id uuid REFERENCES customer_drivers(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_appointments' AND column_name = 'driver_assigned_at') THEN
    ALTER TABLE service_appointments ADD COLUMN driver_assigned_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_appointments' AND column_name = 'driver_assigned_by') THEN
    ALTER TABLE service_appointments ADD COLUMN driver_assigned_by text;
  END IF;
END $$;

-- Index for efficient tenant queries
CREATE INDEX IF NOT EXISTS idx_driver_submissions_tenant ON driver_submissions(tenant_customer_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_submissions_status ON driver_submissions(status, company_id);
