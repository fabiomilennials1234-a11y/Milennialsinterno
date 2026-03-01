-- Fix: Garantir que cards de novos clientes apareçam no kanban do gestor de ads
-- Causa: Boards individuais (owner_user_id) criados por create-user não tinham colunas.
-- 1) Backfill: adicionar coluna "Novos Clientes" em boards de gestor_ads que não têm
-- 2) Trigger: ao criar board com owner_user_id, criar coluna "Novos Clientes"
-- 3) create_client_cards: buscar board do gestor atribuído (owner_user_id) e criar coluna se ausente

-- 1. Backfill: adicionar "Novos Clientes" em boards com owner_user_id que não têm
INSERT INTO public.kanban_columns (board_id, title, position, color)
SELECT kb.id, 'Novos Clientes', 0, '#22c55e'
FROM public.kanban_boards kb
WHERE kb.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.kanban_columns kc
    WHERE kc.board_id = kb.id AND kc.title = 'Novos Clientes'
  );

-- 2. Trigger para criar coluna "Novos Clientes" em novos boards de gestor
CREATE OR REPLACE FUNCTION public.ensure_ads_board_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_user_id IS NOT NULL AND NEW.slug ILIKE 'ads-%' THEN
    INSERT INTO public.kanban_columns (board_id, title, position, color)
    SELECT NEW.id, 'Novos Clientes', 0, '#22c55e'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_columns
      WHERE board_id = NEW.id AND title = 'Novos Clientes'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ensure_ads_board_columns ON public.kanban_boards;
CREATE TRIGGER trigger_ensure_ads_board_columns
  AFTER INSERT ON public.kanban_boards
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_ads_board_columns();

-- 3. Atualizar create_client_cards: buscar board do gestor atribuído (owner_user_id) primeiro
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
  -- Buscar nome do gestor de ads
  SELECT name INTO v_ads_manager_name 
  FROM profiles 
  WHERE user_id = NEW.assigned_ads_manager 
  LIMIT 1;

  -- 1. Card no Kanban Gestor de Projetos
  SELECT id INTO v_board_gestor_projetos_id 
  FROM kanban_boards 
  WHERE slug ILIKE '%projetos%' 
  LIMIT 1;
  
  IF v_board_gestor_projetos_id IS NOT NULL THEN
    SELECT id INTO v_column_id 
    FROM kanban_columns 
    WHERE board_id = v_board_gestor_projetos_id 
      AND title = 'Novos Clientes'
    LIMIT 1;
    
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

  -- 2. Card no Kanban do Gestor de Ads atribuído
  -- Prioridade: board do gestor (owner_user_id), depois squad+slug, depois slug=ads
  IF NEW.assigned_ads_manager IS NOT NULL THEN
    -- 2a. Board individual do gestor atribuído
    SELECT id INTO v_board_gestor_ads_id
    FROM kanban_boards
    WHERE owner_user_id = NEW.assigned_ads_manager
      AND slug ILIKE 'ads-%'
    LIMIT 1;
  END IF;
  
  IF v_board_gestor_ads_id IS NULL AND NEW.squad_id IS NOT NULL THEN
    -- 2b. Board por squad
    SELECT kb.id INTO v_board_gestor_ads_id
    FROM kanban_boards kb
    WHERE kb.squad_id = NEW.squad_id 
      AND kb.slug ILIKE '%ads%'
    LIMIT 1;
  END IF;
  
  IF v_board_gestor_ads_id IS NULL THEN
    -- 2c. Board global ads
    SELECT id INTO v_board_gestor_ads_id 
    FROM kanban_boards 
    WHERE slug = 'ads' 
    LIMIT 1;
  END IF;
  
  IF v_board_gestor_ads_id IS NOT NULL THEN
    -- Garantir que exista coluna "Novos Clientes" (fallback para boards antigos)
    INSERT INTO kanban_columns (board_id, title, position, color)
    SELECT v_board_gestor_ads_id, 'Novos Clientes', 0, '#22c55e'
    WHERE NOT EXISTS (
      SELECT 1 FROM kanban_columns 
      WHERE board_id = v_board_gestor_ads_id AND title = 'Novos Clientes'
    );
    
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

  -- 3. Card no Kanban Financeiro
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

  -- 4. Card no Kanban Consultor Comercial
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
