-- Align can_view_board with frontend admin semantics.
-- The frontend treats gestor_projetos as admin (sees all boards), but the RLS
-- function can_view_board only granted full bypass to CEO. This caused ghost
-- links in the sidebar: boards appeared for gestor_projetos but returned empty
-- because RLS blocked the actual access. This migration gives gestor_projetos
-- the same full-visibility bypass as CEO.

CREATE OR REPLACE FUNCTION public.can_view_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
BEGIN
  -- CEO can view everything
  SELECT public.is_ceo(_user_id) INTO user_is_ceo;
  IF user_is_ceo THEN
    RETURN true;
  END IF;

  -- Gestor de Projetos shares the CEO-level visibility (admin role in frontend)
  SELECT role, group_id, squad_id, category_id
    INTO user_role, user_group_id, user_squad_id, user_category_id
  FROM public.profiles WHERE user_id = _user_id;

  IF user_role = 'gestor_projetos' THEN
    RETURN true;
  END IF;

  -- Get board's group, squad and category
  SELECT group_id, squad_id, category_id INTO board_group_id, board_squad_id, board_category_id
  FROM public.kanban_boards WHERE id = _board_id;

  -- Check if board belongs to user's squad
  IF user_squad_id IS NOT NULL AND board_squad_id = user_squad_id THEN
    RETURN true;
  END IF;

  -- Check if board belongs to user's group (coringa boards)
  IF user_group_id IS NOT NULL AND board_group_id = user_group_id AND board_squad_id IS NULL THEN
    RETURN true;
  END IF;

  -- Check if board belongs to user's independent category
  IF user_category_id IS NOT NULL AND board_category_id = user_category_id THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
