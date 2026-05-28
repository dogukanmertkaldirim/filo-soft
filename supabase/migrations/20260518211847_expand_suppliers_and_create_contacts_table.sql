/*
  # Expand Suppliers for Partner Network & Contract Management

  1. New Columns on `suppliers`
    - `city` (text) - City where the partner is located
    - `service_type` (text) - Primary service type (Yetkili Servis, Ozel Servis, Lastikci, Cekici, Yol Yardim)
    - `discount_spare_parts` (numeric) - Spare parts discount percentage
    - `discount_labor` (numeric) - Labor discount percentage
    - `payment_maturity` (text) - Payment term (e.g., 30 Gun, 60 Gun, Pesin)
    - `contract_file_url` (text) - URL for uploaded contract document

  2. New Table: `supplier_contacts`
    - `id` (uuid, primary key)
    - `supplier_id` (uuid, references suppliers)
    - `full_name` (text)
    - `phone` (text)
    - `email` (text)
    - `notes` (text)
    - `company_id` (uuid) - For RLS
    - `created_at` (timestamptz)

  3. Security
    - RLS enabled on `supplier_contacts`
    - Policies for authenticated users scoped to company_id
*/

-- Add new columns to suppliers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'city' AND table_schema = 'public'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'service_type' AND table_schema = 'public'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN service_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'discount_spare_parts' AND table_schema = 'public'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN discount_spare_parts numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'discount_labor' AND table_schema = 'public'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN discount_labor numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'payment_maturity' AND table_schema = 'public'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN payment_maturity text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'contract_file_url' AND table_schema = 'public'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN contract_file_url text;
  END IF;
END $$;

-- Create supplier_contacts table
CREATE TABLE IF NOT EXISTS supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text,
  notes text,
  company_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_contacts' AND policyname = 'Authenticated users can view supplier contacts for their company'
  ) THEN
    CREATE POLICY "Authenticated users can view supplier contacts for their company"
      ON supplier_contacts FOR SELECT
      TO authenticated
      USING (company_id IN (
        SELECT company_id FROM app_users WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_contacts' AND policyname = 'Authenticated users can insert supplier contacts for their company'
  ) THEN
    CREATE POLICY "Authenticated users can insert supplier contacts for their company"
      ON supplier_contacts FOR INSERT
      TO authenticated
      WITH CHECK (company_id IN (
        SELECT company_id FROM app_users WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_contacts' AND policyname = 'Authenticated users can update supplier contacts for their company'
  ) THEN
    CREATE POLICY "Authenticated users can update supplier contacts for their company"
      ON supplier_contacts FOR UPDATE
      TO authenticated
      USING (company_id IN (
        SELECT company_id FROM app_users WHERE id = auth.uid()
      ))
      WITH CHECK (company_id IN (
        SELECT company_id FROM app_users WHERE id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_contacts' AND policyname = 'Authenticated users can delete supplier contacts for their company'
  ) THEN
    CREATE POLICY "Authenticated users can delete supplier contacts for their company"
      ON supplier_contacts FOR DELETE
      TO authenticated
      USING (company_id IN (
        SELECT company_id FROM app_users WHERE id = auth.uid()
      ));
  END IF;
END $$;

-- Also allow anon access (matching the existing app pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_contacts' AND policyname = 'Anon can view supplier contacts'
  ) THEN
    CREATE POLICY "Anon can view supplier contacts"
      ON supplier_contacts FOR SELECT
      TO anon
      USING (company_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_contacts' AND policyname = 'Anon can insert supplier contacts'
  ) THEN
    CREATE POLICY "Anon can insert supplier contacts"
      ON supplier_contacts FOR INSERT
      TO anon
      WITH CHECK (company_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_contacts' AND policyname = 'Anon can update supplier contacts'
  ) THEN
    CREATE POLICY "Anon can update supplier contacts"
      ON supplier_contacts FOR UPDATE
      TO anon
      USING (company_id IS NOT NULL)
      WITH CHECK (company_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_contacts' AND policyname = 'Anon can delete supplier contacts'
  ) THEN
    CREATE POLICY "Anon can delete supplier contacts"
      ON supplier_contacts FOR DELETE
      TO anon
      USING (company_id IS NOT NULL);
  END IF;
END $$;

-- Create supplier-contracts storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-contracts', 'supplier-contracts', true)
ON CONFLICT (id) DO NOTHING;
