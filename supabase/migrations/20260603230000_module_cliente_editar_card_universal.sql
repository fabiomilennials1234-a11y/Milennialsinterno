-- 20260603230000_module_cliente_editar_card_universal.sql
-- Slice 3 (#79) — Card Universal de Cliente (ESCRITA). ADR 0004 + ADR 0005 §3.
--
-- Contexto: a LEITURA do client_info_bank já é gateada por cliente.pode_ver_cliente
-- (Slice 1, migration 20260603140000). A ESCRITA ainda está ABERTA:
-- as policies insert_/update_client_info_bank_authenticated usam WITH CHECK(true)
-- e o grant de INSERT/UPDATE/DELETE em `authenticated` está ativo → QUALQUER
-- authenticated escreve o banco de info de QUALQUER cliente (furo LGPD/confidencial).
-- Esta migration FECHA esse flanco, espelhando o slice de leitura: um ÚNICO dono
-- da escrita com o MESMO gate de audiência.
--
-- Entrega:
--   1. cliente.editar_card_universal(p_client_id, ...campos) — contrato de ESCRITA
--      consolidada (SECURITY DEFINER, search_path=''). Gate de autorização via
--      cliente.pode_ver_cliente (senão 42501) + existência via cliente.existe
--      (senão P0002); depois INSERT ... ON CONFLICT em public.client_info_bank.
--      Sem literal de role (só helpers canônicos) → guard no_literal_role_in_policy
--      e baseline de literais permanecem verdes.
--   2. public.upsert_client_info_bank (legado, 16 args, assinatura INALTERADA)
--      passa a DELEGAR a cliente.editar_card_universal — um só lugar com o gate;
--      a UI legada (useClientInfoBank.ts) não muda.
--   3. Fecha a escrita direta de public.client_info_bank: REVOKE INSERT/UPDATE/
--      DELETE de authenticated + DROP das policies de insert/update soltas.
--      MANTÉM select_client_info_bank_visible (leitura gateada da Slice 1) e
--      delete_client_info_bank_admin (DELETE só admin; o grant é revogado, mas
--      o caminho admin passa pela RPC/owner SECURITY DEFINER — sem regressão).
--   4. Fecha os 3 perfis legados: REVOKE INSERT/UPDATE/DELETE de authenticated +
--      NEUTRALIZA os RPCs upsert_client_{design,video,dev}_profile com
--      RAISE 'deprecated: use client_info_bank'. MANTÉM SELECT (leitores legados
--      das colunas ricas). Sem DROP físico de tabela.
--
-- Idempotente: CREATE OR REPLACE, DROP POLICY IF EXISTS, REVOKE (no-op se já
-- revogado). Reexecutável sem efeito colateral.

-- =============================================================================
-- 1) cliente.editar_card_universal — contrato de ESCRITA consolidada.
--    Mesma lista de campos de domínio do card (espelha public.client_info_bank
--    e cliente.card_universal). NULL = "não mexer" (COALESCE no UPSERT).
-- =============================================================================
CREATE OR REPLACE FUNCTION cliente.editar_card_universal(
  p_client_id        uuid,
  -- Marca
  p_brand_colors     text DEFAULT NULL,
  p_typography       text DEFAULT NULL,
  p_visual_style     text DEFAULT NULL,
  p_brand_manual_url text DEFAULT NULL,
  p_logo_url         text DEFAULT NULL,
  -- Presença Digital
  p_website_url      text DEFAULT NULL,
  p_instagram_handle text DEFAULT NULL,
  p_youtube_channel  text DEFAULT NULL,
  p_tiktok_handle    text DEFAULT NULL,
  p_domain           text DEFAULT NULL,
  -- Vídeo
  p_editing_style    text DEFAULT NULL,
  p_video_formats    text DEFAULT NULL,
  -- Dev
  p_cms_platform     text DEFAULT NULL,
  p_figma_url        text DEFAULT NULL,
  -- Geral
  p_notes            text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_id     uuid;
BEGIN
  -- Gate de autorização: só quem PODE VER o cliente pode editar o card
  -- (mesmo predicado da leitura — ADR 0005). 42501 = insufficient_privilege.
  IF NOT cliente.pode_ver_cliente(p_client_id, v_caller) THEN
    RAISE EXCEPTION 'sem permissão para editar o card deste cliente'
      USING ERRCODE = '42501';
  END IF;

  -- Gate de existência (anti-órfão): o cliente precisa existir. P0002 = no_data_found.
  IF NOT cliente.existe(p_client_id) THEN
    RAISE EXCEPTION 'cliente não encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  -- UPSERT idempotente. NULL preserva o valor atual (COALESCE).
  INSERT INTO public.client_info_bank (
    client_id,
    brand_colors, typography, visual_style, brand_manual_url, logo_url,
    website_url, instagram_handle, youtube_channel, tiktok_handle, domain,
    editing_style, video_formats,
    cms_platform, figma_url,
    notes,
    created_by, updated_by
  ) VALUES (
    p_client_id,
    p_brand_colors, p_typography, p_visual_style, p_brand_manual_url, p_logo_url,
    p_website_url, p_instagram_handle, p_youtube_channel, p_tiktok_handle, p_domain,
    p_editing_style, p_video_formats,
    p_cms_platform, p_figma_url,
    p_notes,
    v_caller, v_caller
  )
  ON CONFLICT (client_id) DO UPDATE SET
    brand_colors     = COALESCE(EXCLUDED.brand_colors, public.client_info_bank.brand_colors),
    typography       = COALESCE(EXCLUDED.typography, public.client_info_bank.typography),
    visual_style     = COALESCE(EXCLUDED.visual_style, public.client_info_bank.visual_style),
    brand_manual_url = COALESCE(EXCLUDED.brand_manual_url, public.client_info_bank.brand_manual_url),
    logo_url         = COALESCE(EXCLUDED.logo_url, public.client_info_bank.logo_url),
    website_url      = COALESCE(EXCLUDED.website_url, public.client_info_bank.website_url),
    instagram_handle = COALESCE(EXCLUDED.instagram_handle, public.client_info_bank.instagram_handle),
    youtube_channel  = COALESCE(EXCLUDED.youtube_channel, public.client_info_bank.youtube_channel),
    tiktok_handle    = COALESCE(EXCLUDED.tiktok_handle, public.client_info_bank.tiktok_handle),
    domain           = COALESCE(EXCLUDED.domain, public.client_info_bank.domain),
    editing_style    = COALESCE(EXCLUDED.editing_style, public.client_info_bank.editing_style),
    video_formats    = COALESCE(EXCLUDED.video_formats, public.client_info_bank.video_formats),
    cms_platform     = COALESCE(EXCLUDED.cms_platform, public.client_info_bank.cms_platform),
    figma_url        = COALESCE(EXCLUDED.figma_url, public.client_info_bank.figma_url),
    notes            = COALESCE(EXCLUDED.notes, public.client_info_bank.notes),
    updated_by       = v_caller,
    updated_at       = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION cliente.editar_card_universal(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) IS
  'Contrato: ESCRITA consolidada (UPSERT) do Card Universal do cliente, de fonte '
  'única public.client_info_bank (ADR 0004/0005). ÚNICO dono da escrita: gate de '
  'autorização = cliente.pode_ver_cliente (42501) + existência = cliente.existe '
  '(P0002). public.upsert_client_info_bank delega a esta função. NULL preserva '
  'valor atual (COALESCE).';

REVOKE ALL ON FUNCTION cliente.editar_card_universal(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cliente.editar_card_universal(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;

-- =============================================================================
-- 2) public.upsert_client_info_bank (legado, 16 args) → DELEGA ao kernel.
--    Assinatura INALTERADA (a UI legada via RPC continua idêntica). O gate agora
--    vive num só lugar (cliente.editar_card_universal).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_client_info_bank(
  p_client_id        uuid,
  p_brand_colors     text DEFAULT NULL,
  p_typography       text DEFAULT NULL,
  p_visual_style     text DEFAULT NULL,
  p_brand_manual_url text DEFAULT NULL,
  p_logo_url         text DEFAULT NULL,
  p_website_url      text DEFAULT NULL,
  p_instagram_handle text DEFAULT NULL,
  p_youtube_channel  text DEFAULT NULL,
  p_tiktok_handle    text DEFAULT NULL,
  p_domain           text DEFAULT NULL,
  p_editing_style    text DEFAULT NULL,
  p_video_formats    text DEFAULT NULL,
  p_cms_platform     text DEFAULT NULL,
  p_figma_url        text DEFAULT NULL,
  p_notes            text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  -- Delegação pura: o kernel cliente.editar_card_universal é o ÚNICO dono do gate
  -- e do UPSERT. Mantém o contrato legado (16 args, mesma ordem de campos).
  SELECT cliente.editar_card_universal(
    p_client_id,
    p_brand_colors, p_typography, p_visual_style, p_brand_manual_url, p_logo_url,
    p_website_url, p_instagram_handle, p_youtube_channel, p_tiktok_handle, p_domain,
    p_editing_style, p_video_formats,
    p_cms_platform, p_figma_url,
    p_notes
  );
$$;

COMMENT ON FUNCTION public.upsert_client_info_bank(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) IS
  'LEGADO (assinatura preservada): delega a cliente.editar_card_universal. O gate '
  'de autorização/existência vive no kernel. Novos chamadores usam o módulo '
  'cliente (barrel) diretamente.';

REVOKE ALL ON FUNCTION public.upsert_client_info_bank(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_client_info_bank(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;

-- =============================================================================
-- 3) Fecha a ESCRITA DIRETA de public.client_info_bank.
--    REVOKE grants de escrita + DROP das policies WITH CHECK(true). Leitura
--    (select_client_info_bank_visible) e DELETE-admin (delete_client_info_bank_admin)
--    INTACTOS. Toda escrita passa a obrigatoriamente pela RPC (owner-bypass).
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.client_info_bank FROM authenticated;

DROP POLICY IF EXISTS "insert_client_info_bank_authenticated" ON public.client_info_bank;
DROP POLICY IF EXISTS "update_client_info_bank_authenticated" ON public.client_info_bank;
-- Cobre também o nome legado do projeto inicial (defensivo/idempotente).
DROP POLICY IF EXISTS "insert_client_info_bank" ON public.client_info_bank;
DROP POLICY IF EXISTS "update_client_info_bank" ON public.client_info_bank;

-- =============================================================================
-- 4) Fecha os 3 perfis legados (escrita) e NEUTRALIZA seus RPCs de upsert.
--    MANTÉM SELECT (colunas ricas além do info bank; leitores legados). Sem DROP
--    físico — consolidação foi feita; tabelas ficam só-leitura até remoção futura.
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.client_design_profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_video_profiles  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.client_dev_profiles    FROM authenticated;

-- Neutraliza os RPCs legados de upsert (assinaturas EXATAS preservadas — vide
-- pg_get_function_identity_arguments no DB remoto). Qualquer chamada agora levanta
-- 'deprecated'. Sem DROP — preserva dependências/grants e mantém o contrato.
CREATE OR REPLACE FUNCTION public.upsert_client_design_profile(
  p_client_id uuid,
  p_brand_colors text DEFAULT NULL,
  p_typography text DEFAULT NULL,
  p_visual_style text DEFAULT NULL,
  p_brand_manual_url text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_instagram_handle text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'deprecated: use client_info_bank (cliente.editar_card_universal)';
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_client_video_profile(
  p_client_id uuid,
  p_editing_style text DEFAULT NULL,
  p_video_format text DEFAULT NULL,
  p_resolution text DEFAULT NULL,
  p_youtube_channel text DEFAULT NULL,
  p_tiktok_handle text DEFAULT NULL,
  p_instagram_handle text DEFAULT NULL,
  p_pacing text DEFAULT NULL,
  p_music_style text DEFAULT NULL,
  p_intro_outro_url text DEFAULT NULL,
  p_reference_urls text DEFAULT NULL,
  p_brand_assets_url text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'deprecated: use client_info_bank (cliente.editar_card_universal)';
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_client_dev_profile(
  p_client_id uuid,
  p_frontend_stack text DEFAULT NULL,
  p_css_framework text DEFAULT NULL,
  p_cms_platform text DEFAULT NULL,
  p_hosting_provider text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_staging_url text DEFAULT NULL,
  p_repository_url text DEFAULT NULL,
  p_figma_url text DEFAULT NULL,
  p_analytics_id text DEFAULT NULL,
  p_api_docs_url text DEFAULT NULL,
  p_deploy_notes text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'deprecated: use client_info_bank (cliente.editar_card_universal)';
END;
$$;
