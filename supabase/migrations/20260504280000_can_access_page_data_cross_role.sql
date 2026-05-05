-- 20260504280000_can_access_page_data_cross_role.sql
--
-- Fix: extend can_access_page_data role fallback to cover cross-role access
-- defined in ROLE_PAGE_MATRIX (frontend src/types/auth.ts).
--
-- Context:
--   Previous migration (20260504250000) added a native-role fallback:
--   devs -> 'devs', design -> 'design', etc. But ROLE_PAGE_MATRIX grants
--   cross-role access (e.g., devs can access 'design' page, gestor_ads
--   can access 'devs'/'design'/'editor-video' pages). Without cross-role
--   coverage, list_users_by_role_for_page raises 42501 and the board
--   renders empty even though PageAccessRoute (frontend) allows through.
--
--   Bug: Gabriel (role: devs) accesses /design -> PageAccessRoute allows
--   (ROLE_PAGE_MATRIX has devs->design) -> but list_users_by_role_for_page
--   calls can_access_page_data which denies (no grant, native fallback
--   only matches devs->devs) -> board shows "Nenhum designer cadastrado".
--
-- Fix:
--   Expand the role fallback to mirror ROLE_PAGE_MATRIX cross-role entries.
--   Every (page_slug, role) pair declared in the matrix is now allowed.
--
-- Safety:
--   - Strictly additive — never denies what was allowed.
--   - Sensitive slugs still require source='direct' grant (unchanged).
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

  -- Role-based fallback: mirrors ROLE_PAGE_MATRIX from frontend.
  -- Covers BOTH native role access (devs->devs) AND cross-role access
  -- (devs->design, gestor_ads->editor-video, etc.).
  --
  -- This mapping is the SQL equivalent of getRolesWithPageSlug() in
  -- src/types/auth.ts. Keep in sync when ROLE_PAGE_MATRIX changes.
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        -- gestor-ads: gestor_ads, outbound, sucesso_cliente
        (_page_slug = 'gestor-ads'       AND ur.role IN ('gestor_ads', 'outbound', 'sucesso_cliente'))
        -- design: design, gestor_ads, outbound, sucesso_cliente, devs
        OR (_page_slug = 'design'        AND ur.role IN ('design', 'gestor_ads', 'outbound', 'sucesso_cliente', 'devs'))
        -- editor-video: editor_video, gestor_ads, outbound, sucesso_cliente
        OR (_page_slug = 'editor-video'  AND ur.role IN ('editor_video', 'gestor_ads', 'outbound', 'sucesso_cliente'))
        -- devs: devs, gestor_ads, outbound, sucesso_cliente
        OR (_page_slug = 'devs'          AND ur.role IN ('devs', 'gestor_ads', 'outbound', 'sucesso_cliente'))
        -- produtora: produtora, gestor_ads, outbound, sucesso_cliente
        OR (_page_slug = 'produtora'     AND ur.role IN ('produtora', 'gestor_ads', 'outbound', 'sucesso_cliente'))
        -- gestor-crm: gestor_crm, gestor_ads, outbound, sucesso_cliente
        OR (_page_slug = 'gestor-crm'    AND ur.role IN ('gestor_crm', 'gestor_ads', 'outbound', 'sucesso_cliente'))
        -- consultor-comercial: consultor_comercial, gestor_ads, outbound, sucesso_cliente
        OR (_page_slug = 'consultor-comercial' AND ur.role IN ('consultor_comercial', 'gestor_ads', 'outbound', 'sucesso_cliente'))
        -- outbound: outbound
        OR (_page_slug = 'outbound'      AND ur.role = 'outbound')
        -- sucesso-cliente: sucesso_cliente
        OR (_page_slug = 'sucesso-cliente' AND ur.role = 'sucesso_cliente')
        -- consultor-mktplace: consultor_mktplace
        OR (_page_slug = 'consultor-mktplace' AND ur.role = 'consultor_mktplace')
        -- financeiro: financeiro
        OR (_page_slug = 'financeiro'    AND ur.role = 'financeiro')
        -- rh: rh (no matrix entries, but keep native fallback)
        OR (_page_slug = 'rh'            AND ur.role = 'rh')
        -- cliente-list: sucesso_cliente, financeiro
        OR (_page_slug = 'cliente-list'  AND ur.role IN ('sucesso_cliente', 'financeiro'))
        -- cadastro-clientes: sucesso_cliente
        OR (_page_slug = 'cadastro-clientes' AND ur.role = 'sucesso_cliente')
        -- upsells: sucesso_cliente
        OR (_page_slug = 'upsells'       AND ur.role = 'sucesso_cliente')
        -- comissoes: financeiro
        OR (_page_slug = 'comissoes'     AND ur.role = 'financeiro')
      )
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_page_data(uuid, text) IS
  'Helper canonico para visao total via page_grant. Slugs sensiveis (app_pages.is_sensitive=true) exigem grant explicito source=direct. Slugs normais: has_page_access OU fallback por ROLE_PAGE_MATRIX (native + cross-role).';

COMMIT;
