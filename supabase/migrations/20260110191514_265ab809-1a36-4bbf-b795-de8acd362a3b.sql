-- Create function to get user's group_id
CREATE OR REPLACE FUNCTION public.get_user_group_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Create function to get user's squad_id
CREATE OR REPLACE FUNCTION public.get_user_squad_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT squad_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Create function to check if user can view another user based on group/squad visibility
CREATE OR REPLACE FUNCTION public.can_view_user(_viewer_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_is_ceo boolean;
  viewer_group_id uuid;
  viewer_squad_id uuid;
  target_group_id uuid;
  target_squad_id uuid;
BEGIN
  -- CEO can view everyone
  SELECT public.is_ceo(_viewer_id) INTO viewer_is_ceo;
  IF viewer_is_ceo THEN
    RETURN true;
  END IF;
  
  -- Get viewer's group and squad
  SELECT group_id, squad_id INTO viewer_group_id, viewer_squad_id
  FROM public.profiles WHERE user_id = _viewer_id;
  
  -- Get target's group and squad
  SELECT group_id, squad_id INTO target_group_id, target_squad_id
  FROM public.profiles WHERE user_id = _target_user_id;
  
  -- Users in the same group can see each other
  IF viewer_group_id IS NOT NULL AND viewer_group_id = target_group_id THEN
    RETURN true;
  END IF;
  
  -- Users in the same squad can see each other
  IF viewer_squad_id IS NOT NULL AND viewer_squad_id = target_squad_id THEN
    RETURN true;
  END IF;
  
  -- Users can always see themselves
  IF _viewer_id = _target_user_id THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create function to check if user can view a kanban board
CREATE OR REPLACE FUNCTION public.can_view_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_is_ceo boolean;
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
  
  -- Get user's group, squad and category
  SELECT group_id, squad_id, category_id INTO user_group_id, user_squad_id, user_category_id
  FROM public.profiles WHERE user_id = _user_id;
  
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

-- Drop existing policies on kanban_boards if they exist
DROP POLICY IF EXISTS "Users can view boards" ON public.kanban_boards;
DROP POLICY IF EXISTS "Anyone can view boards" ON public.kanban_boards;

-- Create new RLS policy for kanban_boards based on visibility
CREATE POLICY "Users can view their boards"
ON public.kanban_boards
FOR SELECT
TO authenticated
USING (public.can_view_board(auth.uid(), id));

-- Drop existing policies on kanban_cards if they exist
DROP POLICY IF EXISTS "Users can view cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Anyone can view cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Users can insert cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Users can update cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Users can delete cards" ON public.kanban_cards;

-- Create new RLS policies for kanban_cards
CREATE POLICY "Users can view cards in their boards"
ON public.kanban_cards
FOR SELECT
TO authenticated
USING (public.can_view_board(auth.uid(), board_id));

CREATE POLICY "Users can insert cards in their boards"
ON public.kanban_cards
FOR INSERT
TO authenticated
WITH CHECK (public.can_view_board(auth.uid(), board_id));

CREATE POLICY "Users can update cards in their boards"
ON public.kanban_cards
FOR UPDATE
TO authenticated
USING (public.can_view_board(auth.uid(), board_id));

CREATE POLICY "Users can delete cards in their boards"
ON public.kanban_cards
FOR DELETE
TO authenticated
USING (public.can_view_board(auth.uid(), board_id));

-- Drop existing policies on kanban_columns
DROP POLICY IF EXISTS "Users can view columns" ON public.kanban_columns;
DROP POLICY IF EXISTS "Anyone can view columns" ON public.kanban_columns;

-- Create RLS policy for kanban_columns
CREATE POLICY "Users can view columns in their boards"
ON public.kanban_columns
FOR SELECT
TO authenticated
USING (public.can_view_board(auth.uid(), board_id));

-- Update profiles RLS policies for visibility
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by same group/squad" ON public.profiles;

CREATE POLICY "Users can view profiles in their group/squad"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_view_user(auth.uid(), user_id));