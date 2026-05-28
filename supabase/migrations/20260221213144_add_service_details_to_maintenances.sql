/*
  # Add service_details JSONB column to maintenances

  1. Modified Tables
    - `maintenances`
      - Added `service_details` (jsonb) - Stores the maintenance checklist state and custom operations
        - checklist: array of { id, label, status } where status is 'replaced' | 'checked' | 'na'
        - custom_operations: array of { name, notes }

  2. Important Notes
    - The column is nullable and defaults to null for backwards compatibility
    - Existing records are not affected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maintenances' AND column_name = 'service_details'
  ) THEN
    ALTER TABLE maintenances ADD COLUMN service_details jsonb DEFAULT NULL;
  END IF;
END $$;
