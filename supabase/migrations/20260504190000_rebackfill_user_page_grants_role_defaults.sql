-- 20260504190000_rebackfill_user_page_grants_role_defaults.sql
--
-- P0 fix: re-backfill user_page_grants source='role_default' for ALL users.
--
-- Context:
--   After the cutover in 5c8daa6 (2026-04-30) PageAccessRoute uses
--   user_page_grants exclusively (fallbackRoles removed). Any user whose
--   role_default grants are missing or revoked sees "Acesso restrito" on
--   every non-admin page.
--
--   Possible causes of missing grants:
--     1. Original backfill (20260428171000) ran before user existed
--     2. admin_reconcile_user_page_grants called with wrong _role
--     3. Manual revoke without re-grant
--
--   This migration re-applies the canonical role->default-pages mapping
--   from admin_reconcile_user_page_grants for every user in user_roles.
--   Idempotent: ON CONFLICT re-activates revoked grants.
--
-- Safety:
--   - Does NOT revoke anything. Only inserts/re-activates.
--   - Re-run safe via ON CONFLICT DO UPDATE.
--   - Does NOT touch source='direct' grants.

BEGIN;

DO $$
DECLARE
  v_system_user uuid;
  v_inserted int := 0;
BEGIN
  -- System granter: first CEO, fallback CTO.
  SELECT ur.user_id INTO v_system_user
  FROM public.user_roles ur
  WHERE ur.role IN ('ceo', 'cto')
  ORDER BY CASE WHEN ur.role = 'ceo' THEN 0 ELSE 1 END, ur.created_at NULLS LAST
  LIMIT 1;

  IF v_system_user IS NULL THEN
    RAISE NOTICE '[rebackfill_role_defaults] No CEO/CTO found. Skipped.';
    RETURN;
  END IF;

  -- Canonical role -> default pages mapping.
  -- Mirrors the CASE in admin_reconcile_user_page_grants (20260430270000).
  WITH role_defaults(role, page_slug) AS (
    VALUES
      -- gestor_ads
      ('gestor_ads', 'gestor-ads'),
      ('gestor_ads', 'design'),
      ('gestor_ads', 'editor-video'),
      ('gestor_ads', 'devs'),
      ('gestor_ads', 'produtora'),
      ('gestor_ads', 'gestor-crm'),
      ('gestor_ads', 'consultor-comercial'),

      -- outbound
      ('outbound', 'gestor-ads'),
      ('outbound', 'design'),
      ('outbound', 'editor-video'),
      ('outbound', 'devs'),
      ('outbound', 'produtora'),
      ('outbound', 'gestor-crm'),
      ('outbound', 'consultor-comercial'),
      ('outbound', 'outbound'),

      -- sucesso_cliente
      ('sucesso_cliente', 'sucesso-cliente'),
      ('sucesso_cliente', 'gestor-ads'),
      ('sucesso_cliente', 'design'),
      ('sucesso_cliente', 'editor-video'),
      ('sucesso_cliente', 'devs'),
      ('sucesso_cliente', 'produtora'),
      ('sucesso_cliente', 'gestor-crm'),
      ('sucesso_cliente', 'consultor-comercial'),
      ('sucesso_cliente', 'rh'),
      ('sucesso_cliente', 'cliente-list'),
      ('sucesso_cliente', 'cadastro-clientes'),
      ('sucesso_cliente', 'upsells'),

      -- design
      ('design', 'design'),

      -- editor_video
      ('editor_video', 'editor-video'),

      -- devs
      ('devs', 'devs'),
      ('devs', 'design'),
      ('devs', 'mtech'),

      -- produtora
      ('produtora', 'produtora'),

      -- gestor_crm
      ('gestor_crm', 'gestor-crm'),

      -- consultor_comercial
      ('consultor_comercial', 'consultor-comercial'),

      -- consultor_mktplace
      ('consultor_mktplace', 'consultor-mktplace'),

      -- financeiro
      ('financeiro', 'financeiro'),
      ('financeiro', 'cliente-list'),
      ('financeiro', 'comissoes'),

      -- rh
      ('rh', 'rh'),

      -- ceo/cto/gestor_projetos: get all active pages
      -- Handled separately below via cross join with app_pages.
      ('_placeholder_', '_placeholder_')
  )
  INSERT INTO public.user_page_grants
    (user_id, page_slug, source, source_ref, granted_by, reason)
  SELECT
    ur.user_id,
    rd.page_slug,
    'role_default',
    NULL,
    v_system_user,
    'rebackfill role defaults (20260504190000)'
  FROM public.user_roles ur
  JOIN role_defaults rd ON rd.role = ur.role::text
  JOIN public.app_pages ap ON ap.slug = rd.page_slug AND ap.is_active
  WHERE rd.role <> '_placeholder_'
  ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
  DO UPDATE SET
    revoked_at = NULL,
    revoked_by = NULL,
    granted_by = v_system_user,
    granted_at = now(),
    reason = 'rebackfill role defaults (20260504190000)';

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE '[rebackfill_role_defaults] Non-admin grants inserted/reactivated: %', v_inserted;

  -- Admin roles (ceo, cto, gestor_projetos): grant ALL active pages.
  INSERT INTO public.user_page_grants
    (user_id, page_slug, source, source_ref, granted_by, reason)
  SELECT
    ur.user_id,
    ap.slug,
    'role_default',
    NULL,
    v_system_user,
    'rebackfill role defaults (20260504190000)'
  FROM public.user_roles ur
  CROSS JOIN public.app_pages ap
  WHERE ur.role::text IN ('ceo', 'cto', 'gestor_projetos')
    AND ap.is_active
  ON CONFLICT (user_id, page_slug, source) WHERE source_ref IS NULL
  DO UPDATE SET
    revoked_at = NULL,
    revoked_by = NULL,
    granted_by = v_system_user,
    granted_at = now(),
    reason = 'rebackfill role defaults (20260504190000)';

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE '[rebackfill_role_defaults] Admin grants inserted/reactivated: %', v_inserted;
END;
$$;

COMMIT;
