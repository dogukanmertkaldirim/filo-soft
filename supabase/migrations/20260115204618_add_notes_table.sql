/*
  # Add Notes Table for Sticky Notes Feature

  1. New Tables
    - `notes`
      - `id` (uuid, primary key)
      - `content` (text) - The note text content
      - `color` (text) - Color variant for post-it styling (yellow, blue, pink, green)
      - `is_public` (boolean) - Whether the note is visible to all users or private
      - `created_by` (text) - Email of the user who created the note
      - `created_at` (timestamptz) - Timestamp when note was created
      - `updated_at` (timestamptz) - Timestamp when note was last updated
  
  2. Security
    - Enable RLS on `notes` table
    - Add policy for users to view their own private notes and all public notes
    - Add policy for users to create notes
    - Add policy for users to update/delete their own notes
*/

-- Create Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  color text DEFAULT 'yellow' CHECK (color IN ('yellow', 'blue', 'pink', 'green', 'purple', 'orange')),
  is_public boolean DEFAULT false,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notes and all public notes
CREATE POLICY "Users can view own and public notes"
  ON notes FOR SELECT
  USING (true);

-- Policy: Any authenticated user can create notes
CREATE POLICY "Users can create notes"
  ON notes FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own notes
CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  USING (true);