-- Add archived column to kanban_cards
ALTER TABLE public.kanban_cards 
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Add archived_at column
ALTER TABLE public.kanban_cards 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for archived filter
CREATE INDEX IF NOT EXISTS idx_kanban_cards_archived ON public.kanban_cards(archived) WHERE archived = false;

-- Insert "Novos Clientes" column at position 0 for all existing boards (dynamic: no hardcoded IDs)
DO $$
DECLARE
  v_board_id UUID;
BEGIN
  FOR v_board_id IN SELECT id FROM public.kanban_boards
  LOOP
    UPDATE public.kanban_columns SET position = position + 1 WHERE board_id = v_board_id;
    INSERT INTO public.kanban_columns (board_id, title, position, color)
    SELECT v_board_id, 'Novos Clientes', 0, '#22c55e'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_columns
      WHERE board_id = v_board_id AND title = 'Novos Clientes'
    );
  END LOOP;
END $$;

-- Update create_client_cards function to place cards in "Novos Clientes" column
CREATE OR REPLACE FUNCTION public.create_client_cards()
RETURNS TRIGGER AS $$
DECLARE
  v_board_gestor_projetos_id UUID;
  v_board_gestor_ads_id UUID;
  v_board_financeiro_id UUID;
  v_board_comercial_id UUID;
  v_column_id UUID;
  v_ads_manager_name TEXT;
BEGIN
  -- Get ads manager name
  SELECT name INTO v_ads_manager_name 
  FROM profiles 
  WHERE user_id = NEW.assigned_ads_manager 
  LIMIT 1;

  -- 1. Card in Gestor de Projetos Kanban
  SELECT id INTO v_board_gestor_projetos_id 
  FROM kanban_boards 
  WHERE slug ILIKE '%projetos%' 
  LIMIT 1;
  
  IF v_board_gestor_projetos_id IS NOT NULL THEN
    -- Find "Novos Clientes" column first
    SELECT id INTO v_column_id 
    FROM kanban_columns 
    WHERE board_id = v_board_gestor_projetos_id 
      AND title = 'Novos Clientes'
    LIMIT 1;
    
    -- Fallback to first column if not found
    IF v_column_id IS NULL THEN
      SELECT id INTO v_column_id 
      FROM kanban_columns 
      WHERE board_id = v_board_gestor_projetos_id 
      ORDER BY position ASC 
      LIMIT 1;
    END IF;
    
    IF v_column_id IS NOT NULL THEN
      INSERT INTO kanban_cards (
        board_id, column_id, title, description, 
        client_id, card_type, created_by, priority
      ) VALUES (
        v_board_gestor_projetos_id, 
        v_column_id,
        'Novo Cliente: ' || NEW.name,
        'Grupo: ' || COALESCE((SELECT name FROM organization_groups WHERE id = NEW.group_id), 'N/A') || E'\n' ||
        'Informações: ' || COALESCE(NEW.general_info, 'N/A'),
        NEW.id,
        'gestor_projetos',
        NEW.created_by,
        'medium'
      );
    END IF;
  END IF;

  -- 2. Card in Gestor de Ads Kanban
  SELECT kb.id INTO v_board_gestor_ads_id
  FROM kanban_boards kb
  WHERE kb.squad_id = NEW.squad_id 
    AND kb.slug ILIKE '%ads%'
  LIMIT 1;
  
  IF v_board_gestor_ads_id IS NULL THEN
    SELECT id INTO v_board_gestor_ads_id 
    FROM kanban_boards 
    WHERE slug = 'ads' 
    LIMIT 1;
  END IF;
  
  IF v_board_gestor_ads_id IS NOT NULL THEN
    -- Find "Novos Clientes" column first
    SELECT id INTO v_column_id 
    FROM kanban_columns 
    WHERE board_id = v_board_gestor_ads_id 
      AND title = 'Novos Clientes'
    LIMIT 1;
    
    IF v_column_id IS NULL THEN
      SELECT id INTO v_column_id 
      FROM kanban_columns 
      WHERE board_id = v_board_gestor_ads_id 
      ORDER BY position ASC 
      LIMIT 1;
    END IF;
    
    IF v_column_id IS NOT NULL THEN
      INSERT INTO kanban_cards (
        board_id, column_id, title, description, 
        client_id, card_type, created_by, assigned_to, priority
      ) VALUES (
        v_board_gestor_ads_id, 
        v_column_id,
        'Novo Cliente: ' || NEW.name,
        'Investimento Previsto: R$ ' || COALESCE(NEW.expected_investment::TEXT, 'N/A') || E'\n' ||
        'Gestor de Ads: ' || COALESCE(v_ads_manager_name, 'N/A'),
        NEW.id,
        'gestor_ads',
        NEW.created_by,
        NEW.assigned_ads_manager,
        'high'
      );
    END IF;
  END IF;

  -- 3. Card in Financeiro Kanban
  SELECT id INTO v_board_financeiro_id 
  FROM kanban_boards 
  WHERE slug ILIKE '%financeiro%' 
  LIMIT 1;
  
  IF v_board_financeiro_id IS NOT NULL THEN
    SELECT id INTO v_column_id 
    FROM kanban_columns 
    WHERE board_id = v_board_financeiro_id 
      AND title = 'Novos Clientes'
    LIMIT 1;
    
    IF v_column_id IS NULL THEN
      SELECT id INTO v_column_id 
      FROM kanban_columns 
      WHERE board_id = v_board_financeiro_id 
      ORDER BY position ASC 
      LIMIT 1;
    END IF;
    
    IF v_column_id IS NOT NULL THEN
      INSERT INTO kanban_cards (
        board_id, column_id, title, description, 
        client_id, card_type, created_by, priority
      ) VALUES (
        v_board_financeiro_id, 
        v_column_id,
        'Novo Cliente: ' || NEW.name,
        'Razão Social: ' || COALESCE(NEW.razao_social, 'N/A') || E'\n' ||
        'CNPJ: ' || COALESCE(NEW.cnpj, 'N/A') || E'\n' ||
        'CPF: ' || COALESCE(NEW.cpf, 'N/A') || E'\n' ||
        'Investimento: R$ ' || COALESCE(NEW.expected_investment::TEXT, 'N/A'),
        NEW.id,
        'financeiro',
        NEW.created_by,
        'medium'
      );
    END IF;
  END IF;

  -- 4. Card in Consultor Comercial Kanban
  SELECT id INTO v_board_comercial_id 
  FROM kanban_boards 
  WHERE slug ILIKE '%comercial%' 
  LIMIT 1;
  
  IF v_board_comercial_id IS NOT NULL THEN
    SELECT id INTO v_column_id 
    FROM kanban_columns 
    WHERE board_id = v_board_comercial_id 
      AND title = 'Novos Clientes'
    LIMIT 1;
    
    IF v_column_id IS NULL THEN
      SELECT id INTO v_column_id 
      FROM kanban_columns 
      WHERE board_id = v_board_comercial_id 
      ORDER BY position ASC 
      LIMIT 1;
    END IF;
    
    IF v_column_id IS NOT NULL THEN
      INSERT INTO kanban_cards (
        board_id, column_id, title, description, 
        client_id, card_type, created_by, priority
      ) VALUES (
        v_board_comercial_id, 
        v_column_id,
        'Novo Cliente: ' || NEW.name,
        'Informações: ' || COALESCE(NEW.general_info, 'N/A'),
        NEW.id,
        'consultor_comercial',
        NEW.created_by,
        'medium'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;