-- Fixes encontrados no smoke E2E (28/04/2026):
--   BUG#1 — list_active_clients_minimal não permitia gestor_crm/cto
--   BUG#2 — crm_delay_pending_select fazia self-join recursivo (42P17)

-- ── BUG#1: incluir gestor_crm + cto no gate ──────────────────────────────
CREATE OR REPLACE FUNCTION public.list_active_clients_minimal()
RETURNS TABLE(id uuid, name text, razao_social text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'ceo'::user_role)
    OR public.has_role(auth.uid(), 'cto'::user_role)
    OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)
    OR public.has_role(auth.uid(), 'gestor_ads'::user_role)
    OR public.has_role(auth.uid(), 'gestor_crm'::user_role)
    OR public.has_role(auth.uid(), 'consultor_comercial'::user_role)
    OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)
    OR public.has_role(auth.uid(), 'financeiro'::user_role)
    OR public.has_role(auth.uid(), 'outbound'::user_role)
  ) THEN
    RAISE EXCEPTION 'forbidden: role not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.razao_social
  FROM public.clients c
  WHERE c.archived = false
  ORDER BY c.name ASC;
END;
$func$;

-- ── BUG#2: eliminar self-recursion do RLS de crm_delay_justification_pending ──
-- A policy original fazia EXISTS sobre a própria tabela, causando 42P17.
-- Substituo por SECURITY DEFINER helper que verifica envolvimento via JOIN com
-- crm_configuracoes (tabela diferente, sem ciclo).

CREATE OR REPLACE FUNCTION public.user_is_crm_pending_involved(p_config_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid uuid := auth.uid();
  v_cli uuid;
  v_creator uuid;
  v_assigned_comercial uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT cfg.client_id, cfg.created_by, c.assigned_comercial
    INTO v_cli, v_creator, v_assigned_comercial
  FROM public.crm_configuracoes cfg
  JOIN public.clients c ON c.id = cfg.client_id
  WHERE cfg.id = p_config_id;

  IF v_cli IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = v_cli
      AND (
        c.assigned_crm              = v_uid
        OR c.assigned_comercial     = v_uid
        OR c.assigned_ads_manager   = v_uid
        OR c.assigned_sucesso_cliente = v_uid
      )
  ) OR v_creator = v_uid;
END;
$func$;

REVOKE ALL ON FUNCTION public.user_is_crm_pending_involved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_crm_pending_involved(uuid) TO authenticated;

DROP POLICY IF EXISTS crm_delay_pending_select ON public.crm_delay_justification_pending;
CREATE POLICY crm_delay_pending_select ON public.crm_delay_justification_pending
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ceo(auth.uid())
    OR public.user_is_crm_pending_involved(config_id)
  );
