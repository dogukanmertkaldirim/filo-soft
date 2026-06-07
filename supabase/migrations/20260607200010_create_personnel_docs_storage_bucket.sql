
-- Create storage bucket for personnel documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('personnel-docs', 'personnel-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "personnel_docs_upload" ON storage.objects FOR INSERT
  TO anon WITH CHECK (bucket_id = 'personnel-docs');

CREATE POLICY "personnel_docs_select" ON storage.objects FOR SELECT
  TO anon USING (bucket_id = 'personnel-docs');

CREATE POLICY "personnel_docs_delete" ON storage.objects FOR DELETE
  TO anon USING (bucket_id = 'personnel-docs');
