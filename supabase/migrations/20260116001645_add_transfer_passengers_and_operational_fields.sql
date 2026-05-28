/*
  # Add Transfer Passengers Table and Operational Fields

  1. New Tables
    - `transfer_passengers`
      - `id` (uuid, primary key)
      - `transfer_request_id` (uuid, foreign key to transfer_requests)
      - `full_name` (text) - Passenger full name
      - `tc_identity_number` (text) - TC Kimlik number for seat insurance
      - `created_at` (timestamp)

  2. Changes to `transfer_requests`
    - `assigned_plate` (text) - Vehicle plate number assigned by admin
    - `assigned_driver_name` (text) - Driver name
    - `assigned_driver_phone` (text) - Driver phone for contact
    - `vehicle_color` (text) - Vehicle color (e.g., "Black")
    - `meeting_point_note` (text) - Meeting point instructions (e.g., "Gate 9")
    - `passengers_submitted_at` (timestamp) - When customer submitted passenger list

  3. Security
    - Enable RLS on transfer_passengers
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS transfer_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_request_id uuid NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  tc_identity_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transfer_passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transfer passengers"
  ON transfer_passengers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert transfer passengers"
  ON transfer_passengers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update transfer passengers"
  ON transfer_passengers FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete transfer passengers"
  ON transfer_passengers FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can view transfer passengers"
  ON transfer_passengers FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert transfer passengers"
  ON transfer_passengers FOR INSERT
  TO anon
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfer_requests' AND column_name = 'assigned_plate'
  ) THEN
    ALTER TABLE transfer_requests ADD COLUMN assigned_plate text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfer_requests' AND column_name = 'assigned_driver_name'
  ) THEN
    ALTER TABLE transfer_requests ADD COLUMN assigned_driver_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfer_requests' AND column_name = 'assigned_driver_phone'
  ) THEN
    ALTER TABLE transfer_requests ADD COLUMN assigned_driver_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfer_requests' AND column_name = 'vehicle_color'
  ) THEN
    ALTER TABLE transfer_requests ADD COLUMN vehicle_color text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfer_requests' AND column_name = 'meeting_point_note'
  ) THEN
    ALTER TABLE transfer_requests ADD COLUMN meeting_point_note text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfer_requests' AND column_name = 'passengers_submitted_at'
  ) THEN
    ALTER TABLE transfer_requests ADD COLUMN passengers_submitted_at timestamptz;
  END IF;
END $$;