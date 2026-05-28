/*
  # Refactor drivers table - add photo, license doc, and operation region

  1. Modified Tables
    - `drivers`
      - Added `driver_photo_url` (text, nullable) - URL to the driver's profile photo in storage
      - Added `license_document_url` (text, nullable) - URL to the license document (front+back scan/photo)
      - Added `operation_region` (text, nullable) - City/region where the driver primarily operates

  2. Storage
    - Create `driver-documents` bucket for storing driver photos and license documents
    - Public read access
    - Upload/update/delete for authenticated and anon users

  3. Notes
    - The old columns (license_class, license_no, license_expiry) remain in the table
      for backward compatibility but are no longer used by the UI
    - The license document upload replaces the manual text entry for license info
    - operation_region enables filtering drivers by their base city
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'driver_photo_url'
  ) THEN
    ALTER TABLE drivers ADD COLUMN driver_photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'license_document_url'
  ) THEN
    ALTER TABLE drivers ADD COLUMN license_document_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'operation_region'
  ) THEN
    ALTER TABLE drivers ADD COLUMN operation_region text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drivers_operation_region ON drivers(operation_region);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-documents',
  'driver-documents',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view driver documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can view driver documents"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'driver-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can upload driver documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can upload driver documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'driver-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can update driver documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can update driver documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'driver-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can delete driver documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can delete driver documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'driver-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon can upload driver documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anon can upload driver documents"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'driver-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon can delete driver documents' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anon can delete driver documents"
    ON storage.objects FOR DELETE
    TO anon
    USING (bucket_id = 'driver-documents');
  END IF;
END $$;
