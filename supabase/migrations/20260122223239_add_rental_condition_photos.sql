/*
  # Add Rental Condition Photos Support

  1. Changes to Rentals Table
    - Add `start_photos` (jsonb) - Array of photo URLs taken at delivery
    - Add `return_photos` (jsonb) - Array of photo URLs taken at return
    - Add `start_fuel_percentage` (integer) - Precise fuel level percentage at start (0-100)
    - Add `return_fuel_percentage` (integer) - Precise fuel level percentage at return (0-100)

  2. Storage
    - Create `rental-photos` bucket for storing condition photos

  3. Notes
    - Photos are stored as JSONB arrays containing URL strings
    - Fuel percentage provides more granular control than the existing status field
*/

ALTER TABLE rentals
ADD COLUMN IF NOT EXISTS start_photos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS return_photos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS start_fuel_percentage integer CHECK (start_fuel_percentage >= 0 AND start_fuel_percentage <= 100),
ADD COLUMN IF NOT EXISTS return_fuel_percentage integer CHECK (return_fuel_percentage >= 0 AND return_fuel_percentage <= 100);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rental-photos',
  'rental-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view rental photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'rental-photos');

CREATE POLICY "Authenticated users can upload rental photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rental-photos');

CREATE POLICY "Authenticated users can update rental photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'rental-photos');

CREATE POLICY "Authenticated users can delete rental photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rental-photos');

CREATE POLICY "Anon can upload rental photos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'rental-photos');

CREATE POLICY "Anon can delete rental photos"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'rental-photos');