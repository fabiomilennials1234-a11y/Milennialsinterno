-- 20260415120001_add_cto_role_functions.sql
-- Creates is_executive() helper and updates is_admin() to include CTO.
-- Separate from enum migration because new enum values must be committed first.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_executive(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('ceo','cto')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_executive(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('ceo','cto','gestor_projetos')
  );
$$;

COMMIT;
