
CREATE TABLE IF NOT EXISTS traffic_fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  tenant_id uuid REFERENCES app_users(id),
  driver_id uuid,
  fine_number text,
  amount numeric NOT NULL DEFAULT 0,
  fine_date date NOT NULL,
  fine_document_url text,
  payment_receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE traffic_fines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read traffic_fines"
  ON traffic_fines FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated insert traffic_fines"
  ON traffic_fines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update traffic_fines"
  ON traffic_fines FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated delete traffic_fines"
  ON traffic_fines FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anon read traffic_fines"
  ON traffic_fines FOR SELECT TO anon USING (true);

CREATE POLICY "Anon insert traffic_fines"
  ON traffic_fines FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon update traffic_fines"
  ON traffic_fines FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon delete traffic_fines"
  ON traffic_fines FOR DELETE TO anon USING (true);

CREATE INDEX idx_traffic_fines_company ON traffic_fines(company_id, status);
CREATE INDEX idx_traffic_fines_vehicle ON traffic_fines(vehicle_id);
CREATE INDEX idx_traffic_fines_tenant ON traffic_fines(tenant_id);
CREATE INDEX idx_traffic_fines_driver ON traffic_fines(driver_id);
