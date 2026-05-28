/*
  # Add Soft Delete Columns

  1. Changes
    - Add `deleted_at` column to vehicles, customers, and rentals tables
    - This enables soft delete functionality (marking records as deleted instead of removing them)
    
  2. Benefits
    - Data safety: Deleted records can be restored
    - Audit trail: Track when records were deleted
    - Compliance: Meet data retention requirements

  3. Usage
    - When deleting: SET deleted_at = NOW()
    - When querying: Filter WHERE deleted_at IS NULL
    - When restoring: SET deleted_at = NULL
*/

-- Add deleted_at to vehicles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Add deleted_at to customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Add deleted_at to rentals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE rentals ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;