/*
  # Create Rental Videos Storage Bucket

  1. Storage
    - Creates `rental-videos` bucket for video evidence files
    - Public bucket for URL-based access
    - Max file size: 26214400 bytes (25 MB)
    - Allowed MIME types: video/mp4, video/x-m4v, video/quicktime, video/webm

  2. Security
    - Upload policy: anon and authenticated users can upload
    - Select policy: anon and authenticated users can read
    - Delete policy: anon and authenticated users can delete
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rental-videos',
  'rental-videos',
  true,
  26214400,
  ARRAY['video/mp4', 'video/x-m4v', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow video uploads' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow video uploads"
      ON storage.objects FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'rental-videos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow video reads' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow video reads"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'rental-videos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow video deletes' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow video deletes"
      ON storage.objects FOR DELETE
      TO anon, authenticated
      USING (bucket_id = 'rental-videos');
  END IF;
END $$;
