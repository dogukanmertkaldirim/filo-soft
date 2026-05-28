/*
  # Storage Policies for Documents Bucket

  1. Bucket Setup
    - Create 'documents' bucket if not exists
    - Make it publicly accessible for reads

  2. Security Policies
    - Allow anon users to upload files to the 'documents' bucket
    - Allow anon users to read files from the 'documents' bucket
    - Allow anon users to update/delete their uploaded files

  3. Purpose
    - Enables customer damage photo uploads
    - Enables document storage for contracts, receipts, etc.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow public read access to documents"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'documents');

CREATE POLICY "Allow anon users to upload documents"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow anon users to update documents"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow anon users to delete documents"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'documents');
