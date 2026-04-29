-- 20260428203000_kanban_card_operation_rpcs.sql
--
-- P1: contratos transacionais para operacoes de kanban.
--
-- Antes, o frontend fazia insert/update/delete direto em kanban_cards e, no
-- movimento, reordenava cards em multiplas chamadas. Isso deixava espaco para
-- estado parcial e regras de permissao divergentes. As RPCs abaixo centralizam
-- autorizacao, log de atividade e reordenacao no banco.

BEGIN;

CREATE OR REPLACE FUNCTION public.kanban_create_card(
  _board_id uuid,
  _column_id uuid,
  _title text,
  _description text DEFAULT NULL,
  _priority text DEFAULT 'medium',
  _due_date date DEFAULT NULL,
  _assigned_to uuid DEFAULT NULL,
  _tags text[] DEFAULT NULL,
  _status text DEFAULT NULL,
  _card_type text DEFAULT NULL,
  _client_id uuid DEFAULT NULL
)
RETURNS public.kanban_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_column_board_id uuid;
  v_position integer;
  v_card public.kanban_cards;
  v_column_title text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NULLIF(BTRIM(_title), '') IS NULL THEN
    RAISE EXCEPTION 'title required' USING ERRCODE = '22023';
  END IF;

  SELECT board_id, title
    INTO v_column_board_id, v_column_title
  FROM public.kanban_columns
  WHERE id = _column_id;

  IF v_column_board_id IS NULL OR v_column_board_id <> _board_id THEN
    RAISE EXCEPTION 'column does not belong to board' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_view_board(v_caller, _board_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_column_id::text, 0));

  SELECT COALESCE(MAX(position), -1) + 1
    INTO v_position
  FROM public.kanban_cards
  WHERE column_id = _column_id
    AND COALESCE(archived, false) = false
    AND (_status IS NULL OR status IS NOT DISTINCT FROM _status);

  INSERT INTO public.kanban_cards (
    board_id,
    column_id,
    client_id,
    title,
    description,
    priority,
    due_date,
    assigned_to,
    tags,
    status,
    card_type,
    position,
    created_by,
    progress
  )
  VALUES (
    _board_id,
    _column_id,
    _client_id,
    BTRIM(_title),
    _description,
    COALESCE(_priority, 'medium'),
    _due_date,
    _assigned_to,
    _tags,
    _status,
    _card_type,
    v_position,
    v_caller,
    0
  )
  RETURNING * INTO v_card;

  INSERT INTO public.card_activities (card_id, user_id, action, details)
  VALUES (
    v_card.id,
    v_caller,
    'created',
    jsonb_build_object('title', v_card.title, 'to', COALESCE(v_column_title, 'Coluna'))
  );

  RETURN v_card;
END;
$$;

