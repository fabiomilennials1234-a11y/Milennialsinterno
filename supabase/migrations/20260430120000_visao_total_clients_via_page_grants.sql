-- 20260430120000_visao_total_clients_via_page_grants.sql
--
-- Visao TOTAL via page_grant em public.clients.
-- Substitui stack de policies role-based hardcoded por uma policy unificada
-- via can_access_page_data + caminhos de assignment como complemento.
--
-- Decisao do fundador (registrada):
--   - role default consultor_comercial MANTEM filtro assigned_comercial.
--   - role default ads_manager MANTEM filtro assigned_ads_manager.
--   - page_grant explicito a 'cliente-list' OU a slugs de papel relevantes
--     (gestor-ads, consultor-comercial, gestor-crm, outbound, sucesso-cliente,
--      financeiro) abre TUDO.
--
-- Operacao (INSERT/UPDATE/DELETE) NAO muda — preservada.

BEGIN;

-- Drop todas as policies SELECT antigas.
DROP POLICY IF EXISTS "CEO can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Ads Manager can view assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Consultor Comercial can view assigned clients" ON public.clients;
DROP POLICY IF EXISTS "Financeiro can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Sucesso do Cliente can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Outbound can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Gestor de Projetos can view clients in their group" ON public.clients;

-- Policy unica unificada.
CREATE POLICY clients_select_visao_total
  ON public.clients FOR SELECT TO authenticated
  USING (
    -- Admin / executive bypass
    public.is_admin(auth.uid())
    -- gestor_projetos vê grupo dele
    OR (
      public.has_role(auth.uid(), 'gestor_projetos'::public.user_role)
      AND group_id = public.get_user_group_id(auth.uid())
    )
    -- Assignment direto: criador/dono natural por papel
    OR assigned_ads_manager     = auth.uid()
    OR assigned_comercial       = auth.uid()
    OR assigned_crm             = auth.uid()
    OR assigned_rh              = auth.uid()
    OR assigned_outbound_manager = auth.uid()
    OR assigned_sucesso_cliente = auth.uid()
    OR assigned_mktplace        = auth.uid()::text
    -- Page_grant explicito a um dos slugs relevantes (visao TOTAL)
    OR public.can_access_page_data(auth.uid(), 'cliente-list')
    OR public.can_access_page_data(auth.uid(), 'gestor-ads')
    OR public.can_access_page_data(auth.uid(), 'consultor-comercial')
    OR public.can_access_page_data(auth.uid(), 'gestor-crm')
    OR public.can_access_page_data(auth.uid(), 'outbound')
    OR public.can_access_page_data(auth.uid(), 'sucesso-cliente')
    OR public.can_access_page_data(auth.uid(), 'financeiro')
    OR public.can_access_page_data(auth.uid(), 'consultor-mktplace')
  );

COMMIT;
