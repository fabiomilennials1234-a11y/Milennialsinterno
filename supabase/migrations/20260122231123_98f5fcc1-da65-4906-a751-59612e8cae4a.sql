-- Create table for RH tasks
CREATE TABLE public.rh_tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'a_fazer' CHECK (status IN ('a_fazer', 'fazendo', 'feitas')),
  prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  vaga_id UUID REFERENCES public.rh_vagas(id) ON DELETE SET NULL,
  responsavel_id UUID,
  responsavel_nome TEXT,
  data_limite DATE,
  created_by UUID,
  created_by_name TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rh_tarefas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rh_tarefas
CREATE POLICY "Allow authenticated users to view rh_tarefas"
  ON public.rh_tarefas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert rh_tarefas"
  ON public.rh_tarefas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update rh_tarefas"
  ON public.rh_tarefas FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete rh_tarefas"
  ON public.rh_tarefas FOR DELETE
  TO authenticated
  USING (true);

-- Create index for better performance
CREATE INDEX idx_rh_tarefas_status ON public.rh_tarefas(status);
CREATE INDEX idx_rh_tarefas_vaga_id ON public.rh_tarefas(vaga_id);

-- Add trigger for updated_at
CREATE TRIGGER update_rh_tarefas_updated_at
  BEFORE UPDATE ON public.rh_tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rh_tarefas;

COMMENT ON TABLE public.rh_tarefas IS 'Tasks for the RH team with Kanban workflow';