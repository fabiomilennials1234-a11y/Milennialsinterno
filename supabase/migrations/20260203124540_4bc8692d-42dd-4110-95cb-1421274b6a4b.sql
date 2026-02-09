-- Criar tabela para armazenar valores mensais por produto contratado
CREATE TABLE public.client_product_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, product_slug)
);

-- Enable RLS
ALTER TABLE public.client_product_values ENABLE ROW LEVEL SECURITY;

-- Policies para gerenciamento
CREATE POLICY "Authenticated users can view product values"
  ON public.client_product_values
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert product values"
  ON public.client_product_values
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update product values"
  ON public.client_product_values
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete product values"
  ON public.client_product_values
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_client_product_values_updated_at
  BEFORE UPDATE ON public.client_product_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index para performance
CREATE INDEX idx_client_product_values_client_id ON public.client_product_values(client_id);
CREATE INDEX idx_client_product_values_product_slug ON public.client_product_values(product_slug);