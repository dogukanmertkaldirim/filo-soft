/*
  # Module Management System

  This migration adds a modular architecture to enable/disable features per company.

  ## 1. New Column on Companies Table
    - `active_modules` (jsonb) - List of enabled modules for this company
    - Default includes core modules: rent_a_car, finance, maintenance, crm

  ## 2. Available Modules
    - rent_a_car: Core rental operations (cannot be disabled)
    - finance: Financial tracking, income/expense
    - maintenance: Vehicle maintenance and service
    - crm: Customer relationship management
    - transfer: VIP Transfer services
    - logistics: Logistics operations
    - loans: Bank loans and credit management
    - partners: Partner management and profit sharing

  ## Security
    - No new RLS policies needed (uses existing companies table policies)
*/

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS active_modules jsonb DEFAULT '["rent_a_car", "finance", "maintenance", "crm"]'::jsonb;

UPDATE companies
SET active_modules = '["rent_a_car", "finance", "maintenance", "crm"]'::jsonb
WHERE active_modules IS NULL;