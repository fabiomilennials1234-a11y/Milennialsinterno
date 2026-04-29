-- 20260429103000_upsert_kanban_briefing_rpc.sql
--
-- P1: centraliza upsert de briefings dos kanbans no backend.
-- A criacao do card ja estava transacional via RPC, mas o briefing ainda era
-- inserido/atualizado diretamente pelo frontend. Esta RPC aplica a mesma
-- permissao canonica de acao antes de gravar o detalhe.

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_kanban_briefing(
  _card_id uuid,
  _briefing_type text,
  _payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_board_id uuid;
  v_type text := lower(coalesce(_briefing_type, ''));
  v_table text;
  v_allowed_fields text[];
  v_existing_id uuid;
  v_field text;
  v_insert_columns text[] := ARRAY['card_id'];
  v_insert_values text[] := ARRAY[quote_nullable(_card_id::text)];
  v_update_sets text[] := ARRAY[]::text[];
  v_result jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF _card_id IS NULL THEN
    RAISE EXCEPTION 'card_id required' USING ERRCODE = '22023';
  END IF;

  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload object required' USING ERRCODE = '22023';
  END IF;

  SELECT board_id INTO v_board_id
  FROM public.kanban_cards
  WHERE id = _card_id;

  IF v_board_id IS NULL THEN
    RAISE EXCEPTION 'card not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_operate_kanban_card(v_caller, v_board_id, 'edit_briefing') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  CASE v_type
    WHEN 'design' THEN
      v_table := 'design_briefings';
      v_allowed_fields := ARRAY['description','references_url','identity_url','client_instagram','script_url'];
    WHEN 'video' THEN
      v_table := 'video_briefings';
      v_allowed_fields := ARRAY['script_url','observations','materials_url','reference_video_url','identity_url'];
    WHEN 'dev' THEN
      v_table := 'dev_briefings';
      v_allowed_fields := ARRAY['script_url','observations','materials_url','reference_video_url','identity_url'];
    WHEN 'produtora' THEN
      v_table := 'produtora_briefings';
      v_allowed_fields := ARRAY['script_url','observations','reference_video_url'];
    WHEN 'atrizes' THEN
      v_table := 'atrizes_briefings';
      v_allowed_fields := ARRAY['client_instagram','script_url','drive_upload_url'];
    ELSE
      RAISE EXCEPTION 'unsupported briefing type: %', _briefing_type USING ERRCODE = '22023';
  END CASE;

  FOREACH v_field IN ARRAY v_allowed_fields LOOP
    IF _payload ? v_field THEN
      v_insert_columns := v_insert_columns || quote_ident(v_field);
      v_insert_values := v_insert_values || quote_nullable(_payload ->> v_field);
      v_update_sets := v_update_sets || format('%I = %s', v_field, quote_nullable(_payload ->> v_field));
    END IF;
  END LOOP;

  IF array_length(v_update_sets, 1) IS NULL THEN
    RAISE EXCEPTION 'payload has no supported fields' USING ERRCODE = '22023';
  END IF;

  EXECUTE format('SELECT id FROM public.%I WHERE card_id = $1', v_table)
    INTO v_existing_id
    USING _card_id;

  IF v_existing_id IS NULL THEN
    v_insert_columns := v_insert_columns || 'created_by';
    v_insert_values := v_insert_values || quote_nullable(v_caller::text);

    EXECUTE format(
      'INSERT INTO public.%I (%s) VALUES (%s) RETURNING to_jsonb(%I.*)',
      v_table,
      array_to_string(v_insert_columns, ', '),
      array_to_string(v_insert_values, ', '),
      v_table
    )
    INTO v_result;
  ELSE
    EXECUTE format(
      'UPDATE public.%I SET %s, updated_at = now() WHERE card_id = %L RETURNING to_jsonb(%I.*)',
      v_table,
      array_to_string(v_update_sets, ', '),
      _card_id,
      v_table
    )
    INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_kanban_briefing(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_kanban_briefing(uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.upsert_kanban_briefing(uuid, text, jsonb) IS
  'Insere/atualiza briefing de kanban com whitelist por tipo e validacao can_operate_kanban_card(edit_briefing).';

COMMIT;
