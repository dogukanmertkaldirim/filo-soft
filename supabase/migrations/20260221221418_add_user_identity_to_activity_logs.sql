/*
  # Add User Identity to Activity Logs

  1. Modified Tables
    - `activity_logs`
      - `user_id` (uuid) - The auth user ID who performed the action
      - `user_name` (text) - The display name of the user (cached for fast display)

  2. Notes
    - user_name is denormalized for performance (avoids joins on every log query)
    - user_email column is kept for backward compatibility
    - Existing logs without user_id/user_name will show user_email as fallback
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE activity_logs ADD COLUMN user_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'user_name'
  ) THEN
    ALTER TABLE activity_logs ADD COLUMN user_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_created ON activity_logs(company_id, created_at DESC);
