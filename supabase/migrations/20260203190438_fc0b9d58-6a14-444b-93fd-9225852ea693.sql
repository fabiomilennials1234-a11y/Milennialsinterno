
-- Tabela para registrar upsells
CREATE TABLE public.upsells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  sold_by UUID NOT NULL, -- CS que vendeu
  sold_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, contracted, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para comissões de upsell
CREATE TABLE public.upsell_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upsell_id UUID REFERENCES public.upsells(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  commission_value NUMERIC NOT NULL,
  commission_percentage NUMERIC NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsell_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for upsells
CREATE POLICY "Admins and CS can view all upsells" ON public.upsells
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid()) OR 
  public.has_role(auth.uid(), 'sucesso_cliente')
);

CREATE POLICY "Admins and CS can insert upsells" ON public.upsells
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid()) OR 
  public.has_role(auth.uid(), 'sucesso_cliente')
);

CREATE POLICY "Admins and CS can update upsells" ON public.upsells
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid()) OR 
  public.has_role(auth.uid(), 'sucesso_cliente')
);

CREATE POLICY "Admins can delete upsells" ON public.upsells
FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for upsell_commissions
CREATE POLICY "Admins and Finance can view commissions" ON public.upsell_commissions
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid()) OR 
  public.has_role(auth.uid(), 'financeiro') OR
  public.has_role(auth.uid(), 'sucesso_cliente') OR
  user_id = auth.uid()
);

CREATE POLICY "System can insert commissions" ON public.upsell_commissions
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins and Finance can update commissions" ON public.upsell_commissions
FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid()) OR 
  public.has_role(auth.uid(), 'financeiro')
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_upsells_updated_at
BEFORE UPDATE ON public.upsells
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function para processar upsell (criar comissão, atualizar cliente, criar cards)
CREATE OR REPLACE FUNCTION public.process_upsell()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_commission_value NUMERIC;
  v_client_name TEXT;
  v_current_products TEXT[];
  v_board_id UUID;
  v_column_id UUID;
  v_max_position INT;
  v_financeiro_board_id UUID;
  v_financeiro_column_id UUID;
BEGIN
  -- Calcula comissão de 7%
  v_commission_value := NEW.monthly_value * 0.07;
  
  -- Cria registro de comissão
  INSERT INTO public.upsell_commissions (
    upsell_id, user_id, user_name, commission_value, commission_percentage
  ) VALUES (
    NEW.id, NEW.sold_by, NEW.sold_by_name, v_commission_value, 7
  );
  
  -- Busca nome do cliente e produtos atuais
  SELECT name, COALESCE(contracted_products, ARRAY[]::TEXT[])
  INTO v_client_name, v_current_products
  FROM public.clients
  WHERE id = NEW.client_id;
  
  -- Adiciona produto aos contracted_products se não existir
  IF NOT (NEW.product_slug = ANY(v_current_products)) THEN
    UPDATE public.clients
    SET 
      contracted_products = array_append(COALESCE(contracted_products, ARRAY[]::TEXT[]), NEW.product_slug),
      updated_at = now()
    WHERE id = NEW.client_id;
  END IF;
  
  -- Adiciona/atualiza valor do produto
  INSERT INTO public.client_product_values (client_id, product_slug, product_name, monthly_value)
  VALUES (NEW.client_id, NEW.product_slug, NEW.product_name, NEW.monthly_value)
  ON CONFLICT (client_id, product_slug) 
  DO UPDATE SET monthly_value = EXCLUDED.monthly_value, updated_at = now();
  
  -- Cria card no Kanban do produto (se não for millennials-growth)
  IF NEW.product_slug != 'millennials-growth' THEN
    SELECT id INTO v_board_id 
    FROM kanban_boards 
    WHERE slug = NEW.product_slug 
    LIMIT 1;

    IF v_board_id IS NOT NULL THEN
      SELECT id INTO v_column_id 
      FROM kanban_columns 
      WHERE board_id = v_board_id 
        AND (title ILIKE '%novo cliente%' OR title ILIKE '%novos clientes%')
      ORDER BY position ASC
      LIMIT 1;

      IF v_column_id IS NULL THEN
        SELECT id INTO v_column_id 
        FROM kanban_columns 
        WHERE board_id = v_board_id 
        ORDER BY position ASC 
        LIMIT 1;
      END IF;

      IF v_column_id IS NOT NULL THEN
        SELECT COALESCE(MAX(position), 0) + 1 INTO v_max_position
        FROM kanban_cards
        WHERE column_id = v_column_id AND archived = false;

        INSERT INTO kanban_cards (
          board_id, column_id, title, description, 
          client_id, card_type, created_by, priority, position
        ) VALUES (
          v_board_id, v_column_id,
          'UP Sell: ' || v_client_name,
          'Produto: ' || NEW.product_name || E'\n' ||
          'Valor Mensal: R$ ' || NEW.monthly_value::TEXT || E'\n' ||
          'Vendido por: ' || NEW.sold_by_name,
          NEW.client_id,
          'upsell',
          NEW.sold_by,
          'high',
          v_max_position
        );
      END IF;
    END IF;
  END IF;
  
  -- Cria card no Financeiro para contrato
  SELECT id INTO v_financeiro_board_id 
  FROM kanban_boards 
  WHERE slug ILIKE '%financeiro%' 
  LIMIT 1;
  
  IF v_financeiro_board_id IS NOT NULL THEN
    SELECT id INTO v_financeiro_column_id 
    FROM kanban_columns 
    WHERE board_id = v_financeiro_board_id 
      AND title = 'Novos Clientes'
    LIMIT 1;
    
    IF v_financeiro_column_id IS NULL THEN
      SELECT id INTO v_financeiro_column_id 
      FROM kanban_columns 
      WHERE board_id = v_financeiro_board_id 
      ORDER BY position ASC 
      LIMIT 1;
    END IF;
    
    IF v_financeiro_column_id IS NOT NULL THEN
      SELECT COALESCE(MAX(position), 0) + 1 INTO v_max_position
      FROM kanban_cards
      WHERE column_id = v_financeiro_column_id AND archived = false;

      INSERT INTO kanban_cards (
        board_id, column_id, title, description, 
        client_id, card_type, created_by, priority, position
      ) VALUES (
        v_financeiro_board_id, v_financeiro_column_id,
        'UP Sell - Contrato: ' || v_client_name,
        'Produto: ' || NEW.product_name || E'\n' ||
        'Valor Mensal: R$ ' || NEW.monthly_value::TEXT || E'\n' ||
        'Criar contrato para novo produto',
        NEW.client_id,
        'upsell_contract',
        NEW.sold_by,
        'high',
        v_max_position
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para processar upsell após inserção
CREATE TRIGGER process_upsell_trigger
AFTER INSERT ON public.upsells
FOR EACH ROW
EXECUTE FUNCTION public.process_upsell();

-- Enable realtime para upsells e commissions
ALTER PUBLICATION supabase_realtime ADD TABLE public.upsells;
ALTER PUBLICATION supabase_realtime ADD TABLE public.upsell_commissions;
