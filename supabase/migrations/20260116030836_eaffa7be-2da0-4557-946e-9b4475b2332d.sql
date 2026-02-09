-- Tabela para armazenar notificações de tarefas atrasadas do Gestor de Ads
CREATE TABLE public.ads_task_delay_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ads_task_id UUID NOT NULL REFERENCES public.ads_tasks(id) ON DELETE CASCADE,
  ads_manager_id UUID NOT NULL,
  ads_manager_name TEXT NOT NULL,
  task_title TEXT NOT NULL,
  task_due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ads_task_id)
);

-- Tabela para armazenar as justificativas de cada cargo para cada notificação
CREATE TABLE public.ads_task_delay_justifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.ads_task_delay_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.ads_task_delay_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_task_delay_justifications ENABLE ROW LEVEL SECURITY;

-- Políticas para notificações - visível para gestor_ads, sucesso_cliente, gestor_projetos e ceo
CREATE POLICY "Notificações de atraso visíveis para cargos específicos" 
ON public.ads_task_delay_notifications 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('gestor_ads', 'sucesso_cliente', 'gestor_projetos', 'ceo')
  )
);

CREATE POLICY "Sistema pode inserir notificações" 
ON public.ads_task_delay_notifications 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Sistema pode deletar notificações" 
ON public.ads_task_delay_notifications 
FOR DELETE 
USING (true);

-- Políticas para justificativas
CREATE POLICY "Usuários veem suas próprias justificativas" 
ON public.ads_task_delay_justifications 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Usuários podem criar suas próprias justificativas" 
ON public.ads_task_delay_justifications 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar suas próprias justificativas" 
ON public.ads_task_delay_justifications 
FOR UPDATE 
USING (user_id = auth.uid());

-- Índices para performance
CREATE INDEX idx_ads_task_delay_notifications_ads_task_id ON public.ads_task_delay_notifications(ads_task_id);
CREATE INDEX idx_ads_task_delay_justifications_notification_id ON public.ads_task_delay_justifications(notification_id);
CREATE INDEX idx_ads_task_delay_justifications_user_id ON public.ads_task_delay_justifications(user_id);