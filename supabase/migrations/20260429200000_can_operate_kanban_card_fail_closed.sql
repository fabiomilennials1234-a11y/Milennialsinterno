-- 20260429200000_can_operate_kanban_card_fail_closed.sql
--
-- P1.3 final: encerra fallback permissivo em can_operate_kanban_card.
--
-- Audit dos 13 boards remanescentes sem page_slug (b2b-club, b2b-summit,
-- ceo, forja, grupo-1-projetos, grupo-2-projetos, millennials-hunting,
-- on-demand, organic, septem, vendedor-pastinha-comunidade,
-- vendedor-pastinha-educacional, zydon):
--   - allowed_roles = [] em todos.
--   - sem squad_id; apenas grupo-*-projetos tem group_id.
--   - can_view_board so retorna true para CEO/CTO/gestor_projetos (bypass admin).
--   - Logo, sao efetivamente admin-only via visualizacao.
--
-- Antes: branch `page_slug IS NULL` retornava acao permissiva. Apos
-- can_view_board ja ter bloqueado non-admins, o resultado pratico era
-- admin-only, mas dependia da consistencia de can_view_board.
--
-- Agora: fail-closed total. Apenas admins (via early return) operam.
-- Non-admins que de algum modo cheguem ao gate sao bloqueados.

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

  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  SELECT page_slug INTO v_page_slug
  FROM public.kanban_boards
  WHERE id = _board_id;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Boards especializados de producao.
  IF v_page_slug = 'design' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','design','sucesso_cliente']);
  END IF;

  IF v_page_slug = 'editor-video' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','editor_video','sucesso_cliente']);
  END IF;

  IF v_page_slug = 'devs' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','devs','sucesso_cliente']);
  END IF;

  IF v_page_slug = 'atrizes-gravacao' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','atrizes_gravacao','sucesso_cliente']);
  END IF;

  IF v_page_slug = 'produtora' THEN
    IF v_action IN ('archive', 'delete', 'edit_briefing') THEN
      RETURN v_role = ANY(ARRAY['gestor_ads','produtora','sucesso_cliente']);
    END IF;

    IF v_action IN ('create', 'move') THEN
      RETURN v_role = ANY(ARRAY['gestor_ads','produtora','sucesso_cliente','editor_video']);
    END IF;

    RETURN false;
  END IF;

  -- Boards funcionais.
  IF v_page_slug = 'rh' THEN
    RETURN v_role = ANY(ARRAY['rh','sucesso_cliente']);
  END IF;

  IF v_page_slug = 'financeiro' THEN
    RETURN v_role = ANY(ARRAY['financeiro']);
  END IF;

  IF v_page_slug = 'gestor-crm' THEN
    RETURN v_role = ANY(ARRAY['gestor_crm','sucesso_cliente']);
  END IF;

  IF v_page_slug = 'outbound' THEN
    RETURN v_role = ANY(ARRAY['outbound','sucesso_cliente']);
  END IF;

  IF v_page_slug = 'consultor-mktplace' THEN
    RETURN v_role = ANY(ARRAY['consultor_mktplace']);
  END IF;

  IF v_page_slug = 'consultor-comercial' THEN
    RETURN v_role = ANY(ARRAY['consultor_comercial','sucesso_cliente']);
  END IF;

  -- Boards operacionais.
  IF v_page_slug = 'gestor-ads' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','sucesso_cliente']);
  END IF;

  IF v_page_slug = 'cadastro-clientes' THEN
    RETURN v_role = ANY(ARRAY['sucesso_cliente']);
  END IF;

  -- Fail-closed: qualquer board sem matriz explicita (page_slug NULL ou
  -- desconhecido) bloqueia non-admins. Admins ja passaram acima via is_admin.
  RETURN false;
END;
$function$;

COMMENT ON FUNCTION public.can_operate_kanban_card(uuid, uuid, text) IS
  'Permissao canonica de operacao em card de kanban. Fail-closed: boards sem matriz explicita exigem admin (CEO/CTO/gestor_projetos).';

COMMIT;
