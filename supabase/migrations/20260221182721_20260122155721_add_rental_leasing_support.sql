/*
  # Rental System Enhancement - Leasing Support

  1. New Columns in `rentals` table
    - `payment_timing` (text) - When payments are due relative to the rental period
      - 'beginning_of_period': Payment due at start of each period (pre-paid)
      - 'end_of_period': Payment due at end of each period (post-paid)
    - `rental_type` (text) - Type of rental agreement
      - 'short_term': Daily/weekly rentals (existing behavior)
      - 'operational_leasing': Long-term leasing contracts (new)
    - `contract_duration_months` (integer) - For leasing: total contract duration
    - `early_termination_fee` (numeric) - Fee charged for early contract termination
    - `services_included` (jsonb) - Array of included services for leasing
      - Examples: 'tires', 'maintenance', 'insurance', 'replacement_car'

  2. Changes
    - These fields enable flexible rental configurations for both B2C daily rentals
      and B2B operational leasing scenarios
    - Payment schedule generation will use payment_timing to determine due dates

  3. Security
    - No RLS changes needed (existing policies apply)
*/

-- Add payment_timing column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'payment_timing'
  ) THEN
    ALTER TABLE rentals ADD COLUMN payment_timing text DEFAULT 'beginning_of_period';
  END IF;
END $$;

-- Add rental_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'rental_type'
  ) THEN
    ALTER TABLE rentals ADD COLUMN rental_type text DEFAULT 'short_term';
  END IF;
END $$;

-- Add contract_duration_months column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'contract_duration_months'
  ) THEN
    ALTER TABLE rentals ADD COLUMN contract_duration_months integer;
  END IF;
END $$;

-- Add early_termination_fee column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'early_termination_fee'
  ) THEN
    ALTER TABLE rentals ADD COLUMN early_termination_fee numeric(12, 2) DEFAULT 0;
  END IF;
END $$;

-- Add services_included column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'services_included'
  ) THEN
    ALTER TABLE rentals ADD COLUMN services_included jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add check constraint for payment_timing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'rentals' AND constraint_name = 'rentals_payment_timing_check'
  ) THEN
    ALTER TABLE rentals ADD CONSTRAINT rentals_payment_timing_check
      CHECK (payment_timing IN ('beginning_of_period', 'end_of_period'));
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add check constraint for rental_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'rentals' AND constraint_name = 'rentals_rental_type_check'
  ) THEN
    ALTER TABLE rentals ADD CONSTRAINT rentals_rental_type_check
      CHECK (rental_type IN ('short_term', 'operational_leasing'));
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create index for filtering by rental_type
CREATE INDEX IF NOT EXISTS idx_rentals_rental_type ON rentals(rental_type);

-- Create index for filtering by payment_timing
CREATE INDEX IF NOT EXISTS idx_rentals_payment_timing ON rentals(payment_timing);