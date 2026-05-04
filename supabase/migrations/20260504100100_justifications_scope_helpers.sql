-- supabase/migrations/20260504100100_justifications_scope_helpers.sql

CREATE OR REPLACE FUNCTION public.get_team_users_in_scope()
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  caller_group_id uuid;
BEGIN
  IF caller_id IS NULL THEN RETURN; END IF;

  SELECT ur.role INTO caller_role
    FROM public.user_roles ur
    WHERE ur.user_id = caller_id
    LIMIT 1;

  SELECT p.group_id INTO caller_group_id
    FROM public.profiles p
    WHERE p.user_id = caller_id
    LIMIT 1;

  IF public.is_ceo(caller_id) OR caller_role = 'gestor_projetos' THEN
    RETURN QUERY SELECT p.user_id FROM public.profiles p;
    RETURN;
  END IF;

  IF caller_role = 'gestor_ads' THEN
    RETURN QUERY
      SELECT p.user_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = caller_group_id
        AND ur.role IN ('gestor_ads','sucesso_cliente');
    RETURN;
  END IF;

  IF caller_role = 'sucesso_cliente' THEN
    RETURN QUERY
      SELECT p.user_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = caller_group_id
        AND ur.role = 'gestor_ads';
    RETURN;
  END IF;

  IF caller_role = 'gestor_crm' THEN
    RETURN QUERY
      SELECT p.user_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.group_id = caller_group_id
        AND ur.role IN ('gestor_crm','consultor_comercial');
    RETURN;
  END IF;

  RETURN;
END $$;

REVOKE ALL ON FUNCTION public.get_team_users_in_scope() FROM public;
GRANT EXECUTE ON FUNCTION public.get_team_users_in_scope() TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_user_in_my_scope(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target user required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.get_team_users_in_scope() s
    WHERE s.user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'target user out of caller scope';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.assert_user_in_my_scope(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.assert_user_in_my_scope(uuid) TO authenticated;
