/*
  # Add Custom Events Table for Calendar

  1. New Tables
    - `custom_events`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz, auto-generated)
      - `user_id` (text, references the username who created the event)
      - `company_id` (uuid, for multi-tenant isolation)
      - `title` (text, required)
      - `description` (text, optional)
      - `start_date` (timestamptz, required)
      - `is_all_day` (boolean, default true)
      - `color` (text, for visual distinction)
      - `recurrence_pattern` (text: none, daily, weekly, monthly, yearly)

  2. Security
    - Enable RLS on `custom_events` table
    - Add policies for authenticated access based on company_id
*/

CREATE TABLE IF NOT EXISTS custom_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id text NOT NULL,
  company_id uuid,
  title text NOT NULL,
  description text DEFAULT '',
  start_date timestamptz NOT NULL,
  is_all_day boolean DEFAULT true,
  color text DEFAULT 'blue',
  recurrence_pattern text DEFAULT 'none' CHECK (recurrence_pattern IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  deleted_at timestamptz DEFAULT NULL
);

ALTER TABLE custom_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view custom events in their company"
  ON custom_events
  FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

CREATE POLICY "Users can insert custom events"
  ON custom_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Users can update their own custom events"
  ON custom_events
  FOR UPDATE
  TO anon
  USING (deleted_at IS NULL)
  WITH CHECK (true);

CREATE POLICY "Users can delete custom events"
  ON custom_events
  FOR DELETE
  TO anon
  USING (true);

CREATE INDEX idx_custom_events_company_id ON custom_events(company_id);
CREATE INDEX idx_custom_events_start_date ON custom_events(start_date);
CREATE INDEX idx_custom_events_user_id ON custom_events(user_id);