-- 20260423131000_add_can_view_card_scoped_by_client_group.sql
--
-- OPCAO B (aprovada pelo fundador, 2026-04-23): manter board `comercial` GLOBAL
-- e escopar a visibilidade dos cards pelo `group_id` do cliente associado, via
-- RLS em `kanban_cards`. Essa migration implementa:
--
--   1. Atualiza `can_view_board()` para reconhecer `kanban_boards.allowed_roles`
--      como bypass. Boards globais (sem group/squad/category) listam roles
--      permitidas em `allowed_roles` — se o user tem uma dessas roles, ele ve
--      o board. (Isso era ate agora simulado pela policy permissiva
--      `USING (true)`, dropada em 20260423130000 — sem essa extensao, roles
--      nao-executivas perderiam acesso a boards globais.)
--
--   2. Cria `can_view_card(_user_id, _card_id)` com a logica de escopo por
--      client.group_id. Regras:
--        - is_admin(user) → true (ja cobre ceo, cto, gestor_projetos)
--        - card.client_id IS NULL → false (orfaos invisiveis; decisao explicita
--          — nao expor cards sem vinculo a cliente para scoping dificil)
--        - client FK dangling (client deletado) → false (mesmo racional)
--        - profile.group_id match com client.group_id → true
--        - senao → false
--
--   3. Redefine a policy SELECT em `kanban_cards` ("Users can view cards in
--      their boards") para combinar can_view_board(board_id) AND
--      can_view_card(id). Isso garante que, mesmo que o user tenha acesso ao
--      board (porque tem role em allowed_roles), ele so ve os cards de
--      clientes do seu grupo.
--
-- SEGURANCA:
--   - Funcoes SECURITY DEFINER STABLE, search_path pinado.
--   - Nao adiciona policies novas; substitui a SELECT existente.
--   - Nao toca INSERT/UPDATE/DELETE (mantem `can_view_board` — escopo de
--     escrita continua "tem acesso ao board"). Se essa brecha virar problema
--     futuro, outra migration restringe.
--
-- IMPACTO LIVE ESPERADO:
--   - Admin/CEO/CTO/gestor_projetos: ve TODOS os 114 cards do comercial (bypass).
--   - Consultor comercial grupo-2 (ex.: Maycon): ve 27 cards (do grupo 2).
--   - Consultor comercial grupo-1: ve 70 cards.
--   - 17 cards orfaos (sem client ou com client deletado): invisiveis para
--     todos exceto admin (bypass).
--
-- ROLLBACK (emergencial):
--   DROP POLICY "Users can view cards in their boards" ON public.kanban_cards;
--   CREATE POLICY "Users can view cards in their boards" ON public.kanban_cards
--     FOR SELECT TO authenticated
--     USING (can_view_board(auth.uid(), board_id));
--   DROP FUNCTION public.can_view_card(uuid, uuid);
--   (can_view_board fica atualizada; seu comportamento pre-fix era mais
--   restritivo — voltar so se necessario via definicao antiga em pg_proc
--   backup.)

BEGIN;

-- =============================================================================
-- PARTE A — Atualiza can_view_board para reconhecer allowed_roles
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_view_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_is_ceo boolean;
  user_role text;
  user_group_id uuid;
  user_squad_id uuid;
  user_category_id uuid;
  board_group_id uuid;
  board_squad_id uuid;
  board_category_id uuid;
  board_allowed_roles text[];
BEGIN
  -- CEO/CTO bypass
  SELECT public.is_ceo(_user_id) INTO user_is_ceo;
  IF user_is_ceo THEN
    RETURN true;
  END IF;

  -- Role principal do user (pega a primeira; user_roles tem UNIQUE(user_id) de fato
  -- hoje, mas usamos LIMIT 1 defensivo).
  SELECT ur.role::text INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  LIMIT 1;

  -- gestor_projetos bypass (admin no frontend)
  IF user_role = 'gestor_projetos' THEN
    RETURN true;
  END IF;

  -- Escopo organizacional do user
  SELECT group_id, squad_id, category_id
    INTO user_group_id, user_squad_id, user_category_id
  FROM public.profiles WHERE user_id = _user_id;

  -- Escopo + allowed_roles do board
  SELECT group_id, squad_id, category_id, COALESCE(allowed_roles, ARRAY[]::text[])
    INTO board_group_id, board_squad_id, board_category_id, board_allowed_roles
  FROM public.kanban_boards WHERE id = _board_id;

  -- Board pertence ao squad do user
  IF user_squad_id IS NOT NULL AND board_squad_id = user_squad_id THEN
    RETURN true;
  END IF;

  -- Board coringa do grupo do user (squad null)
  IF user_group_id IS NOT NULL AND board_group_id = user_group_id AND board_squad_id IS NULL THEN
    RETURN true;
  END IF;

  -- Board da categoria independente do user
  IF user_category_id IS NOT NULL AND board_category_id = user_category_id THEN
    RETURN true;
  END IF;

  -- NOVO: Board global (sem group/squad/category) com role permitida em allowed_roles
  IF board_group_id IS NULL AND board_squad_id IS NULL AND board_category_id IS NULL
     AND user_role IS NOT NULL
     AND user_role = ANY(board_allowed_roles) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_view_board(uuid, uuid) IS
  'Autoriza acesso de leitura a um board. CEO/CTO/gestor_projetos bypass. Escopo por squad/group/category. Boards globais (sem escopo) autorizam via kanban_boards.allowed_roles. Atualizada em 20260423131000 para reconhecer allowed_roles.';

-- =============================================================================
-- PARTE B — can_view_card: escopo por client.group_id
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_view_card(_user_id uuid, _card_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_client_id uuid;
  v_card_board_id uuid;
  v_client_group_id uuid;
  v_user_group_id uuid;
  v_board_is_global boolean;
BEGIN
  -- Bypass admin (inclui ceo, cto, gestor_projetos via is_admin)
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  -- Le card
  SELECT client_id, board_id INTO v_card_client_id, v_card_board_id
  FROM public.kanban_cards WHERE id = _card_id;

  IF v_card_board_id IS NULL THEN
    -- Card nao encontrado; falha closed
    RETURN false;
  END IF;

  -- Determina se board e global (sem scope organizacional)
  SELECT (group_id IS NULL AND squad_id IS NULL AND category_id IS NULL)
    INTO v_board_is_global
  FROM public.kanban_boards WHERE id = v_card_board_id;

  -- Para boards NAO-globais (scoped por squad/group/category), o acesso ao
  -- CARD segue o acesso ao BOARD — can_view_board ja garante o escopo.
  -- Nao aplicamos filtro adicional por client.group_id nesses boards porque
  -- o escopo ja esta embutido no board.
  IF v_board_is_global IS FALSE THEN
    RETURN public.can_view_board(_user_id, v_card_board_id);
  END IF;

  -- Board GLOBAL: precisa ter acesso ao board (via allowed_roles) AND o card
  -- precisa ter client_id com group_id igual ao group_id do user.
  IF NOT public.can_view_board(_user_id, v_card_board_id) THEN
    RETURN false;
  END IF;

  -- Cards orfaos (sem client_id) sao invisiveis em board global
  IF v_card_client_id IS NULL THEN
    RETURN false;
  END IF;

  -- Client deletado (FK SET NULL nao configurado? — se client_id aponta pra
  -- client inexistente, select retorna NULL em v_client_group_id e a checagem
  -- abaixo fica false)
  SELECT group_id INTO v_client_group_id
  FROM public.clients WHERE id = v_card_client_id;

  IF v_client_group_id IS NULL THEN
    RETURN false;
  END IF;

  -- User group
  SELECT group_id INTO v_user_group_id
  FROM public.profiles WHERE user_id = _user_id;

  IF v_user_group_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN v_user_group_id = v_client_group_id;
END;
$$;

COMMENT ON FUNCTION public.can_view_card(uuid, uuid) IS
  'Autoriza leitura de card. Boards scoped: delega a can_view_board. Boards globais: exige can_view_board AND client.group_id = profile.group_id. Cards orfaos (client_id NULL ou client deletado) sao invisiveis para nao-admin. Criada em 20260423131000.';

-- =============================================================================
-- PARTE C — Redefine policy SELECT em kanban_cards usando can_view_card
-- =============================================================================

DROP POLICY IF EXISTS "Users can view cards in their boards" ON public.kanban_cards;

CREATE POLICY "Users can view cards in their boards"
  ON public.kanban_cards
  FOR SELECT
  TO authenticated
  USING (public.can_view_card(auth.uid(), id));

COMMIT;
