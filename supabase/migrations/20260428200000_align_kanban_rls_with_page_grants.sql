-- 20260428200000_align_kanban_rls_with_page_grants.sql
--
-- P1: alinhar RLS dos kanbans com o modelo canônico user_page_grants.
--
-- Contexto:
-- - Frontend P0/P1 passou a usar PageAccessRoute/usePageAccess para entrada e
--   operações de kanban.
-- - Backend ainda autorizava kanban_boards/kanban_cards por escopo
--   organizacional ou kanban_boards.allowed_roles.
-- - Usuário com grant direto em user_page_grants poderia ver a página no
--   frontend, mas tomar bloqueio no Supabase ao ler/criar/mover cards.
--
-- Mudança:
-- - can_view_board passa a aceitar has_page_access(user, board.page_slug) como
--   whitelist aditiva.
-- - Backfill de page_slug para boards satélite que antes ficaram NULL.

BEGIN;

UPDATE public.kanban_boards
SET page_slug = CASE
  WHEN slug = 'millennials-outbound' THEN 'outbound'
  WHEN slug = 'millennials-paddock' THEN 'consultor-comercial'
  WHEN slug LIKE 'catalog-%' THEN 'consultor-mktplace'
  ELSE page_slug
END
WHERE (
  slug IN ('millennials-outbound', 'millennials-paddock')
  OR slug LIKE 'catalog-%'
);

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
  board_page_slug text;
BEGIN
  -- CEO/CTO bypass.
  SELECT public.is_ceo(_user_id) INTO user_is_ceo;
  IF user_is_ceo THEN
    RETURN true;
  END IF;

  SELECT ur.role::text INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  LIMIT 1;

  -- gestor_projetos bypass.
  IF user_role = 'gestor_projetos' THEN
    RETURN true;
  END IF;

  SELECT group_id, squad_id, category_id
    INTO user_group_id, user_squad_id, user_category_id
  FROM public.profiles
  WHERE user_id = _user_id;

  SELECT
    group_id,
    squad_id,
    category_id,
    COALESCE(allowed_roles, ARRAY[]::text[]),
    page_slug
    INTO board_group_id, board_squad_id, board_category_id, board_allowed_roles, board_page_slug
  FROM public.kanban_boards
  WHERE id = _board_id;

  -- Novo caminho canônico: grant ativo da página ligada ao board.
  IF board_page_slug IS NOT NULL AND public.has_page_access(_user_id, board_page_slug) THEN
    RETURN true;
  END IF;

  -- Board pertence ao squad do user.
  IF user_squad_id IS NOT NULL AND board_squad_id = user_squad_id THEN
    RETURN true;
  END IF;

  -- Board coringa do grupo do user (squad null).
  IF user_group_id IS NOT NULL AND board_group_id = user_group_id AND board_squad_id IS NULL THEN
    RETURN true;
  END IF;

  -- Board da categoria independente do user.
  IF user_category_id IS NOT NULL AND board_category_id = user_category_id THEN
    RETURN true;
  END IF;

  -- allowed_roles legado como whitelist aditiva.
  IF user_role IS NOT NULL
     AND array_length(board_allowed_roles, 1) IS NOT NULL
     AND user_role = ANY(board_allowed_roles) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_view_board(uuid, uuid) IS
  'Autoriza acesso a board. Bypass CEO/CTO/gestor_projetos. Whitelists: user_page_grants via board.page_slug, escopo squad/group/category, allowed_roles legado. Atualizada em 20260428200000 para alinhar RLS de kanban ao modelo page_grants.';

COMMIT;
