-- 20260430270000_admin_reconcile_user_page_grants.sql
--
-- P0.2: cutover do dual-write. As edge functions create-user/update-user passam
-- a sincronizar user_page_grants direto via service_role, eliminando o passo
-- client-side atras de feature flag.
--
-- A reconcile_page_grants() existente exige auth.uid() (caller jwt do admin).
-- Edge functions chamam com service_role -> auth.uid() = NULL -> falha.
--
-- Nova RPC admin_reconcile_user_page_grants:
--   - aceita _caller_id explicito (passado pela edge depois de validar JWT)
--   - valida is_admin(_caller_id) (mesma defesa em profundidade)
--   - faz tudo em UMA chamada: deriva role_default a partir de _role, monta
--     direct a partir de _additional_pages + (_can_access_mtech ? 'mtech' : []),
--     e reconcilia AMBAS as sources num unico statement transacional
--
-- O mapping role -> default pages e a "single source of truth" canonica.
-- Espelha pageCatalog.ts/DEFAULT_PAGES_BY_ROLE no frontend e a CTE de
-- 20260428171000_align_app_pages_and_role_defaults. Quando mudar um, mudar
-- o outro (acoplamento intencional - role permission matrix).

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_reconcile_user_page_grants(
  _caller_id uuid,
  _user_id uuid,
  _role text,
  _additional_pages text[] DEFAULT ARRAY[]::text[],
  _can_access_mtech boolean DEFAULT false,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_defaults text[];
  v_direct text[];
  v_all_pages text[];
  v_granted_role int := 0;
  v_revoked_role int := 0;
  v_granted_direct int := 0;
  v_revoked_direct int := 0;
  v_page text;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'caller required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(_caller_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required' USING ERRCODE = '22023';
  END IF;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'role required' USING ERRCODE = '22023';
  END IF;

  -- role -> default pages.
  -- ceo/cto/gestor_projetos veem tudo (mesmo bypass que is_admin), mas
  -- gravamos role_default explicito pra que get_my_page_access retorne lista
  -- consistente sem depender do bypass admin no client.
  IF _role IN ('ceo', 'cto', 'gestor_projetos') THEN
    SELECT COALESCE(array_agg(slug ORDER BY slug), ARRAY[]::text[])
      INTO v_all_pages
      FROM public.app_pages
     WHERE is_active;
    v_role_defaults := v_all_pages;
  ELSE
    v_role_defaults := CASE _role
      WHEN 'gestor_ads' THEN ARRAY[
        'gestor-ads','design','editor-video','devs','produtora',
        'gestor-crm','consultor-comercial'
      ]
      WHEN 'outbound' THEN ARRAY[
        'gestor-ads','design','editor-video','devs','produtora',
        'gestor-crm','consultor-comercial','outbound'
      ]
      WHEN 'sucesso_cliente' THEN ARRAY[
        'sucesso-cliente','gestor-ads','design','editor-video','devs',
        'produtora','gestor-crm','consultor-comercial','rh',
        'cliente-list','cadastro-clientes','upsells'
      ]
      WHEN 'design' THEN ARRAY['design']
      WHEN 'editor_video' THEN ARRAY['editor-video']
      WHEN 'devs' THEN ARRAY['devs','design','mtech']
      WHEN 'produtora' THEN ARRAY['produtora']
      WHEN 'gestor_crm' THEN ARRAY['gestor-crm']
      WHEN 'consultor_comercial' THEN ARRAY['consultor-comercial']
      WHEN 'consultor_mktplace' THEN ARRAY['consultor-mktplace']
      WHEN 'financeiro' THEN ARRAY['financeiro','cliente-list','comissoes']
      WHEN 'rh' THEN ARRAY['rh']
      ELSE ARRAY[]::text[]
    END;
  END IF;

  -- direct = additional_pages + (mtech ? ['mtech'] : []) deduplicado/ordenado.
  WITH src AS (
    SELECT unnest(COALESCE(_additional_pages, ARRAY[]::text[])) AS slug
    UNION
    SELECT 'mtech' WHERE _can_access_mtech
  )
  SELECT COALESCE(array_agg(slug ORDER BY slug), ARRAY[]::text[])
    INTO v_direct
    FROM src
   WHERE slug IS NOT NULL AND slug <> '';

  -- Valida que todos os slugs existem e estao ativos. Mesma logica de grant_pages,
  -- mas centralizada aqui pra evitar 2 falhas parciais.
  FOREACH v_page IN ARRAY (v_role_defaults || v_direct) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.app_pages WHERE slug = v_page AND is_active) THEN
      RAISE EXCEPTION 'unknown or inactive page_slug: %', v_page USING ERRCODE = '23503';
    END IF;
  END LOOP;

  -- Reconcile role_default ----------------------------------------------------
  IF array_length(v_role_defaults, 1) IS NOT NULL THEN
    INSERT INTO public.user_page_grants
      (user_id, page_slug, source, source_ref, granted_by, reason)
    SELECT _user_id, s.slug, 'role_default', NULL, _caller_id,
           COALESCE(_reason, 'admin_reconcile_user_page_grants')
    FROM unnest(v_role_defaults) AS s(slug)
    ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
    DO UPDATE SET
      revoked_at = NULL,
      revoked_by = NULL,
      granted_by = _caller_id,
      granted_at = now(),
      reason = EXCLUDED.reason;
    GET DIAGNOSTICS v_granted_role = ROW_COUNT;
  END IF;

  UPDATE public.user_page_grants
     SET revoked_at = now(),
         revoked_by = _caller_id,
         reason = COALESCE(_reason, reason)
   WHERE user_id = _user_id
     AND source = 'role_default'
     AND source_ref IS NULL
     AND revoked_at IS NULL
     AND NOT (page_slug = ANY(v_role_defaults));
  GET DIAGNOSTICS v_revoked_role = ROW_COUNT;

  -- Reconcile direct ----------------------------------------------------------
  IF array_length(v_direct, 1) IS NOT NULL THEN
    INSERT INTO public.user_page_grants
      (user_id, page_slug, source, source_ref, granted_by, reason)
    SELECT _user_id, s.slug, 'direct', NULL, _caller_id,
           COALESCE(_reason, 'admin_reconcile_user_page_grants')
    FROM unnest(v_direct) AS s(slug)
    ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
    DO UPDATE SET
      revoked_at = NULL,
      revoked_by = NULL,
      granted_by = _caller_id,
      granted_at = now(),
      reason = EXCLUDED.reason;
    GET DIAGNOSTICS v_granted_direct = ROW_COUNT;
  END IF;

  UPDATE public.user_page_grants
     SET revoked_at = now(),
         revoked_by = _caller_id,
         reason = COALESCE(_reason, reason)
   WHERE user_id = _user_id
     AND source = 'direct'
     AND source_ref IS NULL
     AND revoked_at IS NULL
     AND NOT (page_slug = ANY(v_direct));
  GET DIAGNOSTICS v_revoked_direct = ROW_COUNT;

  RETURN jsonb_build_object(
    'role_default', jsonb_build_object(
      'desired', v_role_defaults,
      'granted_or_refreshed', v_granted_role,
      'revoked', v_revoked_role
    ),
    'direct', jsonb_build_object(
      'desired', v_direct,
      'granted_or_refreshed', v_granted_direct,
      'revoked', v_revoked_direct
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reconcile_user_page_grants(uuid, uuid, text, text[], boolean, text) FROM PUBLIC;

-- service_role e o caller real. authenticated tambem recebe execute pra que o
-- role-default check (is_admin) decida; mantem paridade com reconcile_page_grants.
GRANT EXECUTE ON FUNCTION public.admin_reconcile_user_page_grants(uuid, uuid, text, text[], boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_user_page_grants(uuid, uuid, text, text[], boolean, text) TO authenticated;

COMMENT ON FUNCTION public.admin_reconcile_user_page_grants(uuid, uuid, text, text[], boolean, text) IS
  'Reconciles user_page_grants for both role_default and direct sources atomically. Accepts explicit _caller_id so service_role callers (edge functions) can pass the JWT-validated user. Single SQL source of truth for role -> default pages mapping.';

-- ============================================================================
-- set_mtech_access: tambem precisa sincronizar user_page_grants (source='direct',
-- slug='mtech') pra que o cutover do flag client-side nao deixe o toggle do
-- modal Users com permission state divergente.
--
-- Mantemos a logica admin-role check (ceo/cto/gestor_projetos/sucesso_cliente)
-- e adicionamos grant/revoke inline. Nao usa admin_reconcile_user_page_grants
-- porque sucesso_cliente nao e is_admin() e queremos preservar a permissao
-- atual do toggle. Comportamento: liga/desliga apenas o slug 'mtech', sem
-- mexer em outros direct grants.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_mtech_access(_user_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller
      AND role IN ('ceo','cto','gestor_projetos','sucesso_cliente')
  ) THEN
    RAISE EXCEPTION 'Only admin roles may change can_access_mtech'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET can_access_mtech = _value
   WHERE user_id = _user_id;

  IF _value THEN
    INSERT INTO public.user_page_grants
      (user_id, page_slug, source, source_ref, granted_by, reason)
    VALUES
      (_user_id, 'mtech', 'direct', NULL, v_caller, 'set_mtech_access toggle on')
    ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
    DO UPDATE SET
      revoked_at = NULL,
      revoked_by = NULL,
      granted_by = v_caller,
      granted_at = now(),
      reason = EXCLUDED.reason;
  ELSE
    UPDATE public.user_page_grants
       SET revoked_at = now(),
           revoked_by = v_caller,
           reason = 'set_mtech_access toggle off'
     WHERE user_id = _user_id
       AND page_slug = 'mtech'
       AND source = 'direct'
       AND source_ref IS NULL
       AND revoked_at IS NULL;
  END IF;
END;
$$;

COMMIT;
