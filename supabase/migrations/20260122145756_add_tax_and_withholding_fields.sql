/*
  # Add Tax and Withholding (Tevkifat) Support for Rentals

  This migration adds financial calculation fields to support real-world
  Turkish tax scenarios including KDV (VAT) and Tevkifat (Withholding Tax).

  ## 1. Changes to Rentals Table
    - `tax_rate` (integer) - VAT rate: 0, 1, 10, or 20 percent
    - `withholding_rate` (text) - Tevkifat rate: 'none', '5/10', '7/10', '9/10', 'full_exemption'
    - `currency` (text) - Currency code, default 'TRY'

  ## 2. Changes to rental_payment_schedules Table
    - `net_amount` (numeric) - Base rental price before tax
    - `tax_amount` (numeric) - Calculated VAT amount
    - `withholding_deduction` (numeric) - Amount deducted due to Tevkifat
    - `total_payable` (numeric) - Final amount customer owes (Net + Tax - Withholding)

  ## 3. Calculation Logic
    - Tax = Net * (tax_rate / 100)
    - Withholding Deduction = Tax * (withholding_fraction)
    - Total Payable = Net + Tax - Withholding Deduction

  ## 4. Withholding Rate Fractions
    - '5/10' = 0.5 (50% of VAT withheld)
    - '7/10' = 0.7 (70% of VAT withheld)
    - '9/10' = 0.9 (90% of VAT withheld)
    - 'full_exemption' = 1.0 (100% of VAT withheld, customer pays all to state)

  ## 5. Safety
    - Existing rentals default to tax_rate=0 to preserve historical accuracy
    - Existing schedules get calculated fields based on current amount
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE rentals ADD COLUMN tax_rate integer DEFAULT 0 CHECK (tax_rate IN (0, 1, 10, 20));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'withholding_rate'
  ) THEN
    ALTER TABLE rentals ADD COLUMN withholding_rate text DEFAULT 'none' CHECK (withholding_rate IN ('none', '5/10', '7/10', '9/10', 'full_exemption'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'currency'
  ) THEN
    ALTER TABLE rentals ADD COLUMN currency text DEFAULT 'TRY';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_payment_schedules' AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE rental_payment_schedules ADD COLUMN net_amount numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_payment_schedules' AND column_name = 'tax_amount'
  ) THEN
    ALTER TABLE rental_payment_schedules ADD COLUMN tax_amount numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_payment_schedules' AND column_name = 'withholding_deduction'
  ) THEN
    ALTER TABLE rental_payment_schedules ADD COLUMN withholding_deduction numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rental_payment_schedules' AND column_name = 'total_payable'
  ) THEN
    ALTER TABLE rental_payment_schedules ADD COLUMN total_payable numeric DEFAULT 0;
  END IF;
END $$;

UPDATE rentals 
SET tax_rate = 0, withholding_rate = 'none', currency = 'TRY' 
WHERE tax_rate IS NULL;

UPDATE rental_payment_schedules
SET 
  net_amount = amount,
  tax_amount = 0,
  withholding_deduction = 0,
  total_payable = amount
WHERE net_amount IS NULL OR net_amount = 0;