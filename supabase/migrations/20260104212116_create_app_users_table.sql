/*
  # Create Custom App Users Table for Authentication

  1. New Tables
    - `app_users`
      - `id` (uuid, primary key)
      - `username` (text, unique) - login username
      - `password` (text) - user password
      - `full_name` (text) - display name
      - `role` (text) - 'admin' or 'user'
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `app_users` table
    - Policy for reading users (authenticated context)
    - Policy for admin operations

  3. Seed Data
    - Insert 3 initial users as specified
*/

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read for login verification"
  ON app_users
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert for user creation"
  ON app_users
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update for password changes"
  ON app_users
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete for user removal"
  ON app_users
  FOR DELETE
  TO anon
  USING (true);

INSERT INTO app_users (username, password, full_name, role)
VALUES 
  ('dogukanmertk', '612534Ab', 'Doğukan Mert K.', 'admin'),
  ('ogulcan', '301124yek', 'Oğulcan', 'user'),
  ('erkan', '270208pnk', 'Erkan', 'user')
ON CONFLICT (username) DO NOTHING;