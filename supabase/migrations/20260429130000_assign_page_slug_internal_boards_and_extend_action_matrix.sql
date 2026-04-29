-- 20260429130000_assign_page_slug_internal_boards_and_extend_action_matrix.sql
--
-- P1.3: cobre os boards operacionais internos com page_slug + matriz de
-- operacao explicita. Reduz superficie do fallback permissivo legado em
-- can_operate_kanban_card.
--
-- Boards atribuidos:
--   - ads-*                                 -> page_slug = 'gestor-ads'
--   - grupo-2-squad-*-ads                   -> page_slug = 'gestor-ads'
--   - grupo-2-squad-*-design                -> page_slug = 'design'
--   - grupo-2-squad-*-devs                  -> page_slug = 'devs'
--   - grupo-2-squad-*-video                 -> page_slug = 'editor-video'
--   - cadastro-novos-clientes               -> page_slug = 'cadastro-clientes'
--
-- Matrizes adicionadas em can_operate_kanban_card:
--   - gestor-ads        -> gestor_ads, sucesso_cliente
--   - cadastro-clientes -> sucesso_cliente
--
-- Boards ainda sem page_slug apos esta migration (kanbans exclusivos de
-- admin / produto interno):
--   - ceo, forja, b2b-club, b2b-summit, grupo-1-projetos, grupo-2-projetos,
--     millennials-hunting, on-demand, organic, septem,
--     vendedor-pastinha-comunidade, vendedor-pastinha-educacional, zydon
-- Esses caem no fallback permissivo do can_operate_kanban_card. Como a
-- visibilidade ja e restrita via can_view_board (quase sempre admin-only),
-- o impacto e baixo. Migration futura pode aplicar fail-closed apos auditar
-- propriedade caso a caso.

BEGIN;

-- ── 1. Atribui page_slug aos boards internos com analogo direto ─────────────

UPDATE public.kanban_boards
   SET page_slug = 'gestor-ads'
 WHERE page_slug IS NULL
   AND (slug LIKE 'ads-%' OR slug ~ '^grupo-2-squad-[0-9]+-ads$');

UPDATE public.kanban_boards
   SET page_slug = 'design'
 WHERE page_slug IS NULL
   AND slug ~ '^grupo-2-squad-[0-9]+-design$';

UPDATE public.kanban_boards
   SET page_slug = 'devs'
 WHERE page_slug IS NULL
   AND slug ~ '^grupo-2-squad-[0-9]+-devs$';

UPDATE public.kanban_boards
   SET page_slug = 'editor-video'
 WHERE page_slug IS NULL
   AND slug ~ '^grupo-2-squad-[0-9]+-video$';

UPDATE public.kanban_boards
   SET page_slug = 'cadastro-clientes'
 WHERE page_slug IS NULL
   AND slug = 'cadastro-novos-clientes';

-- ── 2. Estende can_operate_kanban_card com novas matrizes ───────────────────

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

  -- Boards operacionais internos.
  IF v_page_slug = 'gestor-ads' THEN
    RETURN v_role = ANY(ARRAY['gestor_ads','sucesso_cliente']);
  END IF;

  IF v_page_slug = 'cadastro-clientes' THEN
    RETURN v_role = ANY(ARRAY['sucesso_cliente']);
  END IF;

  -- Boards sem page_slug: kanbans exclusivos de admin / produtos internos.
  -- Mantem fallback permissivo legado ate audit caso-a-caso. Visibilidade ja
  -- e restrita por can_view_board (quase sempre admin-only).
  IF v_page_slug IS NULL THEN
    RETURN v_action IN ('create', 'move', 'archive', 'delete', 'edit_briefing');
  END IF;

  -- page_slug conhecido mas nao mapeado: fail-closed.
  RETURN false;
END;
$function$;

COMMENT ON FUNCTION public.can_operate_kanban_card(uuid, uuid, text) IS
  'Permissao canonica de operacao em card de kanban. Boards com page_slug tem matriz explicita; boards sem page_slug caem no fallback permissivo legado (kanbans admin-only).';

COMMIT;
