
-- Add telematics/GPS integration fields to vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS telematics_provider TEXT DEFAULT 'None';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS telematics_device_id TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_gps_km NUMERIC;
