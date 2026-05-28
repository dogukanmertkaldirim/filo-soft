/*
  # Add Company Profiles Management

  1. New Tables
    - `company_profiles`
      - `id` (uuid, primary key)
      - `title` (text) - Short name for easy identification
      - `legal_name` (text) - Full commercial/legal name
      - `tax_office` (text) - Vergi Dairesi
      - `tax_no` (text) - Vergi Numarasi
      - `mersis_no` (text) - MERSIS numarasi
      - `address` (text) - Full address
      - `phone` (text)
      - `email` (text)
      - `iban_details` (text) - Bank account information
      - `logo_url` (text) - Company logo
      - `is_default` (boolean) - Default company for new rentals
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to Rentals Table
    - Add `company_profile_id` (uuid) - Links rental to contracting company

  3. Security
    - Enable RLS on company_profiles table
    - Add policies for anon access
*/

-- Create company_profiles table
CREATE TABLE IF NOT EXISTS company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  legal_name text NOT NULL,
  tax_office text,
  tax_no text,
  mersis_no text,
  address text,
  phone text,
  email text,
  iban_details text,
  logo_url text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add company_profile_id to rentals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'company_profile_id'
  ) THEN
    ALTER TABLE rentals ADD COLUMN company_profile_id uuid REFERENCES company_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_profiles' AND policyname = 'Allow select for anon'
  ) THEN
    CREATE POLICY "Allow select for anon" ON company_profiles FOR SELECT TO anon USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_profiles' AND policyname = 'Allow insert for anon'
  ) THEN
    CREATE POLICY "Allow insert for anon" ON company_profiles FOR INSERT TO anon WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_profiles' AND policyname = 'Allow update for anon'
  ) THEN
    CREATE POLICY "Allow update for anon" ON company_profiles FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_profiles' AND policyname = 'Allow delete for anon'
  ) THEN
    CREATE POLICY "Allow delete for anon" ON company_profiles FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rentals_company_profile_id ON rentals(company_profile_id);