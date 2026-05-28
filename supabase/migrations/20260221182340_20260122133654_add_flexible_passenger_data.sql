/*
  # Add Flexible Passenger Data Fields

  1. New Fields
    - `passport_number` (text, nullable) - For foreign guests
    - `nationality` (text, default 'TR') - Guest nationality code

  2. Schema Changes
    - Make `tc_identity_number` NULLABLE to support foreign guests
    - Allow delayed data entry without blocking workflow

  3. Migration Strategy
    - Add new columns with defaults
    - Alter tc_identity_number to allow NULL
    - Update existing data with default nationality

  4. Security
    - Maintain existing RLS policies
    - No changes to access control
*/

-- Add passport_number column for foreign guests
ALTER TABLE transfer_passengers 
ADD COLUMN IF NOT EXISTS passport_number text;

-- Add nationality column with default value
ALTER TABLE transfer_passengers 
ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'TR';

-- Make tc_identity_number nullable to support foreign guests
ALTER TABLE transfer_passengers 
ALTER COLUMN tc_identity_number DROP NOT NULL;

-- Set nationality to 'TR' for existing records
UPDATE transfer_passengers 
SET nationality = 'TR' 
WHERE nationality IS NULL;