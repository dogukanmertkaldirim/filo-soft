-- Campaigns table for B2B sponsor ads
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  title TEXT NOT NULL,
  sponsor_name TEXT NOT NULL,
  discount_rate TEXT,
  image_url TEXT,
  promo_code TEXT,
  external_link TEXT,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_campaigns" ON campaigns FOR SELECT
  TO anon, authenticated USING (status = true);
CREATE POLICY "insert_campaigns" ON campaigns FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_campaigns" ON campaigns FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_campaigns" ON campaigns FOR DELETE
  TO authenticated USING (true);

-- Announcements table for targeted pop-ups
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  type TEXT NOT NULL CHECK (type IN ('Info', 'Legal', 'Payment_Warning')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'All' CHECK (target_audience IN ('All', 'Tenants', 'Drivers', 'Specific_Tenant')),
  specific_tenant_id UUID,
  action_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_announcements" ON announcements FOR SELECT
  TO anon, authenticated USING (is_active = true);
CREATE POLICY "insert_announcements" ON announcements FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_announcements" ON announcements FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_announcements" ON announcements FOR DELETE
  TO authenticated USING (true);
