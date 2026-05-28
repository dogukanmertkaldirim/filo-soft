/*
  # Create transfer-photos storage bucket

  1. Storage Bucket
    - Creates 'transfer-photos' bucket for vehicle proposal images
    - Public bucket for easy image access

  2. Security Policies
    - Authenticated users can upload photos
    - Anyone can view photos (for customer access)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('transfer-photos', 'transfer-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view transfer photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'transfer-photos');

CREATE POLICY "Authenticated users can upload transfer photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transfer-photos');

CREATE POLICY "Authenticated users can update transfer photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'transfer-photos');

CREATE POLICY "Authenticated users can delete transfer photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'transfer-photos');