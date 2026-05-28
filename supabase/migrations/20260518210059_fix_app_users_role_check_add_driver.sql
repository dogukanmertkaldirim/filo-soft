/*
  # Fix app_users role check constraint - Add driver role

  1. Problem
    - The `app_users_role_check` constraint only allows:
      super_admin, admin, staff, user, customer
    - The 'driver' role is missing, causing insert failures

  2. Fix
    - Drop the existing constraint
    - Recreate it with 'driver' included in the allowed values

  3. No Data Loss
    - Only modifying the CHECK constraint, no data changes
*/

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;

ALTER TABLE app_users ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('super_admin', 'admin', 'staff', 'user', 'customer', 'driver'));
