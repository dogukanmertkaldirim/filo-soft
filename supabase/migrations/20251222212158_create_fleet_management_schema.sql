/*
  # Fleet Management Dashboard Schema

  1. New Tables
    - `company_settings` - Stores company logo and settings
    - `partners` - Business partners with share tracking
    - `vehicles` - Vehicle inventory with all details
    - `vehicle_partners` - Many-to-many for vehicle ownership shares
    - `customers` - Customer information with documents
    - `rentals` - Rental contracts linking vehicles to customers
    - `loans` - Loans for vehicles or capital purposes
    - `loan_payments` - Individual loan payment records
    - `transactions` - Financial transactions (income/expense)
    - `external_services` - VIP Transfer & Logistics services
    - `vehicle_sales` - Records of sold vehicles
    - `suppliers` - Suppliers for external services

  2. Security
    - RLS enabled on all tables
    - Policies for authenticated users
*/

-- Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  company_name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partners Table
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  notes text,
  total_balance numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_title text NOT NULL,
  authorized_person text,
  tax_id text,
  email text,
  address text,
  tax_plate_url text,
  signature_circular_url text,
  trade_registry_url text,
  findeks_report_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  service_types text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL UNIQUE,
  brand text NOT NULL,
  model text NOT NULL,
  year integer,
  color text,
  photo_url text,
  license_owner text,
  license_document_url text,
  initial_damage_status text,
  purchase_price numeric(15,2) DEFAULT 0,
  purchase_date date,
  status text DEFAULT 'idle' CHECK (status IN ('idle', 'rented', 'sold', 'maintenance')),
  
  -- Insurance Info
  traffic_insurance_expiry date,
  traffic_insurance_agency text,
  traffic_insurance_agent_name text,
  traffic_insurance_agent_phone text,
  traffic_insurance_amount numeric(15,2),
  traffic_insurance_policy_url text,
  
  -- Kasko (Full Coverage)
  kasko_expiry date,
  kasko_agency text,
  kasko_agent_name text,
  kasko_agent_phone text,
  kasko_amount numeric(15,2),
  kasko_policy_url text,
  
  -- Inspection
  inspection_expiry date,
  
  -- Tires
  tire_type text CHECK (tire_type IN ('summer', 'winter', 'all_season')),
  tire_size text,
  tire_brand text,
  spare_tire_location text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vehicle Partners (Ownership Shares)
CREATE TABLE IF NOT EXISTS vehicle_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  share_percentage numeric(5,2) NOT NULL CHECK (share_percentage >= 0 AND share_percentage <= 100),
  created_at timestamptz DEFAULT now(),
  UNIQUE(vehicle_id, partner_id)
);

-- Loans Table
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_type text NOT NULL CHECK (loan_type IN ('vehicle', 'capital')),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  owner_partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  bank text NOT NULL,
  maturity_date date NOT NULL,
  total_amount numeric(15,2) NOT NULL,
  installment_count integer NOT NULL,
  payment_day integer NOT NULL CHECK (payment_day >= 1 AND payment_day <= 31),
  installment_amount numeric(15,2) NOT NULL,
  total_payback_amount numeric(15,2) NOT NULL,
  remaining_debt numeric(15,2) NOT NULL,
  capital_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Loan Payments Table
CREATE TABLE IF NOT EXISTS loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES loans(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  amount numeric(15,2) NOT NULL,
  is_paid boolean DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Rentals Table
CREATE TABLE IF NOT EXISTS rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  daily_rate numeric(15,2) NOT NULL,
  total_amount numeric(15,2) NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Transactions Table (Finance)
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  description text,
  amount numeric(15,2) NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  loan_id uuid REFERENCES loans(id) ON DELETE SET NULL,
  rental_id uuid REFERENCES rentals(id) ON DELETE SET NULL,
  external_service_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- External Services (VIP Transfer & Logistics)
CREATE TABLE IF NOT EXISTS external_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL CHECK (service_type IN ('transfer', 'logistics', 'car_rental')),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  service_date date NOT NULL,
  description text,
  cost numeric(15,2) NOT NULL DEFAULT 0,
  revenue numeric(15,2) NOT NULL DEFAULT 0,
  profit numeric(15,2) GENERATED ALWAYS AS (revenue - cost) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key for external_service_id in transactions
ALTER TABLE transactions 
ADD CONSTRAINT fk_external_service 
FOREIGN KEY (external_service_id) REFERENCES external_services(id) ON DELETE SET NULL;

-- Vehicle Sales Table
CREATE TABLE IF NOT EXISTS vehicle_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  sale_date date NOT NULL,
  sale_amount numeric(15,2) NOT NULL,
  buyer_name text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Partner Transactions (Ledger for detailed tracking)
CREATE TABLE IF NOT EXISTS partner_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  description text NOT NULL,
  amount numeric(15,2) NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  loan_id uuid REFERENCES loans(id) ON DELETE SET NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for all tables (allowing all operations for now - can be restricted later)
CREATE POLICY "Allow all for company_settings" ON company_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for partners" ON partners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for vehicle_partners" ON vehicle_partners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for loans" ON loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for loan_payments" ON loan_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for rentals" ON rentals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for external_services" ON external_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for vehicle_sales" ON vehicle_sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for partner_transactions" ON partner_transactions FOR ALL USING (true) WITH CHECK (true);

-- Insert default company settings
INSERT INTO company_settings (id, company_name) VALUES (gen_random_uuid(), 'Fleet Management Co.');
