-- Create table for CS Contact History
CREATE TABLE IF NOT EXISTS public.cs_contact_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  contact_type TEXT NOT NULL DEFAULT 'call' CHECK (contact_type IN ('call', 'email', 'whatsapp', 'meeting', 'other')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cs_contact_history ENABLE ROW LEVEL SECURITY;

-- Everyone can view contact history
CREATE POLICY "Everyone can view CS contact history"
ON public.cs_contact_history
FOR SELECT
USING (true);

-- Authorized roles can manage contact history
CREATE POLICY "Authorized roles can manage CS contact history"
ON public.cs_contact_history
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
  )
);

-- Create table for CS Insights/Improvements
CREATE TABLE IF NOT EXISTS public.cs_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'in_progress', 'done', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  created_by UUID REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cs_insights ENABLE ROW LEVEL SECURITY;

-- Everyone can view insights
CREATE POLICY "Everyone can view CS insights"
ON public.cs_insights
FOR SELECT
USING (true);

-- Authorized roles can manage insights
CREATE POLICY "Authorized roles can manage CS insights"
ON public.cs_insights
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_cs_insights_updated_at
BEFORE UPDATE ON public.cs_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_cs_contact_history_client ON public.cs_contact_history(client_id);
CREATE INDEX idx_cs_insights_status ON public.cs_insights(status);