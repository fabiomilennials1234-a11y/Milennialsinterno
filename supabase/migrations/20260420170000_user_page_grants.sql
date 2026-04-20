-- 20260420170000_user_page_grants.sql
--
-- Introduz modelo unificado de controle de acesso a páginas.
--
-- Motivação:
--   Hoje o acesso a páginas vive em 3 lugares desconectados:
--     1. profiles.additional_pages TEXT[] (granted per-user)
--     2. custom_roles.allowed_pages TEXT[] (applied opaquely at user-create time)
--     3. lookup implícito em BOARD_VISIBILITY no frontend
--   Resultado: impossível auditar "quem tem acesso ao quê", impossível revogar
--   granularmente, e não há backend de autoridade. O frontend era a fonte da
--   verdade — anti-pattern crítico.
--
-- Esta migration é ADITIVA e REVERSÍVEL:
--   - Cria app_pages (catálogo canônico de páginas)
--   - Cria user_page_grants (grants auditáveis com source, timestamps, revoke)
--   - Cria has_page_access(user, page) como autoridade única para consultas
--   - Cria RPCs get_my_page_access(), grant_pages(), revoke_page()
--   - Adiciona kanban_boards.allowed_roles[] e .page_slug (para alinhar boards
--     ao novo modelo, sem quebrar queries atuais)
--   - Faz BACKFILL idempotente de profiles.additional_pages e can_access_mtech
--
-- O que esta migration NÃO faz (proposital — destrutivo fica para depois):
--   - NÃO dropa profiles.additional_pages
--   - NÃO dropa profiles.can_access_mtech
--   - NÃO dropa custom_roles.allowed_pages
--   - NÃO altera can_view_board() — permanece intacto (leitura dupla 2 semanas)
--
-- Ordem do rollout planejado:
--   1. [ESTA MIGRATION] aplicar em staging
--   2. feature flag frontend lê get_my_page_access() paralelo a additional_pages
--   3. monitorar divergências 2 semanas
--   4. cutover: frontend usa exclusivamente get_my_page_access()
--   5. migration destrutiva: drop colunas legadas
--
-- RLS: todas as tabelas novas entram com RLS habilitado e policies explícitas.

BEGIN;

-- ============================================================================
-- PARTE A — Catálogo canônico de páginas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_pages (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  route TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('board', 'page', 'feature')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_pages IS
  'Catálogo canônico de páginas do produto. Qualquer grant em user_page_grants aponta para um slug aqui.';

ALTER TABLE public.app_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_pages select all authenticated" ON public.app_pages;
CREATE POLICY "app_pages select all authenticated" ON public.app_pages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_pages modify executive only" ON public.app_pages;
CREATE POLICY "app_pages modify executive only" ON public.app_pages
  FOR ALL TO authenticated
  USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

-- Seed baseado em src/components/admin/CreateUserModal.tsx → ALL_PAGES + rotas de src/App.tsx.
-- Ordem: boards operacionais → páginas administrativas → features.
INSERT INTO public.app_pages (slug, label, route, category) VALUES
  ('gestor-ads',         'Gestão de Tráfego PRO+',        '/kanban/ads',           'board'),
  ('sucesso-cliente',    'Sucesso do Cliente PRO+',       '/kanban/sucesso',       'board'),
  ('consultor-comercial','Treinador Comercial PRO+',      '/kanban/comercial',     'board'),
  ('financeiro',         'Financeiro PRO+',               '/financeiro',           'page'),
  ('gestor-projetos',    'Gestão de Projetos PRO+',       '/gestor-projetos',      'page'),
  ('gestor-crm',         'CRM PRO+',                      '/kanban/crm',           'board'),
  ('design',             'Design PRO+',                   '/kanban/design',        'board'),
  ('editor-video',       'Editor de Vídeo PRO+',          '/kanban/editor-video',  'board'),
  ('devs',               'Desenvolvedor PRO+',            '/kanban/devs',          'board'),
  ('atrizes-gravacao',   'Gravação PRO+',                 '/kanban/atrizes',       'board'),
  ('rh',                 'RH PRO+',                       '/rh',                   'page'),
  ('produtora',          'Produtora',                     '/kanban/produtora',     'board'),
  ('cliente-list',       'Lista de Clientes',             '/clientes',             'page'),
  ('cadastro-clientes',  'Cadastro de Clientes',          '/cadastro-clientes',    'page'),
  ('upsells',            'UP Sells',                      '/upsells',              'page'),
  ('comissoes',          'Comissões',                     '/comissoes',            'page'),
  ('mtech',              'Millennials Tech',              '/milennials-tech',      'feature')
ON CONFLICT (slug) DO UPDATE
  SET label = EXCLUDED.label,
      route = EXCLUDED.route,
      category = EXCLUDED.category;

-- ============================================================================
-- PARTE B — kanban_boards: allowed_roles[] e page_slug
-- ============================================================================
-- allowed_roles[] é whitelist explícita (substitui lookup mágico em BOARD_VISIBILITY).
-- '*' significa "qualquer role autenticado pode ver".
-- page_slug associa cada board a uma página canônica quando cabível (boards
-- globais como "design" apontam para slug "design"; boards de squad específico
-- não têm page_slug — escopo é via squad_id/group_id).

ALTER TABLE public.kanban_boards
  ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS page_slug TEXT REFERENCES public.app_pages(slug) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kanban_boards_page_slug
  ON public.kanban_boards(page_slug)
  WHERE page_slug IS NOT NULL;

COMMENT ON COLUMN public.kanban_boards.allowed_roles IS
  'Whitelist de roles com acesso ao board. [''*''] libera para todos autenticados. Vazio = apenas via squad/group/category scope.';
COMMENT ON COLUMN public.kanban_boards.page_slug IS
  'Associa o board a uma página canônica em app_pages, quando aplicável.';

-- ============================================================================
-- PARTE C — user_page_grants (auditável, reversível, com expiração)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_page_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_slug TEXT NOT NULL REFERENCES public.app_pages(slug) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('direct','custom_role','squad_role','role_default','migration')),
  source_ref UUID,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  reason TEXT,
  CONSTRAINT user_page_grants_revoke_consistency
    CHECK ((revoked_at IS NULL AND revoked_by IS NULL) OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL))
);

