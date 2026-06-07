
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS utts_installed boolean NOT NULL DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS utts_installation_no text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS utts_installation_code text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS utts_receipt_url text;
