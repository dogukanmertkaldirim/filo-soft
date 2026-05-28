/*
  # Add Vehicle Gallery Photos Support

  1. Modified Tables
    - `vehicles`
      - Add `gallery_urls` (jsonb, default '[]') - Array of photo URLs for the vehicle gallery

  2. Storage
    - Create `vehicle-photos` bucket for storing vehicle gallery images
    - Public read access for anyone
    - Upload/update/delete for authenticated and anon users

  3. Notes
    - `photo_url` remains as the cover photo (single URL)
    - `gallery_urls` stores all gallery photos including the cover
    - Photos are uploaded to Supabase Storage and URLs are stored in the jsonb array
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'gallery_urls'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN gallery_urls jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view vehicle photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can view vehicle photos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'vehicle-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can upload vehicle photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can upload vehicle photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'vehicle-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can update vehicle photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can update vehicle photos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'vehicle-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Auth users can delete vehicle photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Auth users can delete vehicle photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'vehicle-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon can upload vehicle photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anon can upload vehicle photos"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'vehicle-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon can delete vehicle photos' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anon can delete vehicle photos"
    ON storage.objects FOR DELETE
    TO anon
    USING (bucket_id = 'vehicle-photos');
  END IF;
END $$;
