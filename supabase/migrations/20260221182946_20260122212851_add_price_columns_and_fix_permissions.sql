/*
  # Add Missing Price Columns and Fix Permissions
  
  ## 1. Missing Columns
  - `monthly_price` (numeric): Monthly rental price for long-term contracts
  - `daily_price` (numeric): Daily rental price (alias for consistency)
  
  ## 2. Admin User Creation Function
  - Create `create_user_by_admin` RPC function
  
  ## 3. Vehicle and User RLS Fixes
  - Ensure all users have proper access
*/

-- =====================================================
-- PART 1: ADD MISSING PRICE COLUMNS
-- =====================================================

DO $$
BEGIN
  -- Add monthly_price column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'monthly_price'
  ) THEN
    ALTER TABLE rentals ADD COLUMN monthly_price numeric(12,2) DEFAULT 0;
    COMMENT ON COLUMN rentals.monthly_price IS 'Monthly rental price for long-term contracts';
  END IF;

  -- Add daily_price column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'daily_price'
  ) THEN
    ALTER TABLE rentals ADD COLUMN daily_price numeric(12,2) DEFAULT 0;
    COMMENT ON COLUMN rentals.daily_price IS 'Daily rental price (alias for daily_rate)';
  END IF;
END $$;

-- Sync daily_price with daily_rate for existing records
UPDATE rentals 
SET daily_price = daily_rate 
WHERE (daily_price IS NULL OR daily_price = 0) AND daily_rate > 0;

-- =====================================================
-- PART 2: ADMIN USER CREATION FUNCTION
-- =====================================================

DROP FUNCTION IF EXISTS create_user_by_admin(text, text, jsonb);

CREATE OR REPLACE FUNCTION create_user_by_admin(
  p_email text,
  p_password text,
  p_user_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_company_id uuid;
  v_full_name text;
BEGIN
  v_role := COALESCE(p_user_metadata->>'role', 'user');
  v_company_id := (p_user_metadata->>'company_id')::uuid;
  v_full_name := COALESCE(p_user_metadata->>'full_name', '');

  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email format');
  END IF;

  IF length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters');
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User with this email already exists');
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, recovery_token
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000', p_email,
    crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', v_full_name),
    'authenticated', 'authenticated', now(), now(), '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, p_email,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email),
    'email', now(), now(), now()
  );

  INSERT INTO app_users (id, email, full_name, role, company_id, is_active, created_at, updated_at)
  VALUES (v_user_id, p_email, v_full_name, v_role, v_company_id, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, full_name = EXCLUDED.full_name,
    role = EXCLUDED.role, company_id = EXCLUDED.company_id, updated_at = now();

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', p_email);

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'User with this email already exists');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION create_user_by_admin TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_by_admin TO anon;

-- =====================================================
-- PART 3: FIX VEHICLE RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Vehicles are viewable by authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Vehicles can be inserted by authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Vehicles can be updated by authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Vehicles can be deleted by authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Allow anon to view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow anon to insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow anon to update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow anon to delete vehicles" ON vehicles;

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_full_access_authenticated"
  ON vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "vehicles_full_access_anon"
  ON vehicles FOR ALL TO anon USING (true) WITH CHECK (true);

-- =====================================================
-- PART 4: FIX APP_USERS RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "app_users_select" ON app_users;
DROP POLICY IF EXISTS "app_users_insert" ON app_users;
DROP POLICY IF EXISTS "app_users_update" ON app_users;
DROP POLICY IF EXISTS "app_users_delete" ON app_users;
DROP POLICY IF EXISTS "Allow anon to view app_users" ON app_users;
DROP POLICY IF EXISTS "Allow anon to insert app_users" ON app_users;
DROP POLICY IF EXISTS "Allow anon to update app_users" ON app_users;
DROP POLICY IF EXISTS "Allow anon full access to app_users" ON app_users;

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_users_full_access_authenticated"
  ON app_users FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "app_users_full_access_anon"
  ON app_users FOR ALL TO anon USING (true) WITH CHECK (true);

-- =====================================================
-- PART 5: FIX RENTALS RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Rentals are viewable by authenticated users" ON rentals;
DROP POLICY IF EXISTS "Rentals can be inserted by authenticated users" ON rentals;
DROP POLICY IF EXISTS "Rentals can be updated by authenticated users" ON rentals;
DROP POLICY IF EXISTS "Rentals can be deleted by authenticated users" ON rentals;
DROP POLICY IF EXISTS "Allow anon to view rentals" ON rentals;
DROP POLICY IF EXISTS "Allow anon to insert rentals" ON rentals;
DROP POLICY IF EXISTS "Allow anon to update rentals" ON rentals;
DROP POLICY IF EXISTS "Allow anon to delete rentals" ON rentals;

ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rentals_full_access_authenticated"
  ON rentals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "rentals_full_access_anon"
  ON rentals FOR ALL TO anon USING (true) WITH CHECK (true);

-- =====================================================
-- PART 6: VEHICLE COUNTS HELPER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_vehicle_counts(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total integer;
  v_active integer;
  v_rented integer;
  v_maintenance integer;
  v_deleted integer;
BEGIN
  SELECT COUNT(*) INTO v_total FROM vehicles
  WHERE deleted_at IS NULL AND (p_company_id IS NULL OR company_id = p_company_id);

  SELECT COUNT(*) INTO v_active FROM vehicles
  WHERE status = 'active' AND deleted_at IS NULL AND (p_company_id IS NULL OR company_id = p_company_id);

  SELECT COUNT(*) INTO v_rented FROM vehicles
  WHERE status = 'rented' AND deleted_at IS NULL AND (p_company_id IS NULL OR company_id = p_company_id);

  SELECT COUNT(*) INTO v_maintenance FROM vehicles
  WHERE status = 'maintenance' AND deleted_at IS NULL AND (p_company_id IS NULL OR company_id = p_company_id);

  SELECT COUNT(*) INTO v_deleted FROM vehicles
  WHERE deleted_at IS NOT NULL AND (p_company_id IS NULL OR company_id = p_company_id);

  RETURN jsonb_build_object(
    'total', v_total, 'active', v_active, 'rented', v_rented,
    'maintenance', v_maintenance, 'deleted', v_deleted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_vehicle_counts TO authenticated, anon;