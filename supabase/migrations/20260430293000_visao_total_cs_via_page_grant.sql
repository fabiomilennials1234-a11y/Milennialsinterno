-- 20260430293000_visao_total_cs_via_page_grant.sql
--
-- Adiciona SELECT por page_grant 'sucesso-cliente' em onboarding_tasks.
-- Tabelas cs_action_plans, cs_action_plan_tasks, cs_exit_reasons já tem
-- USING (auth.uid() IS NOT NULL) — qualquer authenticated lê. Não tocamos.

DROP POLICY IF EXISTS onboarding_tasks_page_grant_select ON public.onboarding_tasks;
CREATE POLICY onboarding_tasks_page_grant_select ON public.onboarding_tasks
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)
    OR public.can_access_page_data(auth.uid(), 'sucesso-cliente')
  );
