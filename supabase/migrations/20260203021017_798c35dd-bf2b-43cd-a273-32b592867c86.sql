
-- 1. Adicionar coluna de produtos contratados e valor mensal na tabela clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS contracted_products TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS monthly_value NUMERIC DEFAULT 0;

-- 2. Criar trigger para criar cards nos kanbans dos produtos selecionados
CREATE OR REPLACE FUNCTION public.create_product_kanban_cards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product TEXT;
  v_board_id UUID;
  v_column_id UUID;
  v_max_position INT;
BEGIN
  -- Só processa se há produtos contratados
  IF NEW.contracted_products IS NULL OR array_length(NEW.contracted_products, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Para cada produto contratado (exceto millennials-growth que é tratado pelo trigger existente)
  FOREACH v_product IN ARRAY NEW.contracted_products
  LOOP
    -- Pula millennials-growth pois já tem tratamento específico
    IF v_product = 'millennials-growth' THEN
      CONTINUE;
    END IF;

    -- Encontra o board pelo slug do produto
    SELECT id INTO v_board_id 
    FROM kanban_boards 
    WHERE slug = v_product 
    LIMIT 1;

    IF v_board_id IS NOT NULL THEN
      -- Encontra a coluna "NOVO CLIENTE"
      SELECT id INTO v_column_id 
      FROM kanban_columns 
      WHERE board_id = v_board_id 
        AND (title ILIKE '%novo cliente%' OR title ILIKE '%novos clientes%')
      ORDER BY position ASC
      LIMIT 1;

      -- Se não encontrar, pega a primeira coluna
      IF v_column_id IS NULL THEN
        SELECT id INTO v_column_id 
        FROM kanban_columns 
        WHERE board_id = v_board_id 
        ORDER BY position ASC 
        LIMIT 1;
      END IF;

      IF v_column_id IS NOT NULL THEN
        -- Pega a próxima posição
        SELECT COALESCE(MAX(position), 0) + 1 INTO v_max_position
        FROM kanban_cards
        WHERE column_id = v_column_id AND archived = false;

        -- Cria o card
        INSERT INTO kanban_cards (
          board_id, 
          column_id, 
          title, 
          description, 
          client_id, 
          card_type, 
          created_by, 
          priority,
          position
        ) VALUES (
          v_board_id, 
          v_column_id,
          'Novo Cliente: ' || NEW.name,
          'Valor Mensal: R$ ' || COALESCE(NEW.monthly_value::TEXT, '0') || E'\n' ||
          'Nicho: ' || COALESCE(NEW.niche, 'N/A'),
          NEW.id,
          'product_kanban',
          NEW.created_by,
          'medium',
          v_max_position
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Criar trigger para novos clientes
DROP TRIGGER IF EXISTS create_product_kanban_cards_trigger ON public.clients;
CREATE TRIGGER create_product_kanban_cards_trigger
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.create_product_kanban_cards();
