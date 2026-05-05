-- 20260504290000_fix_reconcile_devs_mtech.sql
--
-- Fix: migration 280000 criou overload 1-param ao invés de atualizar 6-param.
-- Edge functions usam versão 6-param que ainda tinha 'mtech' hardcoded nos
-- defaults de devs. Isso causava erro ao salvar edição de usuário dev.
--
-- 1. Dropa overload 1-param (acidental, não é usada)
-- 2. Atualiza versão 6-param: devs → ARRAY['devs','design'] (sem 'mtech')

BEGIN;

-- 1. Remove overload 1-param acidental
DROP FUNCTION IF EXISTS public.admin_reconcile_user_page_grants(uuid);

-- 2. Atualiza versão 6-param para remover 'mtech' de devs defaults
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
SET search_path TO 'public'
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
      WHEN 'devs' THEN ARRAY['devs','design']
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

  FOREACH v_page IN ARRAY (v_role_defaults || v_direct) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.app_pages WHERE slug = v_page AND is_active) THEN
      RAISE EXCEPTION 'unknown or inactive page_slug: %', v_page USING ERRCODE = '23503';
    END IF;
  END LOOP;

  -- Reconcile role_default
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

  -- Reconcile direct
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
GRANT EXECUTE ON FUNCTION public.admin_reconcile_user_page_grants(uuid, uuid, text, text[], boolean, text) TO authenticated;

COMMIT;
