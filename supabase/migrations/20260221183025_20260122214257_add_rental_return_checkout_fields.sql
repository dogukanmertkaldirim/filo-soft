/*
  # Add Rental Return/Checkout Fields

  1. New Columns on `rentals` table
    - `return_fuel_level` (integer, 0-100) - Fuel level at vehicle return
    - `end_km` (integer) - Odometer reading at return
    - `fuel_fee` (decimal) - Charge for fuel difference
    - `cleaning_fee` (decimal) - Vehicle cleaning/wash fee
    - `damage_fee` (decimal) - Damage repair charges
    - `extra_km_fee` (decimal) - Overage fee for exceeding km limit
    - `other_fee` (decimal) - Miscellaneous additional charges
    - `total_extra_charges` (decimal) - Sum of all extra fees
    - `return_notes` (text) - Notes about vehicle condition at return
    - `extra_charges_payment_method` (text) - How extra charges were handled

  2. Purpose
    - Enable comprehensive vehicle return checkout flow
    - Track all end-of-rental fees and charges
    - Support multiple payment options for extra charges
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'return_fuel_level'
  ) THEN
    ALTER TABLE rentals ADD COLUMN return_fuel_level integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'end_km'
  ) THEN
    ALTER TABLE rentals ADD COLUMN end_km integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'fuel_fee'
  ) THEN
    ALTER TABLE rentals ADD COLUMN fuel_fee decimal(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'cleaning_fee'
  ) THEN
    ALTER TABLE rentals ADD COLUMN cleaning_fee decimal(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'damage_fee'
  ) THEN
    ALTER TABLE rentals ADD COLUMN damage_fee decimal(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'extra_km_fee'
  ) THEN
    ALTER TABLE rentals ADD COLUMN extra_km_fee decimal(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'other_fee'
  ) THEN
    ALTER TABLE rentals ADD COLUMN other_fee decimal(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'total_extra_charges'
  ) THEN
    ALTER TABLE rentals ADD COLUMN total_extra_charges decimal(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'return_notes'
  ) THEN
    ALTER TABLE rentals ADD COLUMN return_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'extra_charges_payment_method'
  ) THEN
    ALTER TABLE rentals ADD COLUMN extra_charges_payment_method text;
  END IF;
END $$;

COMMENT ON COLUMN rentals.return_fuel_level IS 'Fuel level percentage (0-100) at vehicle return';
COMMENT ON COLUMN rentals.end_km IS 'Odometer reading at vehicle return';
COMMENT ON COLUMN rentals.fuel_fee IS 'Charge for fuel difference between checkout and return';
COMMENT ON COLUMN rentals.cleaning_fee IS 'Vehicle cleaning/washing fee';
COMMENT ON COLUMN rentals.damage_fee IS 'Charges for any damage found at return';
COMMENT ON COLUMN rentals.extra_km_fee IS 'Overage fee for exceeding daily/monthly km limit';
COMMENT ON COLUMN rentals.other_fee IS 'Miscellaneous additional charges';
COMMENT ON COLUMN rentals.total_extra_charges IS 'Sum of all extra fees at return';
COMMENT ON COLUMN rentals.extra_charges_payment_method IS 'How extra charges were settled: add_to_debt, deduct_deposit, paid_cash, paid_card';