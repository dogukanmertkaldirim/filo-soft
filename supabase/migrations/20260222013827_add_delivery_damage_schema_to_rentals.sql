/*
  # Add Visual Damage Schema Columns to Rentals

  1. New Columns
    - `delivery_damage_condition` (jsonb) - Visual damage schema data at vehicle delivery
    - `return_damage_condition` (jsonb) - Visual damage schema data at vehicle return

  2. Purpose
    - Store the interactive car damage schema data as JSONB
    - Enables visual damage tracking on handover documents
    - Each key-value pair represents a car part and its condition
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'delivery_damage_condition'
  ) THEN
    ALTER TABLE rentals ADD COLUMN delivery_damage_condition jsonb DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'return_damage_condition'
  ) THEN
    ALTER TABLE rentals ADD COLUMN return_damage_condition jsonb DEFAULT '{}';
  END IF;
END $$;