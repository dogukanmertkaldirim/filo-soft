/*
  # Fix Transfer Photos Storage Policies

  1. Problem
    - Customers cannot view proposal photos in transfer requests
    - RLS policies need to allow both authenticated and anon users to read

  2. Changes
    - Drop existing SELECT policy if exists
    - Create new SELECT policy allowing public (anon + authenticated) access
    - Ensure bucket is public
    - Add policy for anon users explicitly

  3. Security
    - Read access: Public (anyone can view)
    - Write access: Authenticated only (admins)
*/

-- Ensure bucket is public
UPDATE storage.buckets
SET public = true
WHERE id = 'transfer-photos';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view transfer photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view transfer photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon users can view transfer photos" ON storage.objects;

-- Create comprehensive read policy for everyone (anon + authenticated)
CREATE POLICY "Public read access for transfer photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'transfer-photos');

-- Ensure INSERT policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload transfer photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload transfer photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'transfer-photos');
  END IF;
END $$;

-- Ensure UPDATE policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update transfer photos'
  ) THEN
    CREATE POLICY "Authenticated users can update transfer photos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'transfer-photos');
  END IF;
END $$;

-- Ensure DELETE policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete transfer photos'
  ) THEN
    CREATE POLICY "Authenticated users can delete transfer photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'transfer-photos');
  END IF;
END $$;