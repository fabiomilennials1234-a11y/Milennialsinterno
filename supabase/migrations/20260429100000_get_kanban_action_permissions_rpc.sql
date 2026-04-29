-- 20260429100000_get_kanban_action_permissions_rpc.sql
--
-- P1: expõe para a UI a mesma matriz canônica de ação usada pelas RPCs de
-- mutation. Isso reduz divergência entre botão/drag visível no frontend e
-- bloqueio real no backend.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_kanban_action_permissions(_board_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF _board_id IS NULL THEN
    RAISE EXCEPTION 'board_id required' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'canCreate', public.can_operate_kanban_card(v_caller, _board_id, 'create'),
    'canMove', public.can_operate_kanban_card(v_caller, _board_id, 'move'),
    'canArchive', public.can_operate_kanban_card(v_caller, _board_id, 'archive'),
    'canDelete', public.can_operate_kanban_card(v_caller, _board_id, 'delete'),
    'canEditBriefing', public.can_operate_kanban_card(v_caller, _board_id, 'edit_briefing')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_kanban_action_permissions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kanban_action_permissions(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_kanban_action_permissions(uuid) IS
  'Retorna permissoes de acao do kanban para auth.uid(), usando can_operate_kanban_card como fonte canonica.';

COMMIT;
