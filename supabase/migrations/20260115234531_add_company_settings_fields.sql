/*
  # Add Company Settings Fields for Customer Portal

  1. Changes
    - Add `company_email` column (text) for company contact email
    - Add `company_phone` column (text) for company main phone
    - Add `company_website` column (text) for company website
    - Add `working_hours` column (text) for working hours display

  2. Purpose
    - Enable displaying company contact info in customer portal
    - Centralize contact information
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_email'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_phone'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'company_website'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN company_website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'working_hours'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN working_hours text DEFAULT 'Pzt-Cmt: 09:00 - 18:00';
  END IF;
END $$;
