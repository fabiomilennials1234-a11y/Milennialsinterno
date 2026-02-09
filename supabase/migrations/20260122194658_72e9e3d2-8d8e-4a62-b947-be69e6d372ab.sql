-- Tabela para contas a pagar por mês
CREATE TABLE public.financeiro_contas_pagar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  categoria TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  mes_referencia TEXT NOT NULL, -- formato: 'yyyy-MM'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para contas a receber por mês (histórico mensal de valores de clientes)
CREATE TABLE public.financeiro_contas_receber (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_dia',
  mes_referencia TEXT NOT NULL, -- formato: 'yyyy-MM'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, mes_referencia)
);

-- Enable RLS
ALTER TABLE public.financeiro_contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_contas_receber ENABLE ROW LEVEL SECURITY;

-- Policies for financeiro_contas_pagar
CREATE POLICY "Allow read for authenticated users"
ON public.financeiro_contas_pagar FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow insert for authenticated users"
ON public.financeiro_contas_pagar FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users"
ON public.financeiro_contas_pagar FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow delete for authenticated users"
ON public.financeiro_contas_pagar FOR DELETE
TO authenticated
USING (true);

-- Policies for financeiro_contas_receber
CREATE POLICY "Allow read for authenticated users"
ON public.financeiro_contas_receber FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow insert for authenticated users"
ON public.financeiro_contas_receber FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users"
ON public.financeiro_contas_receber FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow delete for authenticated users"
ON public.financeiro_contas_receber FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_financeiro_contas_pagar_updated_at
BEFORE UPDATE ON public.financeiro_contas_pagar
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financeiro_contas_receber_updated_at
BEFORE UPDATE ON public.financeiro_contas_receber
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();