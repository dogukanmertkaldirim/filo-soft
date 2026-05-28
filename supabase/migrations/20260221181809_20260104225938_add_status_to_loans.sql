/*
  # Add Status Column to Loans

  1. Changes
    - Add `status` column to the loans table (values: 'active', 'completed')
    - Default to 'active' for all existing and new loans
    - This enables filtering between active and completed (paid-off) loans
    
  2. Benefits
    - Organize loans into active and completed categories
    - Auto-archive paid-off loans to keep the active list clean
    - Improve UI navigation and reporting
    
  3. Usage
    - When a loan is fully paid: SET status = 'completed'
    - When querying active loans: Filter WHERE status = 'active'
    - When querying completed loans: Filter WHERE status = 'completed'
*/

-- Add status column to loans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loans' AND column_name = 'status'
  ) THEN
    ALTER TABLE loans ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'completed'));
  END IF;
END $$;