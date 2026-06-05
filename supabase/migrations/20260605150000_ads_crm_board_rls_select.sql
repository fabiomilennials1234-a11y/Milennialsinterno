-- 20260605150000_ads_crm_board_rls_select.sql
--
-- Slice 2 (#137) — Gestor de ads LÊ o board do CRM (read-only), escopado à
-- carteira. PRD #135, ADR 0006. Depende da slice #136 (_ads_owns_client).
--
-- O QUE FAZ (idempotente):
--   Adiciona UMA policy RLS de SELECT em crm_configuracoes que dá ao gestor_ads
--   visibilidade APENAS dos cards de clientes da SUA carteira
--   (_ads_owns_client(client_id, auth.uid())). Policies são OR entre si, então
--   isto AMPLIA o SELECT sem tocar a policy existente crm_config_select (#91).
--
-- O QUE NÃO FAZ (invariante de segurança):
--   NÃO cria/afrouxa nenhuma policy de ESCRITA. crm_config_write (#91) continua
--   admin / has_page_access('gestor-crm') / gestor_id = auth.uid()::text. Ads
--   é READ-ONLY no board — escrita só via as RPCs SECURITY DEFINER escopadas
--   (#136) ou pelo gestor do card. Card de cliente de outro ads é LINHA
--   INVISÍVEL (não há vazamento cruzado de carteira).
--
-- Por que policy nova em vez de estender crm_config_select: manter a regra de
-- ads isolada e legível (uma policy = uma intenção), e não arriscar regressão
-- na policy base do gestor_crm. Reversível: DROP da policy remove o acesso ads.

BEGIN;

DROP POLICY IF EXISTS crm_config_select_ads ON public.crm_configuracoes;

CREATE POLICY crm_config_select_ads ON public.crm_configuracoes
  FOR SELECT TO authenticated
  USING (
    public._ads_owns_client(client_id, auth.uid())
  );

COMMENT ON POLICY crm_config_select_ads ON public.crm_configuracoes IS
  'Slice #137 (PRD #135): gestor_ads lê (read-only) os cards do board CRM de '
  'clientes da SUA carteira (_ads_owns_client). OR-soma com crm_config_select '
  'sem afrouxar a escrita (crm_config_write inalterada). Card de outro ads = '
  'linha invisível — sem vazamento cruzado de carteira.';

COMMIT;
