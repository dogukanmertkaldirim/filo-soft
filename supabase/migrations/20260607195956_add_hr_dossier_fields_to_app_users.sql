
-- Add HR Personnel Dossier fields to app_users
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS identity_doc_url TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS ehliyet_doc_url TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS ehliyet_class TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS ehliyet_expiry_date DATE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS src_document_no TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS psikoteknik_status TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sgk_doc_url TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sabika_kaydi_url TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS blood_type TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS home_address TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS isg_training_date DATE;