COMMENT ON TABLE public.user_page_grants IS
  'Grants auditáveis de acesso a páginas. Nunca DELETE — use revoked_at. UNIQUE garante idempotência por (user, page, source, source_ref).';

-- source_ref pode ser NULL (ex.: grant direto). UNIQUE precisa tratar NULL
-- explicitamente porque NULL != NULL em UNIQUE constraint padrão.
CREATE UNIQUE INDEX IF NOT EXISTS idx_upg_unique_with_ref
  ON public.user_page_grants(user_id, page_slug, source, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_upg_unique_no_ref
  ON public.user_page_grants(user_id, page_slug, source)
  WHERE source_ref IS NULL;

-- Index para o hot path: has_page_access() procura grants ativos por (user_id, page_slug).
CREATE INDEX IF NOT EXISTS idx_upg_user_page_active
  ON public.user_page_grants(user_id, page_slug)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_upg_user_active
  ON public.user_page_grants(user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.user_page_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upg select own or admin" ON public.user_page_grants;
CREATE POLICY "upg select own or admin" ON public.user_page_grants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "upg insert admin" ON public.user_page_grants;
CREATE POLICY "upg insert admin" ON public.user_page_grants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "upg update admin" ON public.user_page_grants;
CREATE POLICY "upg update admin" ON public.user_page_grants
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- DELETE é proibido — a auditoria exige histórico. Revogar via revoked_at.
DROP POLICY IF EXISTS "upg no delete" ON public.user_page_grants;
CREATE POLICY "upg no delete" ON public.user_page_grants
  FOR DELETE TO authenticated USING (false);

-- ============================================================================
-- PARTE D — Função de autoridade: has_page_access()
-- ============================================================================
-- Fonte única de verdade para "este usuário pode acessar esta página?".
-- Inclui bypass admin (ceo/cto/gestor_projetos) e consulta grants ativos.

CREATE OR REPLACE FUNCTION public.has_page_access(_user uuid, _page text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user IS NOT NULL
    AND (
      public.is_admin(_user)
      OR EXISTS (
        SELECT 1
        FROM public.user_page_grants g
        WHERE g.user_id = _user
          AND g.page_slug = _page
          AND g.revoked_at IS NULL
          AND (g.expires_at IS NULL OR g.expires_at > now())
      )
    );
$$;

REVOKE ALL ON FUNCTION public.has_page_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_page_access(uuid, text) TO authenticated;

-- ============================================================================
-- PARTE E — RPC helpers (chamados pelo frontend)
-- ============================================================================

-- get_my_page_access(): lista páginas ativas do caller.
-- Admin NÃO recebe '*' aqui — é lista explícita, porque o frontend pode
-- montar sidebar/menus com base no retorno. Para admin, chama is_admin() à parte.
CREATE OR REPLACE FUNCTION public.get_my_page_access()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT g.page_slug), ARRAY[]::text[])
  FROM public.user_page_grants g
  WHERE g.user_id = auth.uid()
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now());
$$;

