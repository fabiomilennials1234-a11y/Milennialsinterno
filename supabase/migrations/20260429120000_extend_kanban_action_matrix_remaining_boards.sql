-- 20260429120000_extend_kanban_action_matrix_remaining_boards.sql
--
-- P1.3: cobre os boards restantes com page_slug (`rh`, `financeiro`,
-- `gestor-crm`, `outbound`, `consultor-mktplace`, `consultor-comercial`) na
-- funcao canonica `can_operate_kanban_card`. Antes esses boards caiam no
-- fallback permissivo `can_view_board ⇒ pode operar tudo`. Agora cada um tem
-- matriz de operacao explicita.
--
-- Boards SEM page_slug (operacionais internos: `ads-*`, `b2b-*`, `ceo`,
-- `cadastro-novos-clientes`, `grupo-*`, `forja`, `millennials-hunting`,
-- `on-demand`, `organic`, `septem`, `vendedor-pastinha-*`, `zydon`)
-- continuam com fallback permissivo ate ganharem page_slug + matriz propria.

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

  -- Boards especializados: matriz de acao reproduz o que vivia no frontend.
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

  -- Boards funcionais com page_slug proprio. Cada matriz reflete os roles
  -- "donos" do dominio + sucesso_cliente quando faz sentido operacional.
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

  -- Boards sem page_slug (operacionais internos). Mantem fallback permissivo
  -- ate ganharem page_slug + matriz propria.
  IF v_page_slug IS NULL THEN
    RETURN v_action IN ('create', 'move', 'archive', 'delete', 'edit_briefing');
  END IF;

  -- page_slug conhecido mas nao mapeado: fail-closed para forcar matriz explicita.
  RETURN false;
END;
$function$;

COMMENT ON FUNCTION public.can_operate_kanban_card(uuid, uuid, text) IS
  'Permissao canonica de operacao em card de kanban. Boards com page_slug tem matriz explicita; boards sem page_slug caem no fallback permissivo legado.';

COMMIT;
