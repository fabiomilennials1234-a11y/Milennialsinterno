-- Add client classification fields for CS alerts
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS cs_classification TEXT DEFAULT 'normal' CHECK (cs_classification IN ('normal', 'alerta', 'critico', 'encerrado'));

-- Add field to track last contact date for automatic suggestions
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS last_cs_contact_at TIMESTAMP WITH TIME ZONE;

-- Add field to track CS notes/classification reason
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS cs_classification_reason TEXT;

-- Create table for CS Manual de Ações
CREATE TABLE IF NOT EXISTS public.cs_action_manuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  position INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for cs_action_manuals
ALTER TABLE public.cs_action_manuals ENABLE ROW LEVEL SECURITY;

-- Everyone can view manuals
CREATE POLICY "Everyone can view CS action manuals"
ON public.cs_action_manuals
FOR SELECT
USING (true);

-- Only CEO, Gestor de Projetos, and Sucesso do Cliente can manage manuals
CREATE POLICY "Authorized roles can manage CS action manuals"
ON public.cs_action_manuals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_cs_action_manuals_updated_at
BEFORE UPDATE ON public.cs_action_manuals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();