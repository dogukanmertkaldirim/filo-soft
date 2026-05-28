/*
  # Add KABİS Identity Fields to Customers

  1. Modified Tables
    - `customers`
      - `tc_kimlik_no` (text) - Turkish citizen ID number (11 digits)
      - `first_name` (text) - Ad
      - `last_name` (text) - Soyad
      - `father_name` (text) - Baba Adi
      - `birth_place` (text) - Dogum Yeri
      - `birth_date` (date) - Dogum Tarihi
      - `passport_no` (text) - For foreign nationals
      - `nationality` (text) - Uyruk for foreign nationals
      - `is_foreign` (boolean) - Flag to distinguish citizen vs foreigner

  2. Modified Tables
    - `rentals`
      - `kabis_reported_by` (text) - Who marked it as reported
      - `kabis_reported_at` (timestamptz) - When it was marked

  3. Notes
    - These fields are mandatory for KABİS (Kiralik Arac Bildirim Sistemi) compliance
    - TC Kimlik No is required for Turkish citizens
    - Passport No + Nationality is required for foreign nationals
    - The kabis_notification_status column already exists on rentals
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'tc_kimlik_no') THEN
    ALTER TABLE customers ADD COLUMN tc_kimlik_no text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'first_name') THEN
    ALTER TABLE customers ADD COLUMN first_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'last_name') THEN
    ALTER TABLE customers ADD COLUMN last_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'father_name') THEN
    ALTER TABLE customers ADD COLUMN father_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'birth_place') THEN
    ALTER TABLE customers ADD COLUMN birth_place text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'birth_date') THEN
    ALTER TABLE customers ADD COLUMN birth_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'passport_no') THEN
    ALTER TABLE customers ADD COLUMN passport_no text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'nationality') THEN
    ALTER TABLE customers ADD COLUMN nationality text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'is_foreign') THEN
    ALTER TABLE customers ADD COLUMN is_foreign boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rentals' AND column_name = 'kabis_reported_by') THEN
    ALTER TABLE rentals ADD COLUMN kabis_reported_by text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rentals' AND column_name = 'kabis_reported_at') THEN
    ALTER TABLE rentals ADD COLUMN kabis_reported_at timestamptz;
  END IF;
END $$;