CREATE OR REPLACE FUNCTION public.kanban_move_card(
  _card_id uuid,
  _destination_column_id uuid,
  _new_position integer,
  _destination_status text DEFAULT NULL
)
RETURNS public.kanban_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_card public.kanban_cards;
  v_destination_board_id uuid;
  v_source_column_title text;
  v_destination_column_title text;
  v_source_lock bigint;
  v_destination_lock bigint;
  v_card_ids uuid[];
  v_normalized_position integer;
  v_id uuid;
  v_idx integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_card
  FROM public.kanban_cards
  WHERE id = _card_id;

  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'card not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_view_card(v_caller, _card_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT board_id, title
    INTO v_destination_board_id, v_destination_column_title
  FROM public.kanban_columns
  WHERE id = _destination_column_id;

  IF v_destination_board_id IS NULL OR v_destination_board_id <> v_card.board_id THEN
    RAISE EXCEPTION 'destination column does not belong to card board' USING ERRCODE = '22023';
  END IF;

  SELECT title INTO v_source_column_title
  FROM public.kanban_columns
  WHERE id = v_card.column_id;

  v_source_lock := hashtextextended(v_card.column_id::text, 0);
  v_destination_lock := hashtextextended(_destination_column_id::text, 0);

  IF v_source_lock <= v_destination_lock THEN
    PERFORM pg_advisory_xact_lock(v_source_lock);
    PERFORM pg_advisory_xact_lock(v_destination_lock);
  ELSE
    PERFORM pg_advisory_xact_lock(v_destination_lock);
    PERFORM pg_advisory_xact_lock(v_source_lock);
  END IF;

  SELECT GREATEST(0, _new_position) INTO v_normalized_position;

  UPDATE public.kanban_cards
  SET
    column_id = _destination_column_id,
    position = v_normalized_position,
    status = COALESCE(_destination_status, status),
    updated_at = now()
  WHERE id = _card_id
  RETURNING * INTO v_card;

  SELECT ARRAY(
    SELECT id
    FROM public.kanban_cards
    WHERE column_id = _destination_column_id
      AND id <> _card_id
      AND COALESCE(archived, false) = false
      AND status IS NOT DISTINCT FROM v_card.status
    ORDER BY position ASC, updated_at ASC, id ASC
  ) INTO v_card_ids;

  FOREACH v_id IN ARRAY COALESCE(v_card_ids, ARRAY[]::uuid[]) LOOP
    IF v_idx = v_normalized_position THEN
      v_idx := v_idx + 1;
    END IF;

    UPDATE public.kanban_cards
    SET position = v_idx, updated_at = now()
    WHERE id = v_id AND position IS DISTINCT FROM v_idx;

    v_idx := v_idx + 1;
  END LOOP;

  UPDATE public.kanban_cards
  SET position = v_normalized_position, updated_at = now()
  WHERE id = _card_id
  RETURNING * INTO v_card;

  INSERT INTO public.card_activities (card_id, user_id, action, details)
  VALUES (
    _card_id,
    v_caller,
    'moved',
    jsonb_build_object(
      'from_column', v_source_column_title,
      'to_column', v_destination_column_title,
      'from_status', NULLIF(v_card.status, COALESCE(_destination_status, v_card.status)),
      'to_status', _destination_status
    )
  );

  RETURN v_card;
END;
$$;

CREATE OR REPLACE FUNCTION public.kanban_archive_card(_card_id uuid)
RETURNS public.kanban_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_card public.kanban_cards;
  v_archived_at timestamptz := now();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.can_view_card(v_caller, _card_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.kanban_cards
  SET archived = true, archived_at = v_archived_at, updated_at = now()
  WHERE id = _card_id
  RETURNING * INTO v_card;

  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'card not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.card_activities (card_id, user_id, action, details)
  VALUES (_card_id, v_caller, 'archived', jsonb_build_object('archived_at', v_archived_at));

  RETURN v_card;
END;
$$;

CREATE OR REPLACE FUNCTION public.kanban_delete_card(_card_id uuid)
RETURNS uuid
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

  IF NOT public.can_view_card(v_caller, _card_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.kanban_cards
  WHERE id = _card_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'card not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN _card_id;
END;
$$;

REVOKE ALL ON FUNCTION public.kanban_create_card(uuid, uuid, text, text, text, date, uuid, text[], text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kanban_move_card(uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kanban_archive_card(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kanban_delete_card(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.kanban_create_card(uuid, uuid, text, text, text, date, uuid, text[], text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kanban_move_card(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kanban_archive_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kanban_delete_card(uuid) TO authenticated;

COMMENT ON FUNCTION public.kanban_create_card(uuid, uuid, text, text, text, date, uuid, text[], text, text, uuid) IS
  'Cria card de kanban de forma transacional, validando auth e can_view_board.';
COMMENT ON FUNCTION public.kanban_move_card(uuid, uuid, integer, text) IS
  'Move card de kanban com lock por coluna, validando auth e can_view_card.';
COMMENT ON FUNCTION public.kanban_archive_card(uuid) IS
  'Arquiva card de kanban validando auth e can_view_card.';
COMMENT ON FUNCTION public.kanban_delete_card(uuid) IS
  'Remove card de kanban validando auth e can_view_card.';

COMMIT;
