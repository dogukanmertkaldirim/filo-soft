-- Drop old restrictive SELECT policy and recreate with true public read access
DROP POLICY IF EXISTS "select_campaigns" ON campaigns;
CREATE POLICY "select_campaigns_public" ON campaigns FOR SELECT
  TO anon, authenticated USING (true);

-- Also ensure announcements can be read by any authenticated user
DROP POLICY IF EXISTS "select_announcements" ON announcements;
CREATE POLICY "select_announcements_authenticated" ON announcements FOR SELECT
  TO authenticated USING (true);
