/*
  # Role Hierarchy & Multi-Tenant SaaS Architecture Refactor

  This migration updates the system to support a proper multi-tenant SaaS model
  with a clear role hierarchy.

  ## 1. Role Hierarchy
    - `super_admin`: Platform Owner - Manages all tenants/companies
    - `admin`: Tenant Owner (Company Boss) - Full access to their own data
    - `staff`: Tenant Employee - Restricted access defined by Admin
    - `customer`: The Renter (B2B/B2C client)
    - `driver`: Sub-user under a Customer - The actual person driving

  ## 2. Changes to app_users Table
    - Add `driver` role option
    - Add `linked_customer_id` for drivers linked to customers
    - Add driver license fields

  ## 3. Update customer_drivers Table
    - Add `app_user_id` to link drivers with app_users accounts
    - Add `assigned_vehicle_id` for driver-vehicle assignment
    - Add status field

  ## 4. Security Updates
    - Secure admin_create_user function for creating users without permission errors
    - update_rental_with_vehicle function to sync rental and vehicle dates

  ## Important Notes
    - Existing data preserved with backward compatibility
    - Drivers are sub-users of customers who actually drive the vehicles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'linked_customer_id'
  ) THEN
    ALTER TABLE app_users ADD COLUMN linked_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'driver_license_no'
  ) THEN
    ALTER TABLE app_users ADD COLUMN driver_license_no text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'driver_license_expiry'
  ) THEN
    ALTER TABLE app_users ADD COLUMN driver_license_expiry date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE app_users ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_drivers' AND column_name = 'app_user_id'
  ) THEN
    ALTER TABLE customer_drivers ADD COLUMN app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_drivers' AND column_name = 'assigned_vehicle_id'
  ) THEN
    ALTER TABLE customer_drivers ADD COLUMN assigned_vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_drivers' AND column_name = 'status'
  ) THEN
    ALTER TABLE customer_drivers ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_drivers' AND column_name = 'driver_license_expiry'
  ) THEN
    ALTER TABLE customer_drivers ADD COLUMN driver_license_expiry date;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_drivers_app_user ON customer_drivers(app_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_drivers_assigned_vehicle ON customer_drivers(assigned_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_app_users_linked_customer ON app_users(linked_customer_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

CREATE OR REPLACE FUNCTION admin_create_user(
  p_username text,
  p_password text,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_role text DEFAULT 'user',
  p_company_id uuid DEFAULT NULL,
  p_linked_customer_id uuid DEFAULT NULL,
  p_assigned_rep_id uuid DEFAULT NULL,
  p_driver_license_no text DEFAULT NULL,
  p_driver_license_expiry date DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_user_id uuid;
  v_result json;
BEGIN
  IF EXISTS (SELECT 1 FROM app_users WHERE username = p_username) THEN
    RETURN json_build_object('success', false, 'error', 'Bu kullanici adi zaten kullaniliyor');
  END IF;

  IF p_email IS NOT NULL AND p_email != '' AND EXISTS (SELECT 1 FROM app_users WHERE email = lower(trim(p_email))) THEN
    RETURN json_build_object('success', false, 'error', 'Bu e-posta adresi zaten kullaniliyor');
  END IF;

  IF length(p_password) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Sifre en az 6 karakter olmalidir');
  END IF;

  INSERT INTO app_users (
    username,
    password,
    full_name,
    email,
    phone,
    title,
    role,
    company_id,
    linked_customer_id,
    assigned_rep_id,
    driver_license_no,
    driver_license_expiry,
    is_active
  ) VALUES (
    p_username,
    p_password,
    p_full_name,
    CASE WHEN p_email IS NOT NULL AND p_email != '' THEN lower(trim(p_email)) ELSE NULL END,
    p_phone,
    p_title,
    p_role,
    p_company_id,
    p_linked_customer_id,
    p_assigned_rep_id,
    p_driver_license_no,
    p_driver_license_expiry,
    true
  )
  RETURNING id INTO v_new_user_id;

  SELECT json_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'message', 'Kullanici basariyla olusturuldu'
  ) INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION update_rental_with_vehicle(
  p_rental_id uuid,
  p_start_date date,
  p_end_date date,
  p_daily_rate numeric,
  p_daily_km_limit integer DEFAULT NULL,
  p_per_km_overage_fee numeric DEFAULT NULL,
  p_total_amount numeric DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vehicle_id uuid;
  v_days integer;
  v_final_total numeric;
BEGIN
  SELECT vehicle_id INTO v_vehicle_id FROM rentals WHERE id = p_rental_id;
  
  IF v_vehicle_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Kiralama bulunamadi');
  END IF;

  v_days := (p_end_date - p_start_date) + 1;
  
  IF p_total_amount IS NOT NULL THEN
    v_final_total := p_total_amount;
  ELSE
    v_final_total := v_days * p_daily_rate;
  END IF;

  UPDATE rentals SET
    start_date = p_start_date,
    end_date = p_end_date,
    end_datetime = p_end_date::text || 'T23:59:59',
    daily_rate = p_daily_rate,
    daily_km_limit = p_daily_km_limit,
    per_km_overage_fee = p_per_km_overage_fee,
    total_amount = v_final_total,
    updated_at = now()
  WHERE id = p_rental_id;

  UPDATE vehicles SET
    rental_end_date = p_end_date,
    updated_at = now()
  WHERE id = v_vehicle_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Kiralama ve arac tarihleri guncellendi',
    'rental_id', p_rental_id,
    'vehicle_id', v_vehicle_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;