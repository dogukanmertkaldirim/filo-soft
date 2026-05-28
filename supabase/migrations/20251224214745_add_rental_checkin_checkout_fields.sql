/*
  # Add Rental Check-in and Check-out Fields

  1. Changes to `vehicles` table
    - Add `current_km` (numeric) - Current odometer reading of the vehicle
    
  2. Changes to `rentals` table
    
    **Check-out (Giving) fields:**
    - Add `initial_damage_notes` (text) - Damage description at rental start
    - Add `start_cleanliness_status` (text) - Vehicle cleanliness at start (clean, normal, dirty)
    - Add `contract_document_url` (text) - Signed rental agreement document
    
    **Check-in (Return) fields:**
    - Add `return_datetime` (timestamptz) - Actual return date and time
    - Add `return_km` (numeric) - Odometer reading at return
    - Add `return_fuel_status` (text) - Fuel level at return (empty, 1/4, 1/2, 3/4, full)
    - Add `return_cleanliness_status` (text) - Vehicle cleanliness at return
    - Add `handover_document_url` (text) - Vehicle delivery report document
    - Add `return_damage_notes` (text) - New damages found at return
    
  3. Notes
    - Check constraints ensure valid status values
    - All return fields are nullable (only filled when vehicle is returned)
*/

-- Add current_km to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS current_km numeric;

-- Add check-out fields to rentals table
ALTER TABLE rentals
ADD COLUMN IF NOT EXISTS initial_damage_notes text,
ADD COLUMN IF NOT EXISTS start_cleanliness_status text CHECK (start_cleanliness_status IN ('clean', 'normal', 'dirty')),
ADD COLUMN IF NOT EXISTS contract_document_url text;

-- Add check-in (return) fields to rentals table
ALTER TABLE rentals
ADD COLUMN IF NOT EXISTS return_datetime timestamptz,
ADD COLUMN IF NOT EXISTS return_km numeric,
ADD COLUMN IF NOT EXISTS return_fuel_status text CHECK (return_fuel_status IN ('empty', '1/4', '1/2', '3/4', 'full')),
ADD COLUMN IF NOT EXISTS return_cleanliness_status text CHECK (return_cleanliness_status IN ('clean', 'normal', 'dirty')),
ADD COLUMN IF NOT EXISTS handover_document_url text,
ADD COLUMN IF NOT EXISTS return_damage_notes text;
