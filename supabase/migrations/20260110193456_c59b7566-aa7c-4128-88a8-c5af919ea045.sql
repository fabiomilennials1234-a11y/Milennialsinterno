-- Create table for role limits per group
CREATE TABLE public.group_role_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.organization_groups(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  max_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, role)
);

-- Enable RLS
ALTER TABLE public.group_role_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies - CEO can manage, others can view
CREATE POLICY "CEO can manage group role limits"
  ON public.group_role_limits
  FOR ALL
  USING (public.is_ceo(auth.uid()));

CREATE POLICY "Authenticated users can view group role limits"
  ON public.group_role_limits
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_group_role_limits_updated_at
  BEFORE UPDATE ON public.group_role_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Remove department column from profiles (it's redundant with role)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS department;

-- Insert default role limits for existing groups (based on your structure)
-- Group 1 and Group 2 both have the same structure
INSERT INTO public.group_role_limits (group_id, role, max_count)
SELECT g.id, r.role, r.max_count
FROM public.organization_groups g
CROSS JOIN (
  VALUES 
    ('gestor_projetos', 1),
    ('gestor_ads', 2),
    ('sucesso_cliente', 2),
    ('design', 2),
    ('editor_video', 2),
    ('devs', 1),
    ('atrizes_gravacao', 2),
    ('produtora', 1),
    ('gestor_crm', 1),
    ('consultor_comercial', 2)
) AS r(role, max_count)
ON CONFLICT (group_id, role) DO NOTHING;