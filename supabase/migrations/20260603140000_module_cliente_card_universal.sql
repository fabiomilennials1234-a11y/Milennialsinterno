-- 20260603140000_module_cliente_card_universal.sql
-- Slice 1 (#77) — Card Universal de Cliente (LEITURA). ADR 0004 + ADR 0005.
--
-- Entrega:
--   1. cliente.pode_ver_cliente(client, user) — predicado UNIFICADO de
--      visibilidade do cliente. Encapsula o MESMO conjunto da RLS de
--      public.clients (clients_select_visao_total / ADR 0005): bypass executivo
--      (A) + escopo-grupo do GP (B) + Envolvido (C/C') + page-grants (D).
--      Um único dono da definição "quem vê o cliente" — card + RLS de
--      client_info_bank delegam a ele (evita 3ª/4ª cópia divergente do predicado).
--   2. cliente.card_universal(client) — contrato de LEITURA consolidada do
--      cliente de fonte única (public.client_info_bank). RETURNS TABLE → 0/1 row.
--      Gate de audiência DENTRO da RPC (só retorna se pode_ver_cliente). Não-
--      envolvido recebe VAZIO (semântica "200+vazio" do #78), não erro.
--   3. Reorientação do SELECT de public.client_info_bank: troca USING(true)
--      (qualquer authenticated lê qualquer cliente — furo de confidencialidade
--      LGPD) por USING(cliente.pode_ver_cliente(...)). INSERT/UPDATE/DELETE
--      INTACTOS — a escrita migra em #79 (espelha ADR 0005 §3: slice de leitura
--      mexe só em leitura).
--
-- Hardening (ADR 0004 §3): SECURITY DEFINER + SET search_path='' + identificadores
-- schema-qualified + grants mínimos. Sem literal de role (só helpers canônicos) →
-- guard no_literal_role_in_policy permanece verde.

-- =============================================================================
-- 1) cliente.pode_ver_cliente — predicado unificado de visibilidade do cliente.
--    Espelha EXATAMENTE clients_select_visao_total (ADR 0005). group_id é coluna
--    de public.clients; a função o lê para a branch (B) GP-por-grupo.
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente.pode_ver_cliente(p_client_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_admin(p_user_id)                                                 -- (A) bypass executivo + GP
    OR EXISTS (                                                                -- (B) escopo-grupo do GP
      SELECT 1 FROM public.clients c
      WHERE c.id = p_client_id
        AND public.has_role(p_user_id, 'gestor_projetos'::public.user_role)
        AND c.group_id = public.get_user_group_id(p_user_id)
    )
    OR cliente.e_envolvido(p_client_id, p_user_id)                             -- (C)+(C') involvement
    OR public.can_access_page_data(p_user_id, 'cliente-list')                  -- (D) page-grants
    OR public.can_access_page_data(p_user_id, 'gestor-ads')
    OR public.can_access_page_data(p_user_id, 'consultor-comercial')
    OR public.can_access_page_data(p_user_id, 'gestor-crm')
    OR public.can_access_page_data(p_user_id, 'outbound')
    OR public.can_access_page_data(p_user_id, 'sucesso-cliente')
    OR public.can_access_page_data(p_user_id, 'financeiro')
    OR public.can_access_page_data(p_user_id, 'consultor-mktplace');
$$;

COMMENT ON FUNCTION cliente.pode_ver_cliente(uuid, uuid) IS
  'Contrato/predicado: quem pode VER um cliente (ADR 0005). Fonte ÚNICA da '
  'definição de visibilidade do cliente — espelha clients_select_visao_total: '
  'is_admin(A) OR GP-grupo(B) OR e_envolvido(C/C'') OR page-grants(D). A RLS de '
  'public.client_info_bank e a RPC card_universal delegam a ESTE predicado. '
  'Envolvido (e_envolvido) é apenas a parcela (C)+(C'').';

REVOKE ALL ON FUNCTION cliente.pode_ver_cliente(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cliente.pode_ver_cliente(uuid, uuid) TO authenticated, service_role;

-- =============================================================================
-- 2) cliente.card_universal — leitura consolidada do cliente (fonte única).
--    RETURNS TABLE espelha as colunas de domínio de public.client_info_bank
--    (marca / presença digital / vídeo / dev / geral) + metadados de auditoria.
--    Gate de audiência: só retorna a linha se o caller pode ver o cliente.
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente.card_universal(p_client_id uuid)
RETURNS TABLE (
  client_id        uuid,
  -- Marca
  brand_colors     text,
  typography       text,
  visual_style     text,
  brand_manual_url text,
  logo_url         text,
  -- Presença Digital
  website_url      text,
  instagram_handle text,
  youtube_channel  text,
  tiktok_handle    text,
  domain           text,
  -- Vídeo
  editing_style    text,
  video_formats    text,
  -- Dev
  cms_platform     text,
  figma_url        text,
  -- Geral
  notes            text,
  -- Auditoria
  updated_at       timestamptz,
  updated_by       uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    b.client_id,
    b.brand_colors, b.typography, b.visual_style, b.brand_manual_url, b.logo_url,
    b.website_url, b.instagram_handle, b.youtube_channel, b.tiktok_handle, b.domain,
    b.editing_style, b.video_formats,
    b.cms_platform, b.figma_url,
    b.notes,
    b.updated_at, b.updated_by
  FROM public.client_info_bank b
  WHERE b.client_id = p_client_id
    -- Gate de audiência: só Envolvidos/exec/GP-grupo/page-grant veem o card.
    AND cliente.pode_ver_cliente(p_client_id, auth.uid());
$$;

COMMENT ON FUNCTION cliente.card_universal(uuid) IS
  'Contrato: leitura consolidada (read-mostly) do Card Universal do cliente, de '
  'fonte única public.client_info_bank (ADR/CONTEXT). RETURNS TABLE (0/1 row). '
  'Audiência = quem pode_ver_cliente; não-envolvido recebe VAZIO (não erro). '
  'Edição é #79 (slice futura).';

REVOKE ALL ON FUNCTION cliente.card_universal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cliente.card_universal(uuid) TO authenticated, service_role;

-- =============================================================================
-- 3) Reorientação da RLS de leitura de public.client_info_bank.
--    Fecha o furo USING(true). Só LEITURA é tocada — escrita = #79.
-- =============================================================================
DROP POLICY IF EXISTS "select_client_info_bank_authenticated" ON public.client_info_bank;
CREATE POLICY "select_client_info_bank_visible"
  ON public.client_info_bank
  FOR SELECT
  TO authenticated
  USING (cliente.pode_ver_cliente(client_id, auth.uid()));
