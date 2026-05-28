/*
  # Create Missing Base Tables
  
  1. New Tables
    - `maintenances` - Vehicle maintenance records
    - `reservations` - Vehicle reservation records
  
  2. Security
    - Enable RLS on both tables
    - Add permissive policies for anon access
*/

CREATE TABLE IF NOT EXISTS maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  entry_date date NOT NULL,
  return_date date,
  current_km numeric,
  cost numeric(15,2) DEFAULT 0,
  description text,
  next_maintenance_km numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for maintenances" ON maintenances FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for reservations" ON reservations FOR ALL USING (true) WITH CHECK (true);