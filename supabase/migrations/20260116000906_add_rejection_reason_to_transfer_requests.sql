/*
  # Add rejection_reason column to transfer_requests

  1. Changes
    - Adds `rejection_reason` column to `transfer_requests` table
    - This allows customers to explain why they rejected an offer

  2. Purpose
    - Enables the "Proposal & Approval" workflow
    - Customers can provide feedback when rejecting transfer offers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transfer_requests' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE transfer_requests ADD COLUMN rejection_reason text;
  END IF;
END $$;