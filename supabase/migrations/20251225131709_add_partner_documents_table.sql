/*
  # Add Partner Documents Table

  1. New Tables
    - `partner_documents`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, foreign key to partners table)
      - `file_name` (text, name of the document)
      - `file_url` (text, URL or base64 encoded file)
      - `file_type` (text, type of file: pdf, image, etc.)
      - `created_at` (timestamptz, timestamp of creation)

  2. Security
    - Enable RLS on `partner_documents` table
    - Add policy for authenticated users to manage documents

  3. Notes
    - Documents are linked to partners for storing agreements and protocols
    - Supports file upload, download, and deletion
*/

CREATE TABLE IF NOT EXISTS partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE partner_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view partner documents"
  ON partner_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert partner documents"
  ON partner_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update partner documents"
  ON partner_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete partner documents"
  ON partner_documents
  FOR DELETE
  TO authenticated
  USING (true);