-- Secondary managers need to view client_daily_tracking for clients they manage
CREATE POLICY "secondary_manager_can_view_tracking" ON public.client_daily_tracking
  FOR SELECT USING (
    client_id IN (
      SELECT client_id FROM public.client_secondary_managers
      WHERE secondary_manager_id = auth.uid()
    )
  );
