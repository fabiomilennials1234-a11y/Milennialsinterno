-- Tabela para armazenar documentação diária do consultor comercial POR CLIENTE
CREATE TABLE public.comercial_client_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercial_user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  documentation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Pergunta: Você ajudou esse cliente hoje?
  helped_client BOOLEAN NOT NULL DEFAULT false,
  -- O que fez (se helped_client = true) OU porque não ajudou (se helped_client = false)
  help_description TEXT NOT NULL,
  
  -- Pergunta: Foi combinado algo com o cliente?
  has_combinado BOOLEAN NOT NULL DEFAULT false,
  -- O que foi combinado (se has_combinado = true)
  combinado_description TEXT,
  -- Prazo do combinado (se has_combinado = true)
  combinado_deadline DATE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Um registro por cliente por dia por consultor
  UNIQUE(comercial_user_id, client_id, documentation_date)
);

-- Enable RLS
ALTER TABLE public.comercial_client_documentation ENABLE ROW LEVEL SECURITY;

-- Consultor comercial pode ver suas próprias documentações
CREATE POLICY "Consultor pode ver suas documentações"
ON public.comercial_client_documentation FOR SELECT
USING (auth.uid() = comercial_user_id);

-- Consultor comercial pode criar documentações
CREATE POLICY "Consultor pode criar documentações"
ON public.comercial_client_documentation FOR INSERT
WITH CHECK (auth.uid() = comercial_user_id);

-- Consultor comercial pode atualizar suas documentações
CREATE POLICY "Consultor pode atualizar suas documentações"
ON public.comercial_client_documentation FOR UPDATE
USING (auth.uid() = comercial_user_id);

-- CEO pode ver todas as documentações
CREATE POLICY "CEO pode ver todas documentações comercial"
ON public.comercial_client_documentation FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'ceo'
  )
);

-- Gestor de projetos pode ver todas as documentações
CREATE POLICY "Gestor Projetos pode ver todas doc comercial"
ON public.comercial_client_documentation FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'gestor_projetos'
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_comercial_client_documentation_updated_at
BEFORE UPDATE ON public.comercial_client_documentation
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_client_documentation;