-- 20260417160000_profiles_mtech_access_rpc.sql
-- Fix-up for 20260417150000:
--   (a) Relax the trigger so service_role writes (auth.uid() IS NULL) pass.
--       Admin-role enforcement moves to the RPC below for client writes.
--   (b) Introduce public.set_mtech_access(_user_id, _value): the canonical
--       path for ceo/cto/gestor_projetos/sucesso_cliente to toggle the flag
--       from the frontend. Uses SECURITY DEFINER so it bypasses the profiles
--       RLS UPDATE policy, which otherwise blocks gestor_projetos and
--       sucesso_cliente from touching other users' rows.

-- (a) Relax the trigger
CREATE OR REPLACE FUNCTION public.profiles_guard_mtech_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.can_access_mtech IS DISTINCT FROM OLD.can_access_mtech THEN
    -- service_role / internal writes: no session user.
    -- RPCs below and edge-function admin clients both hit this path.
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
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

-- (b) Canonical RPC for client-side toggling
CREATE OR REPLACE FUNCTION public.set_mtech_access(_user_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('ceo','cto','gestor_projetos','sucesso_cliente')
  ) THEN
    RAISE EXCEPTION 'Only admin roles may change can_access_mtech'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET can_access_mtech = _value
   WHERE user_id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_mtech_access(uuid, boolean) TO authenticated;
