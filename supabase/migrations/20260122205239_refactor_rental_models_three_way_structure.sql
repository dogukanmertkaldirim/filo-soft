/*
  # Refactor Rental Models - Three-Way Structure

  This migration transforms the rental system to support 3 distinct business models:
  
  ## 1. Changes Overview
  
  ### New ENUM Type
  - `rental_model_type`: 'rent_a_car', 'operational_leasing', 'financial_leasing'
  
  ### New Columns on `rentals` table
  - `rental_model` (rental_model_type): The rental business model type
  - `down_payment` (numeric): Down payment amount for financial leasing (Peşinat)
  - `monthly_km_limit` (integer): Monthly KM limit for long-term models
  - `daily_km_limit` (integer): Daily KM limit for short-term model
  - `transfer_ownership` (boolean): Whether ownership transfers at end (financial leasing)
  - `early_termination_logic` (text): Logic type for early termination calculations
  
  ## 2. Business Model Descriptions
  
  ### A. RENT A CAR (rent_a_car)
  - Short-term daily/weekly rentals
  - Uses daily pricing and daily KM limits
  - Standard rental rules apply
  
  ### B. OPERASYONEL KİRALAMA (operational_leasing)
  - Long-term fleet rental (6-60 months)
  - Car returns to company at contract end
  - Monthly pricing with monthly KM limits
  - Services typically included (maintenance, tires, insurance)
  
  ### C. FİNANSAL LEASING (financial_leasing)
  - Long-term ownership transfer model
  - Customer gains ownership at contract end
  - Requires down payment (peşinat)
  - Monthly pricing with optional KM limits
  - Services typically NOT included (negotiable)
  
  ## 3. Data Migration
  - Existing 'short_term' records → 'rent_a_car'
  - Existing 'operational_leasing' records → 'operational_leasing'
  
  ## 4. Security
  - No RLS changes required (uses existing policies)
*/

-- Create the new rental model enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rental_model_type') THEN
    CREATE TYPE rental_model_type AS ENUM (
      'rent_a_car',
      'operational_leasing', 
      'financial_leasing'
    );
  END IF;
END $$;

-- Add new columns to rentals table
DO $$
BEGIN
  -- Add rental_model column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'rental_model'
  ) THEN
    ALTER TABLE rentals ADD COLUMN rental_model rental_model_type DEFAULT 'rent_a_car';
  END IF;

  -- Add down_payment column (for financial leasing)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'down_payment'
  ) THEN
    ALTER TABLE rentals ADD COLUMN down_payment numeric(12,2) DEFAULT 0;
  END IF;

  -- Add monthly_km_limit column (for long-term models)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'monthly_km_limit'
  ) THEN
    ALTER TABLE rentals ADD COLUMN monthly_km_limit integer;
  END IF;

  -- Add daily_km_limit column (for short-term model)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'daily_km_limit'
  ) THEN
    ALTER TABLE rentals ADD COLUMN daily_km_limit integer;
  END IF;

  -- Add transfer_ownership column (for financial leasing)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'transfer_ownership'
  ) THEN
    ALTER TABLE rentals ADD COLUMN transfer_ownership boolean DEFAULT false;
  END IF;

  -- Add early_termination_logic column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'early_termination_logic'
  ) THEN
    ALTER TABLE rentals ADD COLUMN early_termination_logic text DEFAULT 'pro_rata_daily';
  END IF;
END $$;

-- Migrate existing data from rental_type to rental_model
UPDATE rentals 
SET rental_model = CASE 
  WHEN rental_type = 'short_term' THEN 'rent_a_car'::rental_model_type
  WHEN rental_type = 'operational_leasing' THEN 'operational_leasing'::rental_model_type
  ELSE 'rent_a_car'::rental_model_type
END
WHERE rental_model IS NULL OR rental_model = 'rent_a_car';

-- Set transfer_ownership for financial leasing records (none exist yet, but for future)
UPDATE rentals
SET transfer_ownership = true
WHERE rental_model = 'financial_leasing';

-- Add comments for documentation
COMMENT ON COLUMN rentals.rental_model IS 'Business model type: rent_a_car (short-term), operational_leasing (fleet), financial_leasing (ownership transfer)';
COMMENT ON COLUMN rentals.down_payment IS 'Down payment amount for financial leasing contracts (Peşinat)';
COMMENT ON COLUMN rentals.monthly_km_limit IS 'Monthly kilometer limit for long-term rental models';
COMMENT ON COLUMN rentals.daily_km_limit IS 'Daily kilometer limit for short-term rentals';
COMMENT ON COLUMN rentals.transfer_ownership IS 'Whether vehicle ownership transfers to customer at contract end (financial leasing only)';
COMMENT ON COLUMN rentals.early_termination_logic IS 'Logic for calculating early termination fees: pro_rata_daily (default)';

-- Create index for rental_model queries
CREATE INDEX IF NOT EXISTS idx_rentals_rental_model ON rentals(rental_model);

-- Create a function to calculate early termination fee (Pro-Rata Daily)
CREATE OR REPLACE FUNCTION calculate_early_return_fee(
  p_rental_id uuid,
  p_actual_return_date date
)
RETURNS TABLE (
  days_used_in_last_month integer,
  monthly_price numeric,
  pro_rata_fee numeric,
  total_months_completed integer,
  remaining_contract_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rental RECORD;
  v_start_date date;
  v_end_date date;
  v_monthly_price numeric;
  v_days_in_month integer;
  v_days_used integer;
  v_months_completed integer;
  v_remaining_months integer;
BEGIN
  -- Get rental details
  SELECT * INTO v_rental FROM rentals WHERE id = p_rental_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rental not found';
  END IF;
  
  v_start_date := v_rental.start_date::date;
  v_end_date := v_rental.end_date::date;
  v_monthly_price := COALESCE(v_rental.monthly_price, 0);
  
  -- Calculate months completed
  v_months_completed := EXTRACT(YEAR FROM age(p_actual_return_date, v_start_date)) * 12 
                       + EXTRACT(MONTH FROM age(p_actual_return_date, v_start_date));
  
  -- Calculate days used in the last (partial) month
  -- Get the start of the current billing month
  v_days_in_month := 30; -- Standard month for billing
  v_days_used := EXTRACT(DAY FROM p_actual_return_date) - 
                 EXTRACT(DAY FROM (v_start_date + (v_months_completed || ' months')::interval));
  
  IF v_days_used < 0 THEN
    v_days_used := v_days_used + v_days_in_month;
  END IF;
  
  -- Calculate remaining contract value
  v_remaining_months := GREATEST(0, v_rental.contract_months - v_months_completed - 1);
  
  RETURN QUERY SELECT 
    v_days_used::integer,
    v_monthly_price,
    ROUND((v_monthly_price / 30) * v_days_used, 2) as pro_rata_fee,
    v_months_completed::integer,
    (v_remaining_months * v_monthly_price)::numeric as remaining_contract_value;
END;
$$;