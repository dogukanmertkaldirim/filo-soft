/*
  # SaaS Administration Tables

  1. New Tables
    - `subscription_plans`
      - `id` (uuid, primary key)
      - `name` (text) - Plan name (Basic, Pro, Enterprise)
      - `description` (text) - Plan description
      - `price_monthly` (numeric) - Monthly price
      - `price_yearly` (numeric) - Yearly price
      - `max_vehicles` (integer) - Vehicle limit
      - `max_users` (integer) - User limit
      - `features` (jsonb) - Available features/modules
      - `is_active` (boolean) - Plan availability
      - `created_at`, `updated_at` (timestamptz)
    
    - `system_logs`
      - `id` (uuid, primary key)
      - `level` (text) - error, warning, info
      - `message` (text) - Log message
      - `details` (jsonb) - Additional details
      - `company_id` (uuid) - Related company if applicable
      - `user_id` (uuid) - Related user if applicable
      - `created_at` (timestamptz)

  2. Changes to `companies` table
    - Add `subscription_plan_id` (uuid) - FK to subscription_plans
    - Add `is_suspended` (boolean) - Suspend access
    - Add `suspended_at` (timestamptz)
    - Add `suspended_reason` (text)
    - Add `owner_name` (text)
    - Add `owner_email` (text)
    - Add `billing_email` (text)
    - Add `subscription_start_date` (date)
    - Add `subscription_end_date` (date)
    - Add `total_revenue` (numeric) - Track revenue from this tenant

  3. Security
    - RLS policies for super_admin access only
*/

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_monthly numeric(10, 2) DEFAULT 0,
  price_yearly numeric(10, 2) DEFAULT 0,
  max_vehicles integer DEFAULT 10,
  max_users integer DEFAULT 5,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage subscription plans"
  ON subscription_plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'super_admin'
    )
  );

CREATE POLICY "Anon can read subscription plans"
  ON subscription_plans
  FOR SELECT
  TO anon
  USING (true);

-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  user_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_company_id ON system_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all system logs"
  ON system_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'super_admin'
    )
  );

CREATE POLICY "Anon can insert system logs"
  ON system_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert system logs"
  ON system_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add new columns to companies table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'subscription_plan_id') THEN
    ALTER TABLE companies ADD COLUMN subscription_plan_id uuid REFERENCES subscription_plans(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'is_suspended') THEN
    ALTER TABLE companies ADD COLUMN is_suspended boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'suspended_at') THEN
    ALTER TABLE companies ADD COLUMN suspended_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'suspended_reason') THEN
    ALTER TABLE companies ADD COLUMN suspended_reason text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'owner_name') THEN
    ALTER TABLE companies ADD COLUMN owner_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'owner_email') THEN
    ALTER TABLE companies ADD COLUMN owner_email text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'billing_email') THEN
    ALTER TABLE companies ADD COLUMN billing_email text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'subscription_start_date') THEN
    ALTER TABLE companies ADD COLUMN subscription_start_date date;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'subscription_end_date') THEN
    ALTER TABLE companies ADD COLUMN subscription_end_date date;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'total_revenue') THEN
    ALTER TABLE companies ADD COLUMN total_revenue numeric(12, 2) DEFAULT 0;
  END IF;
END $$;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_vehicles, max_users, features, sort_order)
VALUES 
  ('Basic', 'Kucuk filolar icin temel ozellikler', 299, 2990, 10, 3, '["vehicles", "customers", "rentals", "reports"]', 1),
  ('Pro', 'Orta olcekli filolar icin gelismis ozellikler', 599, 5990, 50, 10, '["vehicles", "customers", "rentals", "reports", "finance", "maintenance", "calendar", "integrations"]', 2),
  ('Enterprise', 'Buyuk filolar icin tam ozellik seti', 999, 9990, -1, -1, '["vehicles", "customers", "rentals", "reports", "finance", "maintenance", "calendar", "integrations", "transfers", "loans", "external_services", "api_access"]', 3)
ON CONFLICT DO NOTHING;

-- Create function for super admin to impersonate a company
CREATE OR REPLACE FUNCTION impersonate_company(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_company_record record;
BEGIN
  SELECT role INTO v_user_role
  FROM app_users
  WHERE id = auth.uid();
  
  IF v_user_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can impersonate');
  END IF;
  
  SELECT * INTO v_company_record
  FROM companies
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found');
  END IF;
  
  INSERT INTO system_logs (level, message, details, company_id, user_id)
  VALUES ('info', 'Super admin started impersonation', jsonb_build_object('company_name', v_company_record.name), p_company_id, auth.uid());
  
  RETURN jsonb_build_object(
    'success', true,
    'company', jsonb_build_object(
      'id', v_company_record.id,
      'name', v_company_record.name,
      'active_modules', v_company_record.active_modules
    )
  );
END;
$$;

-- Create function to toggle company suspension
CREATE OR REPLACE FUNCTION toggle_company_suspension(p_company_id uuid, p_suspend boolean, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
BEGIN
  SELECT role INTO v_user_role
  FROM app_users
  WHERE id = auth.uid();
  
  IF v_user_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can suspend companies');
  END IF;
  
  UPDATE companies
  SET 
    is_suspended = p_suspend,
    suspended_at = CASE WHEN p_suspend THEN now() ELSE NULL END,
    suspended_reason = CASE WHEN p_suspend THEN p_reason ELSE NULL END,
    updated_at = now()
  WHERE id = p_company_id;
  
  INSERT INTO system_logs (level, message, details, company_id, user_id)
  VALUES (
    'warning',
    CASE WHEN p_suspend THEN 'Company suspended' ELSE 'Company reactivated' END,
    jsonb_build_object('reason', p_reason),
    p_company_id,
    auth.uid()
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create function to update company modules
CREATE OR REPLACE FUNCTION update_company_modules(p_company_id uuid, p_modules text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
BEGIN
  SELECT role INTO v_user_role
  FROM app_users
  WHERE id = auth.uid();
  
  IF v_user_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can update modules');
  END IF;
  
  UPDATE companies
  SET 
    active_modules = p_modules,
    updated_at = now()
  WHERE id = p_company_id;
  
  INSERT INTO system_logs (level, message, details, company_id, user_id)
  VALUES ('info', 'Company modules updated', jsonb_build_object('modules', p_modules), p_company_id, auth.uid());
  
  RETURN jsonb_build_object('success', true);
END;
$$;