-- Hotfix: get_crm_config_collective_justifications had ambiguous user_id reference
-- inside the EXISTS subquery (PL/pgSQL OUT param vs table column). Qualify with alias.
-- Caught during smoke E2E in prod (42702 ambiguous column).

CREATE OR REPLACE FUNCTION public.get_crm_config_collective_justifications(
  p_config_id uuid
)
RETURNS TABLE (
  pending_id        uuid,
  user_id           uuid,
  user_role         text,
  user_name         text,
  justification     text,
  justified_at      timestamptz,
  detected_at       timestamptz,
  is_pending        boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $func$
DECLARE
  v_uid       uuid := auth.uid();
  v_involved  boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_ceo(v_uid) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.crm_delay_justification_pending p
      WHERE p.config_id = p_config_id
        AND p.user_id   = v_uid
    ) INTO v_involved;

    IF NOT v_involved THEN
      RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
    SELECT
      p.id                      AS pending_id,
      p.user_id,
      p.user_role,
      COALESCE(pr.name, 'Usuario') AS user_name,
      j.justification,
      p.justified_at,
      p.detected_at,
      (p.justified_at IS NULL AND p.dismissed_at IS NULL) AS is_pending
    FROM public.crm_delay_justification_pending p
    LEFT JOIN public.profiles pr                ON pr.user_id = p.user_id
    LEFT JOIN public.task_delay_justifications j ON j.id       = p.justification_id
    WHERE p.config_id = p_config_id
    ORDER BY
      CASE p.user_role
        WHEN 'gestor_crm'           THEN 1
        WHEN 'consultor_comercial'  THEN 2
        WHEN 'gestor_ads'           THEN 3
        WHEN 'sucesso_cliente'      THEN 4
        ELSE 99
      END;
END;
$func$;
