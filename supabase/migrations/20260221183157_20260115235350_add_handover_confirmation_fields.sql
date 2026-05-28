/*
  # Create vehicle_handovers table and add confirmation fields
  
  1. New Tables
    - `vehicle_handovers` - Tracks vehicle delivery/return handover records
  
  2. Security
    - Enable RLS on vehicle_handovers
    - Add permissive policies
*/

CREATE TABLE IF NOT EXISTS vehicle_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES rentals(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  handover_type text NOT NULL DEFAULT 'delivery' CHECK (handover_type IN ('delivery', 'return')),
  handover_date timestamptz DEFAULT now(),
  km_reading numeric,
  fuel_level text,
  damage_notes text,
  photos jsonb DEFAULT '[]'::jsonb,
  is_confirmed boolean DEFAULT false,
  confirmed_at timestamptz,
  notes text,
  company_id uuid REFERENCES companies(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for vehicle_handovers" ON vehicle_handovers FOR ALL USING (true) WITH CHECK (true);