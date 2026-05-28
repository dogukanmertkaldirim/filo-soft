/*
  # Add Vehicle Photos Table and Tracker Fields

  1. New Tables
    - `vehicle_photos`
      - `id` (uuid, primary key)
      - `vehicle_id` (uuid, foreign key to vehicles)
      - `photo_url` (text, required)
      - `display_order` (integer, for sorting)
      - `company_id` (uuid, for multi-tenancy)
      - `created_at` (timestamp)

  2. Modified Tables
    - `vehicles`
      - Add `has_tracker` (boolean)
      - Add `tracker_model` (text)
      - Add `tracker_serial_number` (text)

  3. Security
    - Enable RLS on `vehicle_photos` table
    - Add policies for CRUD operations
*/

-- Create vehicle_photos table
CREATE TABLE IF NOT EXISTS vehicle_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  display_order integer DEFAULT 0,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_photos
CREATE POLICY "vehicle_photos_select_policy"
  ON vehicle_photos
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "vehicle_photos_insert_policy"
  ON vehicle_photos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "vehicle_photos_update_policy"
  ON vehicle_photos
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "vehicle_photos_delete_policy"
  ON vehicle_photos
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Add tracker fields to vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'has_tracker'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN has_tracker boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'tracker_model'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN tracker_model text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'tracker_serial_number'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN tracker_serial_number text;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle_id ON vehicle_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_company_id ON vehicle_photos(company_id);
