-- Create sales table to track individual sales per client
CREATE TABLE public.client_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sale_value numeric NOT NULL CHECK (sale_value > 0),
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  registered_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create commission records table to track individual commissions
CREATE TABLE public.commission_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.client_sales(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_role text NOT NULL,
  commission_value numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.client_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_sales
CREATE POLICY "Authorized roles can view all sales"
ON public.client_sales FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'financeiro', 'consultor_comercial', 'sucesso_cliente')
  )
);

CREATE POLICY "Authorized roles can insert sales"
ON public.client_sales FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'financeiro', 'consultor_comercial', 'sucesso_cliente')
  )
);

CREATE POLICY "Admin can manage all sales"
ON public.client_sales FOR ALL
USING (is_admin(auth.uid()));

-- RLS Policies for commission_records
CREATE POLICY "Users can view their own commissions"
ON public.commission_records FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admin can view all commissions"
ON public.commission_records FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "System can insert commissions"
ON public.commission_records FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'financeiro', 'consultor_comercial', 'sucesso_cliente')
  )
);

-- Create function to distribute commissions when a sale is registered
CREATE OR REPLACE FUNCTION public.distribute_sale_commissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client record;
  v_commission_total numeric;
  v_commission_share numeric;
  v_ads_manager_id uuid;
  v_sucesso_cliente_id uuid;
  v_consultor_comercial_id uuid;
BEGIN
  -- Get client info including sales percentage and assigned ads manager
  SELECT c.*, c.sales_percentage, c.assigned_ads_manager 
  INTO v_client 
  FROM clients c 
  WHERE c.id = NEW.client_id;

  -- Calculate total commission for this sale
  v_commission_total := NEW.sale_value * (v_client.sales_percentage / 100);
  
  -- Each of the 3 roles gets 1/3 of the commission
  v_commission_share := v_commission_total / 3;

  -- 1. Commission for Gestor de Ads (the one assigned to the client)
  IF v_client.assigned_ads_manager IS NOT NULL THEN
    INSERT INTO commission_records (sale_id, client_id, user_id, user_role, commission_value)
    VALUES (NEW.id, NEW.client_id, v_client.assigned_ads_manager, 'gestor_ads', v_commission_share);
  END IF;

  -- 2. Commission for Sucesso do Cliente (find first user with this role)
  SELECT ur.user_id INTO v_sucesso_cliente_id
  FROM user_roles ur
  WHERE ur.role = 'sucesso_cliente'
  LIMIT 1;
  
  IF v_sucesso_cliente_id IS NOT NULL THEN
    INSERT INTO commission_records (sale_id, client_id, user_id, user_role, commission_value)
    VALUES (NEW.id, NEW.client_id, v_sucesso_cliente_id, 'sucesso_cliente', v_commission_share);
  END IF;

  -- 3. Commission for Consultor Comercial (find first user with this role)
  SELECT ur.user_id INTO v_consultor_comercial_id
  FROM user_roles ur
  WHERE ur.role = 'consultor_comercial'
  LIMIT 1;
  
  IF v_consultor_comercial_id IS NOT NULL THEN
    INSERT INTO commission_records (sale_id, client_id, user_id, user_role, commission_value)
    VALUES (NEW.id, NEW.client_id, v_consultor_comercial_id, 'consultor_comercial', v_commission_share);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-distribute commissions on sale insert
CREATE TRIGGER distribute_commissions_on_sale
  AFTER INSERT ON public.client_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.distribute_sale_commissions();

-- Add realtime for client_sales
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_sales;