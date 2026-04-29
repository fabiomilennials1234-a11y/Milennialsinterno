-- 20260430150000_profiles_is_admin_override.sql
--
-- Permite ao CEO conceder permissoes totais (equivalentes a CEO) a qualquer
-- usuario sem mudar o role. Implementa via flag em profiles.
--
-- - profiles.is_admin_override boolean default false
-- - is_admin() considera tanto user_roles quanto a flag override
-- - RPC set_admin_override(_target_user, _enabled): apenas admins podem chamar
--
-- Granularidade fina (page_grants) continua funcionando para casos onde
-- nao se quer dar TUDO. is_admin_override e o "kill switch" para promover
-- alguem a permissao total sem trocar role.

BEGIN;

-- ── Coluna em profiles ───────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin_override IS
  'Quando true, o usuario tem permissoes totais (equivalente a CEO/CTO/gestor_projetos) sem mudar role. Toggle controlado via RPC set_admin_override por admins.';

-- ── is_admin atualizado ──────────────────────────────────────────────────

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
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND is_admin_override IS TRUE
  );
$$;

COMMENT ON FUNCTION public.is_admin(uuid) IS
  'Retorna true se o user tem role admin (ceo/cto/gestor_projetos) OU se profiles.is_admin_override=true (concedido manualmente por admin).';

-- ── RPC set_admin_override ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_admin_override(_target_user uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'only admins can grant admin override' USING ERRCODE = '42501';
  END IF;

  IF _target_user IS NULL THEN
    RAISE EXCEPTION 'target user required' USING ERRCODE = '22023';
  END IF;

  -- Self-revoke nao permitido (evita admin se trancar fora).
  IF _target_user = v_caller AND _enabled IS FALSE THEN
    -- Permite se o caller ainda tem role admin.
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller AND role IN ('ceo','cto','gestor_projetos')
    ) THEN
      RAISE EXCEPTION 'cannot self-revoke override without admin role'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.profiles
     SET is_admin_override = _enabled
   WHERE user_id = _target_user;
END;
$$;

REVOKE ALL ON FUNCTION public.set_admin_override(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_admin_override(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.set_admin_override(uuid, boolean) IS
  'Toggle de permissoes totais. Apenas admins podem chamar. Auto-revoke proibido se caller sem role admin.';

COMMIT;
