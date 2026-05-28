/*
  # Add Spare Key Tracking and Vehicle Sale Document Fields

  1. Modified Tables
    - `vehicles`
      - `has_spare_key` (boolean, default false) - Whether vehicle has a spare key
      - `spare_key_location` (text) - Where the spare key is stored
    - `vehicle_sales`
      - `notary_document_url` (text) - URL/base64 of notary sales document
      - `insurance_cancelled` (boolean, default false) - Traffic insurance cancellation status
      - `casco_cancelled` (boolean, default false) - Casco insurance cancellation status

  2. Notes
    - Spare key fields help track key inventory per vehicle
    - Sale document fields enable post-sale administrative tracking
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'has_spare_key'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN has_spare_key boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'spare_key_location'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN spare_key_location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_sales' AND column_name = 'notary_document_url'
  ) THEN
    ALTER TABLE vehicle_sales ADD COLUMN notary_document_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_sales' AND column_name = 'insurance_cancelled'
  ) THEN
    ALTER TABLE vehicle_sales ADD COLUMN insurance_cancelled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_sales' AND column_name = 'casco_cancelled'
  ) THEN
    ALTER TABLE vehicle_sales ADD COLUMN casco_cancelled boolean DEFAULT false;
  END IF;
END $$;
