-- 20260430294000_rpc_list_users_by_role_for_page.sql
--
-- RPC SECURITY DEFINER que lista usuários por role, exigindo que o caller
-- tenha acesso à página de contexto (admin OU page_grant ativo).
-- Bypassa RLS de user_roles via DEFINER, mantendo gating no body.

CREATE OR REPLACE FUNCTION public.list_users_by_role_for_page(
  _role user_role,
  _page_slug text
)
RETURNS TABLE(user_id uuid, name text, email text, role user_role)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_access_page_data(v_caller, _page_slug) THEN
    RAISE EXCEPTION 'access denied: caller has no grant for page %', _page_slug
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT ur.user_id, p.name, p.email, ur.role
      FROM public.user_roles ur
      JOIN public.profiles p ON p.user_id = ur.user_id
     WHERE ur.role = _role
     ORDER BY p.name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_users_by_role_for_page(user_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_users_by_role_for_page(user_role, text) TO authenticated;
