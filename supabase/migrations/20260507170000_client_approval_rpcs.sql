-- ============================================================
-- RPCs for Client Approval / Rejection
-- Used by the new "Área de Clientes" page.
-- Clients coming from API M2M (TorqueCRM) arrive with
-- cx_validation_status = 'aguardando_validacao'. Admins
-- approve (filling assignments, product, value) or reject.
-- ============================================================

-- ============================================================
-- 1. approve_client
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_client(
  p_client_id uuid,
  p_assignments jsonb DEFAULT '{}'::jsonb,
  p_contracted_products text[] DEFAULT NULL,
  p_monthly_value numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_current_status text;
  v_update_data jsonb;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not authorized — requires admin role' USING ERRCODE = '42501';
  END IF;

  -- Validate client exists and is pending
  SELECT cx_validation_status INTO v_current_status
  FROM clients
  WHERE id = p_client_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_current_status != 'aguardando_validacao' THEN
    RAISE EXCEPTION 'client is not pending approval (current: %)', v_current_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Build the update
  UPDATE clients SET
    cx_validation_status = 'validado',
    cx_validated_at = now(),
    cx_validated_by = v_caller,
    -- Assignments from jsonb (each key is optional)
    assigned_ads_manager = COALESCE((p_assignments->>'assigned_ads_manager')::uuid, assigned_ads_manager),
    assigned_sucesso_cliente = COALESCE((p_assignments->>'assigned_sucesso_cliente')::uuid, assigned_sucesso_cliente),
    assigned_comercial = COALESCE((p_assignments->>'assigned_comercial')::uuid, assigned_comercial),
    assigned_crm = COALESCE((p_assignments->>'assigned_crm')::uuid, assigned_crm),
    assigned_outbound_manager = COALESCE((p_assignments->>'assigned_outbound_manager')::uuid, assigned_outbound_manager),
    assigned_mktplace = COALESCE(p_assignments->>'assigned_mktplace', assigned_mktplace),
    -- Products and value
    contracted_products = COALESCE(p_contracted_products, contracted_products),
    monthly_value = COALESCE(p_monthly_value, monthly_value),
    updated_at = now()
  WHERE id = p_client_id;

  RETURN jsonb_build_object(
    'success', true,
    'client_id', p_client_id,
    'approved_by', v_caller,
    'approved_at', now()
  );
END
$$;

REVOKE ALL ON FUNCTION public.approve_client(uuid, jsonb, text[], numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_client(uuid, jsonb, text[], numeric) TO authenticated;

-- ============================================================
-- 2. reject_client
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_client(
  p_client_id uuid,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_current_status text;
BEGIN
  -- Auth guard
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'not authorized — requires admin role' USING ERRCODE = '42501';
  END IF;

  -- Validate client exists and is pending
  SELECT cx_validation_status INTO v_current_status
  FROM clients
  WHERE id = p_client_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_current_status != 'aguardando_validacao' THEN
    RAISE EXCEPTION 'client is not pending approval (current: %)', v_current_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE clients SET
    cx_validation_status = 'reprovado',
    cx_validation_notes = COALESCE(p_rejection_reason, cx_validation_notes),
    cx_validated_at = now(),
    cx_validated_by = v_caller,
    updated_at = now()
  WHERE id = p_client_id;

  RETURN jsonb_build_object(
    'success', true,
    'client_id', p_client_id,
    'rejected_by', v_caller,
    'rejected_at', now()
  );
END
$$;

REVOKE ALL ON FUNCTION public.reject_client(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_client(uuid, text) TO authenticated;
