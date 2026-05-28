/*
  # Add missing columns to app_users table

  1. Problem
    - The `admin_create_user` RPC and frontend forms reference columns
      that do not exist on the `app_users` table: `phone`, `title`, `updated_at`
    - Inserting a user with a phone number fails with:
      "column phone of relation app_users does not exist"

  2. New Columns
    - `phone` (text, nullable) - User phone number
    - `title` (text, nullable) - User job title or company name
    - `updated_at` (timestamptz, default now()) - Last update timestamp

  3. Security
    - No RLS changes needed (existing policies cover all columns)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'phone' AND table_schema = 'public'
  ) THEN
    ALTER TABLE app_users ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'title' AND table_schema = 'public'
  ) THEN
    ALTER TABLE app_users ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_users' AND column_name = 'updated_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE app_users ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
