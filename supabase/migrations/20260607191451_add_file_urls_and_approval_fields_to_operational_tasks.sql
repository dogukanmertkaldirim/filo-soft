
-- Add file_urls array and extra submitted data fields to operational_tasks
ALTER TABLE operational_tasks ADD COLUMN IF NOT EXISTS file_urls jsonb DEFAULT '[]'::jsonb;
ALTER TABLE operational_tasks ADD COLUMN IF NOT EXISTS submitted_data jsonb;
ALTER TABLE operational_tasks ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES app_users(id);
ALTER TABLE operational_tasks ADD COLUMN IF NOT EXISTS approved_at timestamptz;
