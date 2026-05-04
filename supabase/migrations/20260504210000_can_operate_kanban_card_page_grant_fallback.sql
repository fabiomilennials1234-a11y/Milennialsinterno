-- 20260504210000_can_operate_kanban_card_page_grant_fallback.sql
--
-- Bug: user com page_grant ativo (ex: consultor_comercial com grant para
-- 'editor-video') consegue VER o board via can_view_board/has_page_access,
-- mas can_operate_kanban_card retorna false porque a role matrix hardcoded
-- nao inclui o role do user. Resultado: botao "+" nao aparece, drag
-- bloqueado, acoes indisponiveis apesar de admin ter concedido acesso.
--
-- Fix: role matrix agora armazena resultado em v_matrix_result em vez de
-- retornar direto. Se matrix = true, retorna true. Se false, cai no
-- fallback de has_page_access antes de negar.
--
-- Impacto: todo user com page_grant a um board ganha todas as acoes
-- (create/move/archive/delete/edit_briefing) naquele board, a menos que
-- um user_action_override explicito com granted=false exista.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_operate_kanban_card(_user_id uuid, _board_id uuid, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
  v_page_slug text;
  v_action text := lower(coalesce(_action, ''));
  v_override_granted boolean;
  v_matrix_result boolean;
BEGIN
  IF _user_id IS NULL OR _board_id IS NULL OR v_action = '' THEN
    RETURN false;
  END IF;

  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF NOT public.can_view_board(_user_id, _board_id) THEN
    RETURN false;
  END IF;

  SELECT page_slug INTO v_page_slug
  FROM public.kanban_boards
  WHERE id = _board_id;

  IF v_page_slug IS NOT NULL THEN
    SELECT granted INTO v_override_granted
    FROM public.user_action_overrides
    WHERE user_id = _user_id
      AND page_slug = v_page_slug
      AND action = v_action;

    IF FOUND THEN
      RETURN v_override_granted;
    END IF;
  END IF;

  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  v_matrix_result := NULL;

  IF v_page_slug = 'design' THEN
    v_matrix_result := v_role = ANY(ARRAY['gestor_ads','design','sucesso_cliente']);
  ELSIF v_page_slug = 'editor-video' THEN
    v_matrix_result := v_role = ANY(ARRAY['gestor_ads','editor_video','sucesso_cliente']);
  ELSIF v_page_slug = 'devs' THEN
    v_matrix_result := v_role = ANY(ARRAY['gestor_ads','devs','sucesso_cliente']);
  ELSIF v_page_slug = 'produtora' THEN
    IF v_action IN ('archive', 'delete', 'edit_briefing') THEN
      v_matrix_result := v_role = ANY(ARRAY['gestor_ads','produtora','sucesso_cliente']);
    ELSIF v_action IN ('create', 'move') THEN
      v_matrix_result := v_role = ANY(ARRAY['gestor_ads','produtora','sucesso_cliente','editor_video']);
    ELSE
      v_matrix_result := false;
    END IF;
  ELSIF v_page_slug = 'rh' THEN
    v_matrix_result := v_role = ANY(ARRAY['rh','sucesso_cliente']);
  ELSIF v_page_slug = 'financeiro' THEN
    v_matrix_result := v_role = ANY(ARRAY['financeiro']);
  ELSIF v_page_slug = 'gestor-crm' THEN
    v_matrix_result := v_role = ANY(ARRAY['gestor_crm','sucesso_cliente']);
  ELSIF v_page_slug = 'outbound' THEN
    v_matrix_result := v_role = ANY(ARRAY['outbound','sucesso_cliente']);
  ELSIF v_page_slug = 'consultor-mktplace' THEN
    v_matrix_result := v_role = ANY(ARRAY['consultor_mktplace']);
  ELSIF v_page_slug = 'consultor-comercial' THEN
    v_matrix_result := v_role = ANY(ARRAY['consultor_comercial','sucesso_cliente']);
  ELSIF v_page_slug = 'gestor-ads' THEN
    v_matrix_result := v_role = ANY(ARRAY['gestor_ads','sucesso_cliente']);
  ELSIF v_page_slug = 'cadastro-clientes' THEN
    v_matrix_result := v_role = ANY(ARRAY['sucesso_cliente']);
  END IF;

  IF v_matrix_result = true THEN
    RETURN true;
  END IF;

  -- Fallback: page_grant allows operation even when role matrix says no
  IF v_page_slug IS NOT NULL AND public.has_page_access(_user_id, v_page_slug) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

COMMENT ON FUNCTION public.can_operate_kanban_card(uuid, uuid, text) IS
  'Permissao canonica de operacao em kanban. Override fino > role matrix > page_grant fallback > fail-closed.';

COMMIT;
