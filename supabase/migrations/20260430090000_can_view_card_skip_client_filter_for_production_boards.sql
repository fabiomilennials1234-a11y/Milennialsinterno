-- 20260430090000_can_view_card_skip_client_filter_for_production_boards.sql
--
-- Bug fix: gestor_ads (ou qualquer non-admin com page_grant ao board) cria
-- card em board global de PRODUCAO (editor-video / design / devs /
-- atrizes-gravacao / produtora) e perde a visibilidade depois.
--
-- Causa raiz: can_view_card aplicava regra "card global precisa de client_id
-- com group match" mesmo em boards de producao, onde cards sao tarefas
-- internas sem client_id. INSERT passava (policy so checa can_view_board),
-- SELECT falhava → realtime invalidava query → card sumia.
--
-- Fix: para boards globais cujo page_slug e de PRODUCAO ou FUNCIONAL
-- (rh, financeiro), delega direto a can_view_board. So aplica regra de
-- client_group_id em boards globais que de fato listam clientes.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_card(_user_id uuid, _card_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_client_id  uuid;
  v_card_board_id   uuid;
  v_board_page_slug text;
  v_board_is_global boolean;
  v_client_group_id uuid;
  v_user_group_id   uuid;
BEGIN
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  SELECT client_id, board_id
    INTO v_card_client_id, v_card_board_id
  FROM public.kanban_cards
  WHERE id = _card_id;

  IF v_card_board_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    (group_id IS NULL AND squad_id IS NULL AND category_id IS NULL),
    page_slug
    INTO v_board_is_global, v_board_page_slug
  FROM public.kanban_boards
  WHERE id = v_card_board_id;

  -- Boards scoped (squad/group/category): acesso ao card == acesso ao board.
  IF v_board_is_global IS FALSE THEN
    RETURN public.can_view_board(_user_id, v_card_board_id);
  END IF;

  -- Boards globais cujo page_slug e de producao ou funcional sem cliente:
  -- cards sao tarefas internas, regra de client_group_id nao se aplica.
  IF v_board_page_slug IN (
    'editor-video',
    'design',
    'devs',
    'atrizes-gravacao',
    'produtora',
    'rh',
    'financeiro',
    'gestor-crm',
    'consultor-comercial',
    'consultor-mktplace',
    'outbound'
  ) THEN
    RETURN public.can_view_board(_user_id, v_card_board_id);
  END IF;

  -- Boards globais que listam clientes (gestor-ads, cadastro-clientes, NULL):
  -- mantem regra original de group match.
  IF NOT public.can_view_board(_user_id, v_card_board_id) THEN
    RETURN false;
  END IF;

  IF v_card_client_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT group_id INTO v_client_group_id
  FROM public.clients
  WHERE id = v_card_client_id;

  IF v_client_group_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT group_id INTO v_user_group_id
  FROM public.profiles
  WHERE user_id = _user_id;

  IF v_user_group_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_user_group_id = v_client_group_id;
END;
$$;

COMMENT ON FUNCTION public.can_view_card(uuid, uuid) IS
  'Visibilidade de card. Boards globais de producao/funcional delegam ao can_view_board (cards internos sem client). Boards globais listando clientes mantem regra de client_group match.';

COMMIT;
