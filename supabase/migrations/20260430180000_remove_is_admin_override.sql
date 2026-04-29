-- 20260430180000_remove_is_admin_override.sql
--
-- Remove is_admin_override (substituido pelo modelo granular em
-- 20260430170000_permissions_full_granular_model.sql).
--
-- - is_admin() volta a considerar SOMENTE user_roles em ('ceo','cto','gestor_projetos').
-- - DROP da RPC set_admin_override.
-- - DROP da coluna profiles.is_admin_override.

BEGIN;

-- Restore is_admin original (sem flag override).
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

COMMENT ON FUNCTION public.is_admin(uuid) IS
  'Retorna true se o user tem role admin (ceo/cto/gestor_projetos). Granularidade fina foi para has_capability + user_capability_grants + user_action_overrides.';

-- Drop RPC e coluna.
DROP FUNCTION IF EXISTS public.set_admin_override(uuid, boolean);
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin_override;

COMMIT;
