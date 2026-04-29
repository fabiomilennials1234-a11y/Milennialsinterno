-- 20260428170000_reconcile_user_page_grants.sql
--
-- P0.1: preparar cutover do modelo de permissões por user_page_grants.
--
-- Problema:
--   grant_pages() é apenas aditivo. O Create/Edit User fazia dual-write só das
--   additional_pages, então o modelo novo não refletia defaults por cargo e não
--   revogava páginas removidas no modal.
--
-- Solução:
--   reconcile_page_grants() recebe a lista desejada por source e faz:
--     1. grant idempotente das páginas desejadas;
--     2. revoke dos grants ativos daquela source que não estão mais na lista.
--
-- A função é aditiva e só afeta callers que passarem a usá-la.

BEGIN;

CREATE OR REPLACE FUNCTION public.reconcile_page_grants(
  _user_id uuid,
  _page_slugs text[],
  _source text DEFAULT 'direct',
  _source_ref uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_page text;
  v_granted int := 0;
  v_revoked int := 0;
  v_pages text[] := COALESCE(_page_slugs, ARRAY[]::text[]);
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

  FOREACH v_page IN ARRAY v_pages LOOP
    IF NOT EXISTS (SELECT 1 FROM public.app_pages WHERE slug = v_page AND is_active) THEN
      RAISE EXCEPTION 'unknown or inactive page_slug: %', v_page USING ERRCODE = '23503';
    END IF;
  END LOOP;

  IF array_length(v_pages, 1) IS NOT NULL THEN
    SELECT public.grant_pages(
      _user_id,
      v_pages,
      _source,
      _source_ref,
      NULL,
      COALESCE(_reason, 'reconcile_page_grants')
    )
    INTO v_granted;
  END IF;

  IF _source_ref IS NULL THEN
    UPDATE public.user_page_grants
       SET revoked_at = now(),
           revoked_by = v_caller,
           reason = COALESCE(_reason, reason)
     WHERE user_id = _user_id
       AND source = _source
       AND source_ref IS NULL
       AND revoked_at IS NULL
       AND NOT (page_slug = ANY(v_pages));
  ELSE
    UPDATE public.user_page_grants
       SET revoked_at = now(),
           revoked_by = v_caller,
           reason = COALESCE(_reason, reason)
     WHERE user_id = _user_id
       AND source = _source
       AND source_ref = _source_ref
       AND revoked_at IS NULL
       AND NOT (page_slug = ANY(v_pages));
  END IF;

  GET DIAGNOSTICS v_revoked = ROW_COUNT;

  RETURN jsonb_build_object(
    'granted_or_refreshed', COALESCE(v_granted, 0),
    'revoked', v_revoked,
    'source', _source
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_page_grants(uuid, text[], text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_page_grants(uuid, text[], text, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.reconcile_page_grants(uuid, text[], text, uuid, text) IS
  'Reconciles active user_page_grants for a source: grants desired page slugs and revokes active grants no longer desired. Added for P0 permission cutover.';

COMMIT;
