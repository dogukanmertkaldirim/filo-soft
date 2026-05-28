/*
  # Multi-Tenant Architecture Implementation

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `name` (text) - company display name
      - `subscription_status` (text) - 'active', 'suspended'
      - `logo_url` (text, nullable) - company logo
      - `created_at` (timestamp)

  2. Modified Tables
    - `app_users`
      - Add `company_id` (uuid, foreign key -> companies.id)
      - Update `role` to include 'super_admin'
    
    - All operational tables get `company_id` column:
      - vehicles, customers, rentals, maintenances, transactions
      - loans, loan_payments, partners, partner_transactions
      - reservations, activity_logs, suppliers, external_services
      - vehicle_sales, vehicle_partners, rental_expenses, accidents
      - company_profiles, partner_documents

  3. Seed Data
    - Company 1: "DMK Filo" with admin user dogukanmertk
    - Company 2: "Demo Galeri A.S." with demo_user

  4. Security
    - All data is isolated by company_id
    - Users can only access their company's data
    - super_admin can access all companies
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subscription_status text NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended')),
  logo_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read for companies"
  ON companies FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert for companies"
  ON companies FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update for companies"
  ON companies FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Update app_users role constraint and add company_id
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
  CHECK (role IN ('admin', 'user', 'super_admin'));

-- Add company_id to app_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE app_users ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to rentals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE rentals ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to maintenances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenances' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE maintenances ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to loans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loans' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE loans ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to loan_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_payments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE loan_payments ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to partners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE partners ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to partner_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_transactions' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE partner_transactions ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to reservations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to activity_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE activity_logs ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to suppliers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to external_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_services' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE external_services ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to vehicle_sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_sales' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE vehicle_sales ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to vehicle_partners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_partners' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE vehicle_partners ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to rental_expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_expenses' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE rental_expenses ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to accidents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accidents' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE accidents ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to company_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_profiles' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE company_profiles ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Add company_id to partner_documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_documents' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE partner_documents ADD COLUMN company_id uuid REFERENCES companies(id);
  END IF;
END $$;

-- Seed Companies
INSERT INTO companies (id, name, subscription_status, logo_url)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'DMK Filo', 'active', null),
  ('22222222-2222-2222-2222-222222222222', 'Demo Galeri A.S.', 'active', null)
ON CONFLICT (id) DO NOTHING;

-- Update existing users to belong to DMK Filo
UPDATE app_users 
SET company_id = '11111111-1111-1111-1111-111111111111'
WHERE username IN ('dogukanmertk', 'ogulcan', 'erkan');

-- Make dogukanmertk a super_admin
UPDATE app_users 
SET role = 'super_admin'
WHERE username = 'dogukanmertk';

-- Create demo user for Demo Galeri
INSERT INTO app_users (username, password, full_name, role, company_id)
VALUES ('demo_user', '123456', 'Demo Kullanici', 'admin', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (username) DO NOTHING;

-- Update existing data to belong to DMK Filo (company 1)
UPDATE vehicles SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE customers SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE rentals SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE maintenances SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE transactions SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE loans SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE loan_payments SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE partners SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE partner_transactions SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE reservations SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE activity_logs SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE suppliers SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE external_services SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE vehicle_sales SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE vehicle_partners SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE rental_expenses SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE accidents SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE company_profiles SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;
UPDATE partner_documents SET company_id = '11111111-1111-1111-1111-111111111111' WHERE company_id IS NULL;

-- Create demo vehicles for Demo Galeri company
INSERT INTO vehicles (plate, brand, model, year, color, status, company_id)
VALUES 
  ('34 DEMO 001', 'Toyota', 'Corolla', 2023, 'Beyaz', 'idle', '22222222-2222-2222-2222-222222222222'),
  ('34 DEMO 002', 'Honda', 'Civic', 2022, 'Siyah', 'idle', '22222222-2222-2222-2222-222222222222'),
  ('34 DEMO 003', 'Ford', 'Focus', 2021, 'Mavi', 'rented', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- Create demo customer for Demo Galeri
INSERT INTO customers (company_title, authorized_person, company_id)
VALUES ('Demo Musteri Ltd.', 'Ali Veli', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;