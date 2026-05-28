/*
  # Add Supplier Contract URL to Vehicles and Create Storage Bucket

  1. Modified Tables
    - `vehicles`
      - `supplier_contract_url` (text, nullable) - URL of the uploaded supplier contract document

  2. Storage
    - Creates `supplier-contracts` bucket for storing contract documents
    - Adds RLS policies for read (public), insert/update/delete (authenticated)

  3. Notes
    - Only relevant for vehicles with ownership_type = 'kiralik'
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'supplier_contract_url') THEN
    ALTER TABLE vehicles ADD COLUMN supplier_contract_url text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-contracts', 'supplier-contracts', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read supplier-contracts' AND tablename = 'objects') THEN
    CREATE POLICY "Allow public read supplier-contracts"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'supplier-contracts');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated upload supplier-contracts' AND tablename = 'objects') THEN
    CREATE POLICY "Allow authenticated upload supplier-contracts"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'supplier-contracts');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated update supplier-contracts' AND tablename = 'objects') THEN
    CREATE POLICY "Allow authenticated update supplier-contracts"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'supplier-contracts')
      WITH CHECK (bucket_id = 'supplier-contracts');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated delete supplier-contracts' AND tablename = 'objects') THEN
    CREATE POLICY "Allow authenticated delete supplier-contracts"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'supplier-contracts');
  END IF;
END $$;
