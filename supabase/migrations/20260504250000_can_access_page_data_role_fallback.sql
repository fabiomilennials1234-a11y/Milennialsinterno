-- 20260504250000_can_access_page_data_role_fallback.sql
--
-- P0 fix: add role-based fallback to can_access_page_data.
--
-- Context:
--   PageAccessRoute (frontend route guard) has defense-in-depth: if
--   user_page_grants is missing/revoked but the user's role is in
--   ROLE_PAGE_MATRIX for that page, user is let through (with warning).
--
--   The data RPC list_users_by_role_for_page has NO such fallback — it
--   calls can_access_page_data which is grants-only. When grants are
--   absent (backfill timing, reconcile bug, manual revoke without
--   re-grant), the RPC raises 42501 and the board shows empty state
--   even though the user can see the page.
--
--   This migration adds a role-based fallback: if the caller's native
--   role maps to the requested page_slug, allow through even without
--   an explicit grant. Only NATIVE role (role name ~ page slug), not
--   cross-role access. Cross-role still requires grants.
--
-- Safety:
--   - SECURITY DEFINER, STABLE preserved.
--   - Sensitive slugs still require source='direct' (no change).
--   - Fallback is strictly additive — never denies what was allowed.
--   - Mapping is static and mirrors admin_reconcile_user_page_grants.
--   - Idempotent via CREATE OR REPLACE.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_page_data(_user_id uuid, _page_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_sensitive boolean;
BEGIN
  IF _user_id IS NULL OR _page_slug IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  SELECT is_sensitive INTO v_is_sensitive
  FROM public.app_pages
  WHERE slug = _page_slug;

  IF v_is_sensitive IS TRUE THEN
    -- Slug sensivel: exige grant explicito (source='direct'), nao role default.
    RETURN EXISTS (
      SELECT 1
      FROM public.user_page_grants g
      WHERE g.user_id = _user_id
        AND g.page_slug = _page_slug
        AND g.source = 'direct'
        AND g.revoked_at IS NULL
        AND (g.expires_at IS NULL OR g.expires_at > now())
    );
  END IF;

  -- Primary path: grant-based check.
  IF public.has_page_access(_user_id, _page_slug) THEN
    RETURN true;
  END IF;

  -- Role-based fallback: mirrors PageAccessRoute defense-in-depth.
  -- If the user's NATIVE role maps to this page_slug, allow through
  -- even without an explicit grant. Covers backfill gaps, reconcile
  -- bugs, and race conditions between user creation and grant backfill.
  --
  -- Only native role -> page mapping. Cross-role access (e.g.,
  -- gestor_ads viewing devs board) still requires explicit grants.
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        (_page_slug = 'devs'                AND ur.role = 'devs')
        OR (_page_slug = 'design'           AND ur.role = 'design')
        OR (_page_slug = 'editor-video'     AND ur.role = 'editor_video')
        OR (_page_slug = 'produtora'        AND ur.role = 'produtora')
        OR (_page_slug = 'gestor-ads'       AND ur.role = 'gestor_ads')
        OR (_page_slug = 'sucesso-cliente'  AND ur.role = 'sucesso_cliente')
        OR (_page_slug = 'consultor-comercial' AND ur.role = 'consultor_comercial')
        OR (_page_slug = 'consultor-mktplace'  AND ur.role = 'consultor_mktplace')
        OR (_page_slug = 'outbound'         AND ur.role = 'outbound')
        OR (_page_slug = 'financeiro'       AND ur.role = 'financeiro')
        OR (_page_slug = 'rh'              AND ur.role = 'rh')
        OR (_page_slug = 'gestor-crm'      AND ur.role = 'gestor_crm')
      )
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_page_data(uuid, text) IS
  'Helper canonico para visao total via page_grant. Slugs sensiveis (app_pages.is_sensitive=true) exigem grant explicito source=direct. Slugs normais: has_page_access OU fallback por role nativo.';

COMMIT;
