-- Patch: create_client_with_automations now persists assigned_sucesso_cliente.
-- Pre-existing RPC ignored the field silently when forms started sending it.
-- Cirurgical edits: declare v_assigned_sucesso, parse from payload, include in INSERT.

DO $migration$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc WHERE proname = 'create_client_with_automations' LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'create_client_with_automations not found';
  END IF;

  IF v_def ILIKE '%assigned_sucesso_cliente%' THEN
    RAISE NOTICE 'create_client_with_automations already patched, skipping';
    RETURN;
  END IF;

  v_new := v_def;
  v_new := replace(v_new,
    'v_assigned_outb      uuid;',
    E'v_assigned_outb      uuid;\n  v_assigned_sucesso   uuid;');
  v_new := replace(v_new,
    E'v_assigned_outb  := NULLIF(p_payload->>''assigned_outbound_manager'','''')::uuid;',
    E'v_assigned_outb  := NULLIF(p_payload->>''assigned_outbound_manager'','''')::uuid;\n  v_assigned_sucesso := NULLIF(p_payload->>''assigned_sucesso_cliente'','''')::uuid;');
  v_new := replace(v_new,
    'assigned_crm, assigned_rh, assigned_outbound_manager, assigned_mktplace,',
    'assigned_crm, assigned_rh, assigned_outbound_manager, assigned_mktplace, assigned_sucesso_cliente,');
  v_new := replace(v_new,
    E'CASE WHEN v_assigned_mktp IS NULL THEN NULL ELSE v_assigned_mktp::text END,',
    E'CASE WHEN v_assigned_mktp IS NULL THEN NULL ELSE v_assigned_mktp::text END,\n    v_assigned_sucesso,');

  EXECUTE v_new;
END
$migration$;
