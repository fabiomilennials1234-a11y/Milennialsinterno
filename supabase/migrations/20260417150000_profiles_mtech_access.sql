-- 20260417150000_profiles_mtech_access.sql
-- Additive per-user mtech access flag + guard trigger.
--
-- Keeps the existing role gate (ceo/cto/devs) intact and layers an OR on top,
-- so any user whose profiles.can_access_mtech is TRUE can also see the module,
-- regardless of cargo. The BEFORE UPDATE trigger ensures only admin roles
-- (ceo/cto/gestor_projetos/sucesso_cliente) can change the flag — RLS cannot
-- enforce column-level invariants on UPDATE.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_access_mtech BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_see_tech(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('ceo','cto','devs')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = _user_id AND can_access_mtech IS TRUE
    )
$$;

CREATE OR REPLACE FUNCTION public.profiles_guard_mtech_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.can_access_mtech IS DISTINCT FROM OLD.can_access_mtech THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('ceo','cto','gestor_projetos','sucesso_cliente')
    ) THEN
      RAISE EXCEPTION 'Only admin roles may change can_access_mtech'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_mtech_access ON public.profiles;

CREATE TRIGGER trg_profiles_guard_mtech_access
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_mtech_access();
