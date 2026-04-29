-- 20260429110000_kanban_attachment_rpcs.sql
--
-- P1: centraliza o registro de anexos dos kanbans no backend.
-- O upload do objeto continua no Storage pelo cliente, mas o vinculo em
-- card_attachments agora valida permissao canonica do card/board.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_kanban_card_attachment(
  _card_id uuid,
  _file_name text,
  _file_url text,
  _file_type text DEFAULT NULL,
  _file_size integer DEFAULT NULL
)
RETURNS public.card_attachments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_board_id uuid;
  v_attachment public.card_attachments;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF _card_id IS NULL THEN
    RAISE EXCEPTION 'card_id required' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(BTRIM(_file_name), '') IS NULL THEN
    RAISE EXCEPTION 'file_name required' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(BTRIM(_file_url), '') IS NULL THEN
    RAISE EXCEPTION 'file_url required' USING ERRCODE = '22023';
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

  INSERT INTO public.card_attachments (
    card_id,
    file_name,
    file_url,
    file_type,
    file_size,
    created_by
  )
  VALUES (
    _card_id,
    BTRIM(_file_name),
    BTRIM(_file_url),
    NULLIF(BTRIM(_file_type), ''),
    _file_size,
    v_caller
  )
  RETURNING * INTO v_attachment;

  RETURN v_attachment;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_kanban_card_attachment(_attachment_id uuid)
RETURNS public.card_attachments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_attachment public.card_attachments;
  v_board_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF _attachment_id IS NULL THEN
    RAISE EXCEPTION 'attachment_id required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_attachment
  FROM public.card_attachments
  WHERE id = _attachment_id;

  IF v_attachment.id IS NULL THEN
    RAISE EXCEPTION 'attachment not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT board_id INTO v_board_id
  FROM public.kanban_cards
  WHERE id = v_attachment.card_id;

  IF v_board_id IS NULL THEN
    RAISE EXCEPTION 'card not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_operate_kanban_card(v_caller, v_board_id, 'edit_briefing') THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.card_attachments
  WHERE id = _attachment_id;

  RETURN v_attachment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_kanban_card_attachment(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_kanban_card_attachment(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_kanban_card_attachment(uuid, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_kanban_card_attachment(uuid) TO authenticated;

COMMENT ON FUNCTION public.create_kanban_card_attachment(uuid, text, text, text, integer) IS
  'Registra anexo de card validando can_operate_kanban_card(edit_briefing). O upload no Storage ocorre antes no cliente.';
COMMENT ON FUNCTION public.delete_kanban_card_attachment(uuid) IS
  'Remove registro de anexo validando can_operate_kanban_card(edit_briefing) e retorna o registro removido.';

COMMIT;
