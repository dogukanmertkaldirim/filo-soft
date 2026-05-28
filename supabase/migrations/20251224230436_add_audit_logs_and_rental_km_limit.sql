/*
  # Add Activity Logs and Rental KM Limit

  1. New Tables
    - `activity_logs` - Audit trail for tracking critical actions (deletions, updates, creations)
      - `id` (uuid, primary key)
      - `action` (text) - Type of action: DELETE, UPDATE, CREATE
      - `entity` (text) - Entity type: Transaction, Vehicle, Customer, Loan
      - `entity_id` (uuid) - The ID of the affected record
      - `details` (text) - Human-readable description of the action
      - `user_email` (text) - Email of the user who performed the action
      - `created_at` (timestamptz) - When the action occurred

  2. Changes to `rentals` table
    - Add `daily_km_limit` (integer) - Maximum KM allowed per day

  3. Changes to `loans` table  
    - Add `title` (text) - Descriptive title for the loan
    - Note: The `bank` column already exists as `lender_bank` equivalent

  4. Security
    - Enable RLS on `activity_logs` table
    - Add policy for read access
*/

-- Create activity_logs table for audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('DELETE', 'UPDATE', 'CREATE')),
  entity text NOT NULL,
  entity_id uuid,
  details text NOT NULL,
  user_email text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for activity_logs (allow all operations for now)
CREATE POLICY "Allow all for activity_logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Add daily_km_limit to rentals table
ALTER TABLE rentals
ADD COLUMN IF NOT EXISTS daily_km_limit integer;

-- Add title to loans table
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS title text;

-- Create index on activity_logs for faster querying
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity);