REVOKE ALL ON FUNCTION public.get_my_page_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_page_access() TO authenticated;

-- grant_pages(): concessão em lote, idempotente. Reativar grant revogado é
-- intencional — UPDATE via ON CONFLICT zera revoked_at e atualiza granted_by.
CREATE OR REPLACE FUNCTION public.grant_pages(
  _user_id uuid,
  _page_slugs text[],
  _source text DEFAULT 'direct',
  _source_ref uuid DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count int := 0;
  v_page text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF _source NOT IN ('direct','custom_role','squad_role','role_default','migration') THEN
    RAISE EXCEPTION 'invalid source: %', _source USING ERRCODE = '22023';
  END IF;

  IF _page_slugs IS NULL OR array_length(_page_slugs, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Valida que todos os slugs existem em app_pages (falha ruidosa é melhor
  -- que grant pendurado em slug fantasma).
  FOREACH v_page IN ARRAY _page_slugs LOOP
    IF NOT EXISTS (SELECT 1 FROM public.app_pages WHERE slug = v_page AND is_active) THEN
      RAISE EXCEPTION 'unknown or inactive page_slug: %', v_page USING ERRCODE = '23503';
    END IF;
  END LOOP;

  -- source_ref NULL → usa idx_upg_unique_no_ref
  -- source_ref NOT NULL → usa idx_upg_unique_with_ref
  IF _source_ref IS NULL THEN
    INSERT INTO public.user_page_grants
      (user_id, page_slug, source, source_ref, granted_by, expires_at, reason)
    SELECT _user_id, s.slug, _source, NULL, v_caller, _expires_at, _reason
    FROM unnest(_page_slugs) AS s(slug)
    ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
    DO UPDATE SET
      revoked_at = NULL,
      revoked_by = NULL,
      granted_by = v_caller,
      granted_at = now(),
      expires_at = EXCLUDED.expires_at,
      reason = EXCLUDED.reason;
  ELSE
    INSERT INTO public.user_page_grants
      (user_id, page_slug, source, source_ref, granted_by, expires_at, reason)
    SELECT _user_id, s.slug, _source, _source_ref, v_caller, _expires_at, _reason
    FROM unnest(_page_slugs) AS s(slug)
    ON CONFLICT (user_id, page_slug, source, source_ref) WHERE source_ref IS NOT NULL
    DO UPDATE SET
      revoked_at = NULL,
      revoked_by = NULL,
      granted_by = v_caller,
      granted_at = now(),
      expires_at = EXCLUDED.expires_at,
      reason = EXCLUDED.reason;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_pages(uuid, text[], text, uuid, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_pages(uuid, text[], text, uuid, timestamptz, text) TO authenticated;

-- revoke_page(): marca grants ativos como revogados. Não deleta.
CREATE OR REPLACE FUNCTION public.revoke_page(
  _user_id uuid,
  _page_slug text,
  _reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_page_grants
  SET revoked_at = now(),
      revoked_by = v_caller,
      reason = COALESCE(_reason, reason)
  WHERE user_id = _user_id
    AND page_slug = _page_slug
    AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_page(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_page(uuid, text, text) TO authenticated;

-- ============================================================================
-- PARTE F — Backfill idempotente
-- ============================================================================
-- "System granter" é o primeiro CEO existente. Em banco vazio (ex.: reset
-- local sem seed), emite NOTICE e pula — admin refaz manualmente via grant_pages.

DO $$
DECLARE
  v_system_user uuid;
  v_inserted_from_additional int := 0;
  v_inserted_from_mtech int := 0;
BEGIN
  SELECT ur.user_id INTO v_system_user
  FROM public.user_roles ur
  WHERE ur.role = 'ceo'
  ORDER BY ur.created_at NULLS LAST
  LIMIT 1;

  IF v_system_user IS NULL THEN
    -- Em bancos sem CEO semeado, caiamos em qualquer 'cto' como fallback.
    SELECT ur.user_id INTO v_system_user
    FROM public.user_roles ur
    WHERE ur.role = 'cto'
    ORDER BY ur.created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF v_system_user IS NULL THEN
    RAISE NOTICE '[user_page_grants] Nenhum CEO/CTO encontrado em user_roles. Backfill PULADO. Admin precisa rodar grants manualmente.';
    RETURN;
  END IF;

  -- Backfill 1: profiles.additional_pages → user_page_grants (source='migration')
  -- Filtra slugs inexistentes em app_pages (defensivo contra lixo histórico).
  INSERT INTO public.user_page_grants
    (user_id, page_slug, source, source_ref, granted_by, reason)
  SELECT
    p.user_id,
    ap_src.page,
    'migration',
    NULL,
    v_system_user,
    'backfill from profiles.additional_pages (20260420170000)'
  FROM public.profiles p
  CROSS JOIN LATERAL unnest(p.additional_pages) AS ap_src(page)
  WHERE p.additional_pages IS NOT NULL
    AND array_length(p.additional_pages, 1) > 0
    AND EXISTS (SELECT 1 FROM public.app_pages ap WHERE ap.slug = ap_src.page AND ap.is_active)
  ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
  DO NOTHING;

  GET DIAGNOSTICS v_inserted_from_additional = ROW_COUNT;

  -- Backfill 2: can_access_mtech = true → grant para page 'mtech'
  INSERT INTO public.user_page_grants
    (user_id, page_slug, source, source_ref, granted_by, reason)
  SELECT
    p.user_id,
    'mtech',
    'migration',
    NULL,
    v_system_user,
    'backfill from profiles.can_access_mtech (20260420170000)'
  FROM public.profiles p
  WHERE p.can_access_mtech IS TRUE
  ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
  DO NOTHING;

  GET DIAGNOSTICS v_inserted_from_mtech = ROW_COUNT;

  RAISE NOTICE '[user_page_grants] Backfill: % grants de additional_pages, % grants de can_access_mtech. System granter: %',
    v_inserted_from_additional, v_inserted_from_mtech, v_system_user;
END;
$$;

-- ============================================================================
-- PARTE G — Backfill de kanban_boards.allowed_roles[] e page_slug
-- ============================================================================
-- Traduz BOARD_VISIBILITY (src/types/auth.ts) para allowed_roles por slug.
-- Admin (ceo/cto/gestor_projetos) sempre passa via can_view_board bypass,
-- então allowed_roles refletem apenas os papéis não-admin adicionais.
-- '*' = qualquer authenticated (boards compartilhados amplos).
--
-- Boards com escopo por squad/group/category NÃO recebem allowed_roles aqui —
-- continuam filtrados por can_view_board via user.squad_id/group_id/category_id.

-- Boards globais por papel (slug = nome do papel ou alias direto)
UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['design','devs','gestor_ads','outbound','sucesso_cliente'],
  page_slug = 'design'
WHERE slug = 'design' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['editor_video','atrizes_gravacao','gestor_ads','outbound','sucesso_cliente'],
  page_slug = 'editor-video'
WHERE slug = 'editor-video' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['devs','gestor_ads','outbound','sucesso_cliente'],
  page_slug = 'devs'
WHERE slug = 'devs' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['atrizes_gravacao','editor_video','gestor_ads','outbound','sucesso_cliente'],
  page_slug = 'atrizes-gravacao'
WHERE slug = 'atrizes' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['produtora','gestor_ads','outbound','sucesso_cliente'],
  page_slug = 'produtora'
WHERE slug = 'produtora' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['gestor_crm','gestor_ads','outbound','sucesso_cliente'],
  page_slug = 'gestor-crm'
WHERE slug IN ('crm','torque-crm') AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['consultor_comercial','gestor_ads','outbound','sucesso_cliente'],
  page_slug = 'consultor-comercial'
WHERE slug = 'comercial' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['gestor_ads','outbound','sucesso_cliente'],
  page_slug = 'gestor-ads'
WHERE slug = 'ads' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['sucesso_cliente'],
  page_slug = 'sucesso-cliente'
WHERE slug = 'sucesso' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['financeiro'],
  page_slug = 'financeiro'
WHERE slug = 'financeiro' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['rh','sucesso_cliente'],
  page_slug = 'rh'
WHERE slug = 'rh' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['outbound'],
  page_slug = NULL
WHERE slug = 'millennials-outbound' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['consultor_comercial'],
  page_slug = NULL
WHERE slug = 'millennials-paddock' AND allowed_roles = '{}';

UPDATE public.kanban_boards SET
  allowed_roles = ARRAY['consultor_mktplace'],
  page_slug = NULL
WHERE slug LIKE 'catalog-%' AND allowed_roles = '{}';

-- Board "ceo": só executivo (ceo/cto) — é_executive via admin bypass.
UPDATE public.kanban_boards SET
  allowed_roles = ARRAY[]::text[],
  page_slug = NULL
WHERE slug = 'ceo' AND allowed_roles = '{}';

COMMIT;

-- Nota pós-commit: este arquivo NÃO altera can_view_board() nem remove colunas
-- legadas. Essas mudanças são intencionalmente separadas por mandato do rollout
-- em etapas (veja cabeçalho).
