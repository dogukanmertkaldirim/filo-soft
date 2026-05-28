/*
  # Add proposal_photos column to transfer_requests

  1. Changes
    - Adds `proposal_photos` column to `transfer_requests` table
    - This stores an array of URLs for vehicle photos uploaded by admins

  2. Purpose
    - Enables admins to attach vehicle photos when sending transfer offers
    - Helps customers visualize the vehicle before accepting an offer
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfer_requests' AND column_name = 'proposal_photos'
  ) THEN
    ALTER TABLE transfer_requests ADD COLUMN proposal_photos text[] DEFAULT '{}';
  END IF;
END $$;