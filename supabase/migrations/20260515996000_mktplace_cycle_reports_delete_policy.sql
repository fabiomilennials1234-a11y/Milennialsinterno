-- Feature 11: Add admin-only DELETE policy for mktplace_cycle_reports
CREATE POLICY "cycle_reports_admin_delete"
  ON mktplace_cycle_reports
  FOR DELETE
  USING (is_admin(auth.uid()));
