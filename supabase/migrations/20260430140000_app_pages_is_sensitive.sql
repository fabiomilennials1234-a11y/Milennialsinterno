-- 20260430140000_app_pages_is_sensitive.sql
--
-- Marca slugs sensiveis em app_pages. Slug sensivel exige page_grant
-- explicito (manual, source='direct') — role default NAO basta.
--
-- can_access_page_data ganha checagem extra: se slug e sensivel, o grant
-- precisa ser source='direct' (concedido manualmente por admin), nao
-- 'role_default'.

BEGIN;

ALTER TABLE public.app_pages
  ADD COLUMN IF NOT EXISTS is_sensitive boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.app_pages.is_sensitive IS
  'Quando true, o slug exige page_grant explicito (source=direct) para liberar dados. Role default nao basta.';

-- Marca rh-candidatos como sensivel se ja existir.
INSERT INTO public.app_pages (slug, label, route, category, is_active, is_sensitive)
VALUES ('rh-candidatos', 'Candidatos RH (PII)', '/rh/candidatos', 'page', true, true)
ON CONFLICT (slug) DO UPDATE SET is_sensitive = true;

-- Atualiza can_access_page_data para respeitar is_sensitive.
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

  -- Slug normal: has_page_access (inclui role default + grant explicito).
  RETURN public.has_page_access(_user_id, _page_slug);
END;
$$;

COMMENT ON FUNCTION public.can_access_page_data(uuid, text) IS
  'Helper canonico para visao total via page_grant. Slugs sensiveis (app_pages.is_sensitive=true) exigem grant explicito source=direct, nao role default.';

COMMIT;
