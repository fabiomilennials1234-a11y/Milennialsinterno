-- 20260430291000_visao_total_crm_via_page_grant.sql
--
-- Estende SELECT de crm_delay_justification_pending pra incluir page_grant em 'gestor-crm'.
-- Tabelas crm_daily_tracking, crm_daily_documentation, crm_configuracoes já são ALL USING (true)
-- (bypass nativo já cobre page-grant). Não tocamos.

DROP POLICY IF EXISTS crm_delay_pending_select ON public.crm_delay_justification_pending;

CREATE POLICY crm_delay_pending_select ON public.crm_delay_justification_pending
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.is_ceo(auth.uid())
    OR public.user_is_crm_pending_involved(config_id)
    OR public.has_role(auth.uid(), 'gestor_crm'::user_role)
    OR public.can_access_page_data(auth.uid(), 'gestor-crm')
  );
