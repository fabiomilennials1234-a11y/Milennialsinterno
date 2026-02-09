-- 1. Criar categoria independente para Cadastro de Novos Clientes
INSERT INTO independent_categories (id, name, slug, icon, position)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'Cadastro de Clientes', 'cadastro-clientes', 'UserPlus', 0)
ON CONFLICT (slug) DO NOTHING;

-- 2. Criar o Kanban Board para Cadastro de Novos Clientes
INSERT INTO kanban_boards (id, name, slug, description, category_id)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'Cadastro de Novos Clientes',
  'cadastro-novos-clientes',
  'Formulário centralizado para cadastro de novos clientes',
  '550e8400-e29b-41d4-a716-446655440001'
)
ON CONFLICT (slug) DO NOTHING;

-- 3. Adicionar coluna client_id na tabela kanban_cards para vincular cards aos clientes
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- 4. Criar índice para melhorar performance de busca por client_id
CREATE INDEX IF NOT EXISTS idx_kanban_cards_client_id ON kanban_cards(client_id);

-- 5. Adicionar coluna para identificar o tipo de visualização do card (área)
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS card_type TEXT DEFAULT 'default';

-- 6. Criar função para gerar cards automaticamente ao criar cliente
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
    ORDER BY position ASC 
    LIMIT 1;
    
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

  -- 2. Card no Kanban do Gestor de Ads atribuído (busca por squad ou principal)
  SELECT kb.id INTO v_board_gestor_ads_id
  FROM kanban_boards kb
  WHERE kb.squad_id = NEW.squad_id 
    AND kb.slug ILIKE '%ads%'
  LIMIT 1;
  
  -- Se não encontrou por squad, busca o board principal de ads
  IF v_board_gestor_ads_id IS NULL THEN
    SELECT id INTO v_board_gestor_ads_id 
    FROM kanban_boards 
    WHERE slug = 'ads' 
    LIMIT 1;
  END IF;
  
  IF v_board_gestor_ads_id IS NOT NULL THEN
    -- Busca a coluna "By [nome]" do gestor de ads atribuído
    SELECT id INTO v_column_id 
    FROM kanban_columns 
    WHERE board_id = v_board_gestor_ads_id 
      AND (title ILIKE 'By ' || v_ads_manager_name OR title ILIKE '%' || v_ads_manager_name || '%')
    LIMIT 1;
    
    -- Se não encontrou coluna específica, usa a primeira
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
    ORDER BY position ASC 
    LIMIT 1;
    
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
    ORDER BY position ASC 
    LIMIT 1;
    
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

-- 7. Criar trigger para executar a função após insert em clients
DROP TRIGGER IF EXISTS trigger_create_client_cards ON clients;
CREATE TRIGGER trigger_create_client_cards
  AFTER INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_client_cards();