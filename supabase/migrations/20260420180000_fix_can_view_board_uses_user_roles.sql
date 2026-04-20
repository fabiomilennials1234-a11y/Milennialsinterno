-- 20260420180000_fix_can_view_board_uses_user_roles.sql
--
-- HOTFIX CRÍTICO — can_view_board() chama `SELECT role FROM profiles`, mas
-- `profiles` não tem coluna `role` (role mora em `user_roles`). A função
-- está quebrada desde 20260415100000_align_can_view_board_gestor_projetos.sql
-- (15/abr/2026). Efeito em prod: toda policy SELECT de kanban_boards/cards/
-- columns que chama `can_view_board(auth.uid(), id)` explode com 42703 para
-- qualquer não-CEO, retornando lista vazia na UI.
--
-- É a causa raiz do sintoma reportado: "admin deu acesso e usuário não vê
-- kanban". Não era só `additional_pages` ignorada — era a função de auth
-- literalmente quebrada há 5 dias.
--
-- Fix: ler role de `user_roles`, não de `profiles`. Mantém contrato idêntico
-- de retorno — apenas corrige a fonte do role.

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
  -- CEO/CTO bypassam tudo (is_ceo inclui cto desde 20260416130000)
  SELECT public.is_ceo(_user_id) INTO user_is_ceo;
  IF user_is_ceo THEN
    RETURN true;
  END IF;

  -- Role do user_roles (não profiles — profiles não tem coluna role)
  SELECT ur.role::text INTO user_role
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
  LIMIT 1;

  -- Gestor de projetos bypassa (admin no frontend)
  IF user_role = 'gestor_projetos' THEN
    RETURN true;
  END IF;

  -- Carrega escopo organizacional do perfil
  SELECT group_id, squad_id, category_id
    INTO user_group_id, user_squad_id, user_category_id
  FROM public.profiles WHERE user_id = _user_id;

  -- Carrega escopo do board
  SELECT group_id, squad_id, category_id
    INTO board_group_id, board_squad_id, board_category_id
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

  RETURN false;
END;
$$;

-- Comentário na função serve de documentação viva
COMMENT ON FUNCTION public.can_view_board(uuid, uuid) IS
  'Decide se user pode ver um board. Bypass: CEO/CTO (is_ceo), gestor_projetos. Caso contrário, match por squad > group (coringa) > category. Corrigida em 20260420180000 (antes lia profiles.role que não existe).';
