-- 20260506100000_gestor_crm_update_clients_and_assign_rpc.sql
--
-- Two gaps blocking the CRM briefing flow:
--
-- 1. gestor_crm has SELECT on clients (via clients_select_visao_total) but no
--    UPDATE policy. CRM kanban hooks (useCrmKanban) update crm_status on
--    assigned clients (novo -> boas_vindas -> acompanhamento). Without UPDATE,
--    these writes are silently blocked by RLS.
--
-- 2. The "assign gestor CRM" flow in CrmGerarTarefaSection lets any user with
--    client view access pick a gestor_crm and assign them. The caller is NOT
--    necessarily the gestor_crm (could be sucesso_cliente, admin, etc.), and
--    the client has assigned_crm = NULL before assignment — so a simple policy
--    scoped to assigned_crm = auth.uid() doesn't cover this. An RPC handles
--    it atomically with proper authorization.
--
-- Fix:
--   A) UPDATE policy: gestor_crm can update their assigned clients
--   B) RPC assign_crm_gestor: sets assigned_crm + crm_status + crm_entered_at
--      Callable by gestor_crm, sucesso_cliente, admin, executive.

BEGIN;

-- =========================================================================
-- A) UPDATE policy — gestor_crm on assigned clients (kanban status moves)
-- =========================================================================

DROP POLICY IF EXISTS "Gestor CRM can update assigned clients" ON public.clients;

CREATE POLICY "Gestor CRM can update assigned clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'gestor_crm'::user_role)
    AND assigned_crm = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'gestor_crm'::user_role)
    AND assigned_crm = auth.uid()
  );

COMMENT ON POLICY "Gestor CRM can update assigned clients" ON public.clients IS
  'Allows gestor_crm to update their assigned clients. Required for CRM kanban status transitions (crm_status). Scoped to assigned_crm = auth.uid().';

-- =========================================================================
-- B) RPC assign_crm_gestor — initial assignment of gestor + CRM entry
-- =========================================================================

CREATE OR REPLACE FUNCTION public.assign_crm_gestor(
  _client_id uuid,
  _gestor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role user_role;
  v_gestor_role user_role;
  v_client_crm_status text;
  v_result jsonb;
BEGIN
  -- 1. Auth check
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- 2. Authorization: caller must be admin, executive, gestor_crm, or sucesso_cliente
  IF NOT (
    public.is_admin(v_caller)
    OR public.is_executive(v_caller)
    OR public.has_role(v_caller, 'gestor_crm'::user_role)
    OR public.has_role(v_caller, 'sucesso_cliente'::user_role)
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- 3. Validate target gestor is actually a gestor_crm
  SELECT ur.role INTO v_gestor_role
    FROM user_roles ur
   WHERE ur.user_id = _gestor_id
     AND ur.role = 'gestor_crm'::user_role
   LIMIT 1;

  IF v_gestor_role IS NULL THEN
    RAISE EXCEPTION 'target user is not a gestor_crm' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Validate client exists
  SELECT c.crm_status INTO v_client_crm_status
    FROM clients c
   WHERE c.id = _client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Update — set assigned_crm; also enter CRM flow if not already in it
  UPDATE clients
     SET assigned_crm   = _gestor_id,
         crm_status     = CASE WHEN crm_status IS NULL THEN 'novo' ELSE crm_status END,
         crm_entered_at = CASE WHEN crm_status IS NULL THEN now() ELSE crm_entered_at END,
         updated_at     = now()
   WHERE id = _client_id
   RETURNING jsonb_build_object(
     'id', id,
     'assigned_crm', assigned_crm,
     'crm_status', crm_status,
     'crm_entered_at', crm_entered_at
   ) INTO v_result;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.assign_crm_gestor(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_crm_gestor(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.assign_crm_gestor(uuid, uuid) IS
  'Assigns a gestor_crm to a client and enters the CRM flow (crm_status=novo) if not already started. Callable by admin, executive, gestor_crm, sucesso_cliente.';

COMMIT;
