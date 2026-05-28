/*
  # Create admin_create_user RPC Function
  
  Allows admins to create users with full profile details.
  
  ## Parameters
  All parameters match what Users.tsx expects.
  
  ## Security
  - SECURITY DEFINER to bypass RLS and create auth.users records
*/

CREATE OR REPLACE FUNCTION admin_create_user(
  p_username text,
  p_password text,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_role text DEFAULT 'user',
  p_company_id uuid DEFAULT NULL,
  p_assigned_rep_id uuid DEFAULT NULL,
  p_driver_license_no text DEFAULT NULL,
  p_driver_license_expiry date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username is required');
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters');
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Full name is required');
  END IF;

  IF EXISTS(SELECT 1 FROM app_users WHERE username = p_username) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu kullanici adi zaten kullaniliyor');
  END IF;

  v_email := COALESCE(NULLIF(trim(p_email), ''), p_username || '@internal.fleet.local');

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu e-posta adresi zaten kullaniliyor');
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, recovery_token
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000', v_email,
    crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', p_full_name, 'username', p_username),
    'authenticated', 'authenticated', now(), now(), '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_email,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email', now(), now(), now()
  );

  INSERT INTO app_users (
    id, username, email, full_name, phone, title, role, company_id,
    assigned_rep_id, driver_license_no, driver_license_expiry, is_active, created_at, updated_at
  ) VALUES (
    v_user_id, p_username, v_email, p_full_name,
    NULLIF(trim(p_phone), ''), NULLIF(trim(p_title), ''), p_role, p_company_id,
    p_assigned_rep_id, NULLIF(trim(p_driver_license_no), ''), p_driver_license_expiry,
    true, now(), now()
  );

  RETURN jsonb_build_object(
    'success', true, 'user_id', v_user_id, 'username', p_username, 'email', v_email
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanici adi veya e-posta zaten kullaniliyor');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user TO anon;
