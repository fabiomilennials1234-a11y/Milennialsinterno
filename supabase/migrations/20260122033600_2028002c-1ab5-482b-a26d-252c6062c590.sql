-- Tabela para registrar faturamento mensal por cliente
CREATE TABLE public.client_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_month DATE NOT NULL, -- Primeiro dia do mês do faturamento
  invoice_value DECIMAL(12,2) NOT NULL,
  invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Um faturamento por cliente por mês
  UNIQUE(client_id, invoice_month)
);

-- Enable RLS
ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

-- Financeiro pode ver todos os faturamentos
CREATE POLICY "Financeiro pode ver faturamentos"
ON public.client_invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
  )
);

-- Financeiro pode criar faturamentos
CREATE POLICY "Financeiro pode criar faturamentos"
ON public.client_invoices FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
  )
);

-- Financeiro pode atualizar faturamentos
CREATE POLICY "Financeiro pode atualizar faturamentos"
ON public.client_invoices FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
  )
);

-- Financeiro pode deletar faturamentos
CREATE POLICY "Financeiro pode deletar faturamentos"
ON public.client_invoices FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_invoices_updated_at
BEFORE UPDATE ON public.client_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_invoices;