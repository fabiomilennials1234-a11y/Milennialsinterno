-- Create atrizes_briefings table for Atrizes de Gravação cards
CREATE TABLE public.atrizes_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  client_instagram TEXT,
  script_url TEXT,
  drive_upload_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(card_id)
);

-- Enable Row Level Security
ALTER TABLE public.atrizes_briefings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "atrizes_briefings_select" 
ON public.atrizes_briefings 
FOR SELECT 
USING (true);

CREATE POLICY "atrizes_briefings_insert" 
ON public.atrizes_briefings 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'atrizes_gravacao', 'sucesso_cliente')
));

CREATE POLICY "atrizes_briefings_update" 
ON public.atrizes_briefings 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'atrizes_gravacao', 'sucesso_cliente')
));

CREATE POLICY "atrizes_briefings_delete" 
ON public.atrizes_briefings 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'atrizes_gravacao')
));