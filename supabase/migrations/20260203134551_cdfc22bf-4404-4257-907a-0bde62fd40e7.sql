
-- Create action plans table for CS
CREATE TABLE public.cs_action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  problem_type TEXT NOT NULL CHECK (problem_type IN ('performance', 'expectativas', 'estrategia', 'valor_percebido')),
  severity TEXT NOT NULL CHECK (severity IN ('leve', 'moderado', 'critico')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  indicators TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create action plan tasks (predefined actions)
CREATE TABLE public.cs_action_plan_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_plan_id UUID NOT NULL REFERENCES public.cs_action_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('action', 'quick_win', 'deliverable')),
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  due_date TIMESTAMP WITH TIME ZONE,
  position INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cs_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_action_plan_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cs_action_plans
CREATE POLICY "Authenticated users can view action plans" 
ON public.cs_action_plans 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CS and CEO can create action plans" 
ON public.cs_action_plans 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'sucesso_cliente', 'gestor_projetos')
  )
);

CREATE POLICY "CS and CEO can update action plans" 
ON public.cs_action_plans 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'sucesso_cliente', 'gestor_projetos')
  )
);

CREATE POLICY "CS and CEO can delete action plans" 
ON public.cs_action_plans 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'sucesso_cliente', 'gestor_projetos')
  )
);

-- RLS Policies for cs_action_plan_tasks
CREATE POLICY "Authenticated users can view action plan tasks" 
ON public.cs_action_plan_tasks 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "CS and CEO can manage action plan tasks" 
ON public.cs_action_plan_tasks 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'sucesso_cliente', 'gestor_projetos')
  )
);

-- Indexes
CREATE INDEX idx_cs_action_plans_client_id ON public.cs_action_plans(client_id);
CREATE INDEX idx_cs_action_plans_status ON public.cs_action_plans(status);
CREATE INDEX idx_cs_action_plan_tasks_plan_id ON public.cs_action_plan_tasks(action_plan_id);

-- Update trigger
CREATE TRIGGER update_cs_action_plans_updated_at
BEFORE UPDATE ON public.cs_action_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
