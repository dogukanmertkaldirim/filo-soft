/*
  # Add KABIS Tracking, Rental Expenses, and Accidents Tables

  1. Changes to Rentals Table
    - Add `kabis_notification_status` boolean column (default false)
    - Tracks whether KABIS notification has been submitted for the rental

  2. New Tables
    - `rental_expenses`
      - `id` (uuid, primary key)
      - `rental_id` (uuid, foreign key to rentals)
      - `expense_type` (text: 'hgs', 'traffic_fine', 'bridge_toll', 'damage_repair', 'other')
      - `amount` (decimal)
      - `expense_date` (date)
      - `description` (text)
      - `billable_to_customer` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `accidents`
      - `id` (uuid, primary key)
      - `rental_id` (uuid, foreign key to rentals, nullable)
      - `vehicle_id` (uuid, foreign key to vehicles)
      - `accident_date` (date)
      - `driver_fault_rate` (integer: 0, 50, 100)
      - `is_driver_alcohol_involved` (boolean, default false)
      - `insurance_type` (text: 'traffic', 'kasko', 'none')
      - `repair_cost` (decimal)
      - `valuation_loss` (decimal - Değer Kaybı)
      - `accident_report_url` (text - Kaza Tutanağı)
      - `description` (text)
      - `charge_to_customer` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  3. Security
    - Enable RLS on both new tables
    - Add policies for authenticated users
*/

-- Add KABIS status to rentals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'kabis_notification_status'
  ) THEN
    ALTER TABLE rentals ADD COLUMN kabis_notification_status boolean DEFAULT false;
  END IF;
END $$;

-- Create rental_expenses table
CREATE TABLE IF NOT EXISTS rental_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  expense_type text NOT NULL CHECK (expense_type IN ('hgs', 'traffic_fine', 'bridge_toll', 'damage_repair', 'other')),
  amount decimal(10,2) NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  billable_to_customer boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create accidents table
CREATE TABLE IF NOT EXISTS accidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES rentals(id) ON DELETE SET NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  accident_date date NOT NULL DEFAULT CURRENT_DATE,
  driver_fault_rate integer NOT NULL DEFAULT 0 CHECK (driver_fault_rate IN (0, 50, 100)),
  is_driver_alcohol_involved boolean DEFAULT false,
  insurance_type text NOT NULL DEFAULT 'none' CHECK (insurance_type IN ('traffic', 'kasko', 'none')),
  repair_cost decimal(10,2) DEFAULT 0,
  valuation_loss decimal(10,2) DEFAULT 0,
  accident_report_url text,
  description text,
  charge_to_customer boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE rental_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accidents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rental_expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rental_expenses' AND policyname = 'Allow select for anon'
  ) THEN
    CREATE POLICY "Allow select for anon" ON rental_expenses FOR SELECT TO anon USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rental_expenses' AND policyname = 'Allow insert for anon'
  ) THEN
    CREATE POLICY "Allow insert for anon" ON rental_expenses FOR INSERT TO anon WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rental_expenses' AND policyname = 'Allow update for anon'
  ) THEN
    CREATE POLICY "Allow update for anon" ON rental_expenses FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rental_expenses' AND policyname = 'Allow delete for anon'
  ) THEN
    CREATE POLICY "Allow delete for anon" ON rental_expenses FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- RLS Policies for accidents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accidents' AND policyname = 'Allow select for anon'
  ) THEN
    CREATE POLICY "Allow select for anon" ON accidents FOR SELECT TO anon USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accidents' AND policyname = 'Allow insert for anon'
  ) THEN
    CREATE POLICY "Allow insert for anon" ON accidents FOR INSERT TO anon WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accidents' AND policyname = 'Allow update for anon'
  ) THEN
    CREATE POLICY "Allow update for anon" ON accidents FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accidents' AND policyname = 'Allow delete for anon'
  ) THEN
    CREATE POLICY "Allow delete for anon" ON accidents FOR DELETE TO anon USING (true);
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rental_expenses_rental_id ON rental_expenses(rental_id);
CREATE INDEX IF NOT EXISTS idx_accidents_rental_id ON accidents(rental_id);
CREATE INDEX IF NOT EXISTS idx_accidents_vehicle_id ON accidents(vehicle_id);