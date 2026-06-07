
-- Add driver_type to distinguish internal DMK staff drivers from tenant drivers
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS driver_type text DEFAULT 'tenant';

-- Create operational_tasks table for dispatch management
CREATE TABLE IF NOT EXISTS operational_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  assigned_driver_id uuid NOT NULL REFERENCES app_users(id),
  vehicle_id uuid REFERENCES vehicles(id),
  task_type text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  priority text DEFAULT 'normal',
  created_by uuid REFERENCES app_users(id),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  handover_data jsonb,
  signature_url text,
  notes text
);

ALTER TABLE operational_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read operational_tasks"
  ON operational_tasks FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert operational_tasks"
  ON operational_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update operational_tasks"
  ON operational_tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete operational_tasks"
  ON operational_tasks FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anon read operational_tasks"
  ON operational_tasks FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert operational_tasks"
  ON operational_tasks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update operational_tasks"
  ON operational_tasks FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon delete operational_tasks"
  ON operational_tasks FOR DELETE TO anon USING (true);

CREATE INDEX idx_operational_tasks_driver ON operational_tasks(assigned_driver_id, status);
CREATE INDEX idx_operational_tasks_company ON operational_tasks(company_id, status);
CREATE INDEX idx_operational_tasks_vehicle ON operational_tasks(vehicle_id);
