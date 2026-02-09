-- Tabela para rastrear clientes ativos do financeiro (após assinatura do contrato)
CREATE TABLE public.financeiro_active_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  invoice_status TEXT NOT NULL DEFAULT 'em_dia' CHECK (invoice_status IN ('em_dia', 'atrasada')),
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.financeiro_active_clients ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active clients"
  ON public.financeiro_active_clients
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert active clients"
  ON public.financeiro_active_clients
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update active clients"
  ON public.financeiro_active_clients
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete active clients"
  ON public.financeiro_active_clients
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_financeiro_active_clients_updated_at
  BEFORE UPDATE ON public.financeiro_active_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_financeiro_active_clients_client_id ON public.financeiro_active_clients(client_id);
CREATE INDEX idx_financeiro_active_clients_invoice_status ON public.financeiro_active_clients(invoice_status);