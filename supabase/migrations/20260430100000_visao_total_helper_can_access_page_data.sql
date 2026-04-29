-- 20260430100000_visao_total_helper_can_access_page_data.sql
--
-- Helper canonico para "visao TOTAL via page_grant".
-- Wrapper sobre has_page_access + is_admin com semantica explicita:
--   - admin sempre passa
--   - usuario com page_grant (manual ou role default) passa
--   - todo o resto e false
--
-- Marcado STABLE pra permitir memoizacao do planner em RLS.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_access_page_data(_user_id uuid, _page_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _page_slug IS NOT NULL
    AND (
      public.is_admin(_user_id)
      OR public.has_page_access(_user_id, _page_slug)
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_page_data(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_page_data(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.can_access_page_data(uuid, text) IS
  'Helper canonico para visao total via page_grant. Use em policies RLS junto com filtros de assignment para abrir dados quando o user tem grant.';

COMMIT;
