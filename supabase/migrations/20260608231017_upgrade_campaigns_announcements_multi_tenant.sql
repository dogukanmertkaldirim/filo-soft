-- Add target_audience to campaigns for SaaS multi-tier targeting
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT 'Public_Login';

-- Drop existing check if any and add new one
DO $$ BEGIN
  ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_target_audience_check;
  ALTER TABLE campaigns ADD CONSTRAINT campaigns_target_audience_check
    CHECK (target_audience IN ('Public_Login', 'Fleet_Admins_Only', 'All_Logged_In_Users'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add created_by and tenant_id to announcements for multi-tenant segregation
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES companies(id);

-- Drop old target_audience check and replace with expanded values
DO $$ BEGIN
  ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_target_audience_check;
  ALTER TABLE announcements ADD CONSTRAINT announcements_target_audience_check
    CHECK (target_audience IN ('All', 'Tenants', 'Drivers', 'Specific_Tenant', 'Fleet_Admins'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
