/*
  # Fix RLS Policies for Anonymous Access

  The original policies used FOR ALL which doesn't work well with anon role.
  This migration drops existing policies and creates explicit SELECT, INSERT, 
  UPDATE, DELETE policies for the anon role.

  Tables affected:
  - suppliers
  - customers  
  - partners
  - vehicles
  - vehicle_partners
  - loans
  - loan_payments
  - rentals
  - transactions
  - external_services
  - vehicle_sales
  - partner_transactions
  - company_settings
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all for suppliers" ON suppliers;
DROP POLICY IF EXISTS "Allow all for customers" ON customers;
DROP POLICY IF EXISTS "Allow all for partners" ON partners;
DROP POLICY IF EXISTS "Allow all for vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow all for vehicle_partners" ON vehicle_partners;
DROP POLICY IF EXISTS "Allow all for loans" ON loans;
DROP POLICY IF EXISTS "Allow all for loan_payments" ON loan_payments;
DROP POLICY IF EXISTS "Allow all for rentals" ON rentals;
DROP POLICY IF EXISTS "Allow all for transactions" ON transactions;
DROP POLICY IF EXISTS "Allow all for external_services" ON external_services;
DROP POLICY IF EXISTS "Allow all for vehicle_sales" ON vehicle_sales;
DROP POLICY IF EXISTS "Allow all for partner_transactions" ON partner_transactions;
DROP POLICY IF EXISTS "Allow all for company_settings" ON company_settings;

-- Suppliers policies
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO anon USING (true);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE TO anon USING (true);

-- Customers policies
CREATE POLICY "customers_select" ON customers FOR SELECT TO anon USING (true);
CREATE POLICY "customers_insert" ON customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "customers_update" ON customers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "customers_delete" ON customers FOR DELETE TO anon USING (true);

-- Partners policies
CREATE POLICY "partners_select" ON partners FOR SELECT TO anon USING (true);
CREATE POLICY "partners_insert" ON partners FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "partners_update" ON partners FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "partners_delete" ON partners FOR DELETE TO anon USING (true);

-- Vehicles policies
CREATE POLICY "vehicles_select" ON vehicles FOR SELECT TO anon USING (true);
CREATE POLICY "vehicles_insert" ON vehicles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "vehicles_update" ON vehicles FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "vehicles_delete" ON vehicles FOR DELETE TO anon USING (true);

-- Vehicle partners policies
CREATE POLICY "vehicle_partners_select" ON vehicle_partners FOR SELECT TO anon USING (true);
CREATE POLICY "vehicle_partners_insert" ON vehicle_partners FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "vehicle_partners_update" ON vehicle_partners FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "vehicle_partners_delete" ON vehicle_partners FOR DELETE TO anon USING (true);

-- Loans policies
CREATE POLICY "loans_select" ON loans FOR SELECT TO anon USING (true);
CREATE POLICY "loans_insert" ON loans FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "loans_update" ON loans FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "loans_delete" ON loans FOR DELETE TO anon USING (true);

-- Loan payments policies
CREATE POLICY "loan_payments_select" ON loan_payments FOR SELECT TO anon USING (true);
CREATE POLICY "loan_payments_insert" ON loan_payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "loan_payments_update" ON loan_payments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "loan_payments_delete" ON loan_payments FOR DELETE TO anon USING (true);

-- Rentals policies
CREATE POLICY "rentals_select" ON rentals FOR SELECT TO anon USING (true);
CREATE POLICY "rentals_insert" ON rentals FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "rentals_update" ON rentals FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "rentals_delete" ON rentals FOR DELETE TO anon USING (true);

-- Transactions policies
CREATE POLICY "transactions_select" ON transactions FOR SELECT TO anon USING (true);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "transactions_delete" ON transactions FOR DELETE TO anon USING (true);

-- External services policies
CREATE POLICY "external_services_select" ON external_services FOR SELECT TO anon USING (true);
CREATE POLICY "external_services_insert" ON external_services FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "external_services_update" ON external_services FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "external_services_delete" ON external_services FOR DELETE TO anon USING (true);

-- Vehicle sales policies
CREATE POLICY "vehicle_sales_select" ON vehicle_sales FOR SELECT TO anon USING (true);
CREATE POLICY "vehicle_sales_insert" ON vehicle_sales FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "vehicle_sales_update" ON vehicle_sales FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "vehicle_sales_delete" ON vehicle_sales FOR DELETE TO anon USING (true);

-- Partner transactions policies
CREATE POLICY "partner_transactions_select" ON partner_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "partner_transactions_insert" ON partner_transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "partner_transactions_update" ON partner_transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "partner_transactions_delete" ON partner_transactions FOR DELETE TO anon USING (true);

-- Company settings policies
CREATE POLICY "company_settings_select" ON company_settings FOR SELECT TO anon USING (true);
CREATE POLICY "company_settings_insert" ON company_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "company_settings_update" ON company_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "company_settings_delete" ON company_settings FOR DELETE TO anon USING (true);
