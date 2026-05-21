-- Allow any user (anon or authenticated) to read active NPS surveys.
-- Public NPS page (/nps/:token) uses anon key for unauthenticated visitors;
-- authenticated users logged into the system also need access because
-- Supabase does NOT fall back from authenticated to anon policies.
-- Safe: only active surveys exposed via SELECT; survey metadata is not sensitive.

CREATE POLICY "Anon can read active surveys"
  ON public.nps_surveys
  FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Any authenticated user can read active surveys"
  ON public.nps_surveys
  FOR SELECT
  TO authenticated
  USING (is_active = true);
