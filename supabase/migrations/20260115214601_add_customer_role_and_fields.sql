/*
  # Add Customer Role and Email Field to App Users

  1. Changes
    - Add 'customer' and 'staff' roles to the role check constraint
    - Add `email` column for customer users
    - Add `linked_vehicle_ids` array for customer vehicle assignments

  2. Security
    - Existing RLS policies remain in place
*/

-- First, drop the existing check constraint and recreate with new roles
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;

ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
  CHECK (role IN ('super_admin', 'admin', 'staff', 'user', 'customer'));

-- Add email column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'email'
  ) THEN
    ALTER TABLE app_users ADD COLUMN email text;
  END IF;
END $$;

-- Add linked_vehicle_ids column for customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'linked_vehicle_ids'
  ) THEN
    ALTER TABLE app_users ADD COLUMN linked_vehicle_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- Add index for role queries
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
