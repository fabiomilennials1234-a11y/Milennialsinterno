-- 20260430292000_visao_total_outbound_via_page_grant.sql
--
-- Adiciona policies SELECT pra page_grant 'outbound' em:
--   outbound_tasks, outbound_meetings, outbound_daily_documentation
--
-- Tabelas mantêm policies existentes (dono, admin/CEO/gp/sc). Adicionamos
-- policy permissive paralela pra usuários com grant ativo, sem mudar as outras.

DROP POLICY IF EXISTS outbound_tasks_page_grant_select ON public.outbound_tasks;
CREATE POLICY outbound_tasks_page_grant_select ON public.outbound_tasks
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'outbound'::user_role)
    OR public.can_access_page_data(auth.uid(), 'outbound')
  );

DROP POLICY IF EXISTS outbound_meetings_page_grant_select ON public.outbound_meetings;
CREATE POLICY outbound_meetings_page_grant_select ON public.outbound_meetings
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'outbound'::user_role)
    OR public.can_access_page_data(auth.uid(), 'outbound')
  );

DROP POLICY IF EXISTS outbound_daily_documentation_page_grant_select ON public.outbound_daily_documentation;
CREATE POLICY outbound_daily_documentation_page_grant_select ON public.outbound_daily_documentation
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'outbound'::user_role)
    OR public.can_access_page_data(auth.uid(), 'outbound')
  );
