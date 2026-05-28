/*
  # Add Soft Delete Column to Loans

  1. Changes
    - Add `deleted_at` column to the loans table
    - This enables soft delete functionality for loans (marking records as deleted instead of removing them)
    
  2. Benefits
    - Data safety: Deleted loan records can be restored
    - Audit trail: Track when loans were deleted
    - Compliance: Meet data retention requirements for financial records

  3. Usage
    - When deleting: SET deleted_at = NOW()
    - When querying: Filter WHERE deleted_at IS NULL
    - When restoring: SET deleted_at = NULL
*/

-- Add deleted_at to loans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loans' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE loans ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;