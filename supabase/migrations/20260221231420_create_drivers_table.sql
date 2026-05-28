/*
  # Create drivers table

  1. New Tables
    - `drivers`
      - `id` (uuid, primary key)
      - `company_id` (uuid, not null, references companies)
      - `name` (text, not null) - driver full name
      - `phone` (text, nullable) - contact phone
      - `license_class` (text, nullable) - driving license class (B, C, D, etc.)
      - `license_no` (text, nullable) - license number
      - `license_expiry` (date, nullable) - license expiry date
      - `status` (text, default 'active') - active / inactive
      - `notes` (text, nullable)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      - `deleted_at` (timestamptz, nullable) - soft delete

  2. Security
    - Enable RLS on `drivers` table
    - Add anon policy for current app architecture
    - Add authenticated policies for company-scoped access
*/

CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  license_class text,
  license_no text,
  license_expiry date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can access drivers"
  ON drivers FOR ALL TO anon
  USING (company_id IS NOT NULL)
  WITH CHECK (company_id IS NOT NULL);

CREATE POLICY "Users can view own company drivers"
  ON drivers FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT au.company_id FROM app_users au WHERE au.id::text = auth.uid()::text
  ));

CREATE POLICY "Users can insert own company drivers"
  ON drivers FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT au.company_id FROM app_users au WHERE au.id::text = auth.uid()::text
  ));

CREATE POLICY "Users can update own company drivers"
  ON drivers FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT au.company_id FROM app_users au WHERE au.id::text = auth.uid()::text
  ))
  WITH CHECK (company_id IN (
    SELECT au.company_id FROM app_users au WHERE au.id::text = auth.uid()::text
  ));

CREATE POLICY "Users can delete own company drivers"
  ON drivers FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT au.company_id FROM app_users au WHERE au.id::text = auth.uid()::text
  ));

CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
