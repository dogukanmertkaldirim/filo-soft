/*
  # Add Vehicle Ownership & Sub-leasing Fields

  1. Modified Tables
    - `vehicles`
      - `ownership_type` (text) - 'oz_mal' (Owned) or 'kiralik' (Sub-leased/Sourced). Defaults to 'oz_mal'
      - `supplier_id` (uuid, nullable) - FK to suppliers table, for sub-leased vehicles
      - `supplier_cost_price` (numeric, nullable) - Monthly/daily cost paid to supplier
      - `supplier_cost_period` (text, nullable) - 'daily' or 'monthly' cost period
      - `supplier_start_date` (date, nullable) - Start of our lease with the supplier
      - `supplier_end_date` (date, nullable) - End of our lease with the supplier

  2. Notes
    - ownership_type defaults to 'oz_mal' so existing vehicles remain unchanged
    - supplier fields are only relevant when ownership_type = 'kiralik'
    - supplier_id references the existing suppliers table
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'ownership_type') THEN
    ALTER TABLE vehicles ADD COLUMN ownership_type text DEFAULT 'oz_mal' NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'supplier_id') THEN
    ALTER TABLE vehicles ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'supplier_cost_price') THEN
    ALTER TABLE vehicles ADD COLUMN supplier_cost_price numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'supplier_cost_period') THEN
    ALTER TABLE vehicles ADD COLUMN supplier_cost_period text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'supplier_start_date') THEN
    ALTER TABLE vehicles ADD COLUMN supplier_start_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'supplier_end_date') THEN
    ALTER TABLE vehicles ADD COLUMN supplier_end_date date;
  END IF;
END $$;
