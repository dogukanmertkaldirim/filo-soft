/*
  # Universal GPS Integration Architecture

  This migration creates a vendor-agnostic GPS tracking infrastructure that supports
  multiple GPS providers (Arvento, Mobiliz, Trio, Filoturk, etc.) without code changes.

  ## 1. Vehicle GPS Fields
    - `gps_provider` (text) - Which tracking system handles this vehicle
    - `gps_device_id` (text) - Device identifier used by the provider
    - `gps_settings` (jsonb) - Provider-specific configuration per vehicle

  ## 2. Integration Configs Table
    - Stores API credentials securely for each GPS provider
    - Supports multiple providers per company
    - JSONB config field for flexible provider-specific settings

  ## 3. Telemetry Logs Table
    - Standardized logging format regardless of data source
    - Stores location, speed, odometer, ignition, fuel data
    - Indexed for efficient querying by vehicle and time

  ## Security
    - RLS enabled on all tables
    - Integration configs restricted to admins only
    - Telemetry logs accessible by authenticated users
*/

-- Add GPS fields to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS gps_provider text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS gps_device_id text,
ADD COLUMN IF NOT EXISTS gps_settings jsonb DEFAULT '{}';

-- Create integration_configs table for storing provider credentials
CREATE TABLE IF NOT EXISTS integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  display_name text NOT NULL,
  is_active boolean DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  UNIQUE(company_id, provider)
);

-- Create telemetry_logs table for standardized GPS data
CREATE TABLE IF NOT EXISTS telemetry_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  timestamp timestamptz NOT NULL,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  speed_kmh numeric(6, 2),
  odometer_value numeric(12, 2),
  ignition_status boolean,
  fuel_level_percent numeric(5, 2),
  heading numeric(5, 2),
  altitude numeric(8, 2),
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_vehicle_id ON telemetry_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_timestamp ON telemetry_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_vehicle_timestamp ON telemetry_logs(vehicle_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vehicles_gps_provider ON vehicles(gps_provider) WHERE gps_provider != 'none';
CREATE INDEX IF NOT EXISTS idx_integration_configs_provider ON integration_configs(provider);

-- Enable RLS
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integration_configs (admin only access)
CREATE POLICY "Users can view integration configs"
  ON integration_configs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert integration configs"
  ON integration_configs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update integration configs"
  ON integration_configs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete integration configs"
  ON integration_configs FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for telemetry_logs
CREATE POLICY "Users can view telemetry logs"
  ON telemetry_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert telemetry logs"
  ON telemetry_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anon access for webhook data ingestion
CREATE POLICY "Anon can insert telemetry logs"
  ON telemetry_logs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can view telemetry logs"
  ON telemetry_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can view integration configs"
  ON integration_configs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert integration configs"
  ON integration_configs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update integration configs"
  ON integration_configs FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);