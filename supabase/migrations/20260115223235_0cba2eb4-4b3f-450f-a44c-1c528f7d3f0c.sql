-- Create table for churn notifications
CREATE TABLE public.churn_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notification_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track which users have seen/dismissed churn notifications
CREATE TABLE public.churn_notification_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.churn_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  math_answer TEXT NOT NULL,
  UNIQUE(notification_id, user_id)
);

-- Create table for department tasks (for all departments)
CREATE TABLE public.department_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'daily' CHECK (task_type IN ('daily', 'weekly')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  priority TEXT DEFAULT 'normal',
  due_date TIMESTAMP WITH TIME ZONE,
  department TEXT NOT NULL,
  related_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.churn_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churn_notification_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for churn_notifications (viewable by specific roles)
CREATE POLICY "Users with specific roles can view churn notifications" 
ON public.churn_notifications 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('ceo', 'gestor_ads', 'gestor_projetos', 'sucesso_cliente', 'financeiro', 'consultor_comercial')
  )
);

CREATE POLICY "Gestor projetos and CEO can insert churn notifications" 
ON public.churn_notifications 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'sucesso_cliente')
  )
);

-- RLS policies for churn_notification_dismissals
CREATE POLICY "Users can view their own dismissals" 
ON public.churn_notification_dismissals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dismissals" 
ON public.churn_notification_dismissals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS policies for department_tasks
CREATE POLICY "Users can view their own department tasks" 
ON public.department_tasks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own department tasks" 
ON public.department_tasks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own department tasks" 
ON public.department_tasks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own department tasks" 
ON public.department_tasks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_department_tasks_updated_at
BEFORE UPDATE ON public.department_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_churn_notifications_date ON public.churn_notifications(notification_date DESC);
CREATE INDEX idx_churn_dismissals_user ON public.churn_notification_dismissals(user_id);
CREATE INDEX idx_department_tasks_user_dept ON public.department_tasks(user_id, department);
CREATE INDEX idx_department_tasks_status ON public.department_tasks(status) WHERE archived = false;