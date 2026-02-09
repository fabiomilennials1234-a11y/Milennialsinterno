-- Criar tabela genérica de notificações de atraso de tarefas
CREATE TABLE public.task_delay_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  task_table TEXT NOT NULL, -- 'ads_tasks', 'department_tasks', 'onboarding_tasks', 'kanban_cards'
  task_owner_id UUID NOT NULL,
  task_owner_name TEXT NOT NULL,
  task_owner_role TEXT NOT NULL,
  task_title TEXT NOT NULL,
  task_due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, task_table)
);

-- Criar tabela genérica de justificativas de atraso
CREATE TABLE public.task_delay_justifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES public.task_delay_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID
);

-- Habilitar RLS
ALTER TABLE public.task_delay_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_delay_justifications ENABLE ROW LEVEL SECURITY;

-- Políticas para task_delay_notifications
-- Todos os usuários autenticados podem ver notificações (filtro é feito no código)
CREATE POLICY "Authenticated users can view task delay notifications"
ON public.task_delay_notifications
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Usuários autenticados podem criar notificações
CREATE POLICY "Authenticated users can create task delay notifications"
ON public.task_delay_notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas para task_delay_justifications
-- Usuários podem ver suas próprias justificativas
CREATE POLICY "Users can view own justifications"
ON public.task_delay_justifications
FOR SELECT
USING (user_id = auth.uid());

-- Roles específicos podem ver justificativas por role
CREATE POLICY "Authorized roles can view justifications by role"
ON public.task_delay_justifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('gestor_ads', 'sucesso_cliente', 'gestor_projetos', 'ceo')
  )
);

-- Usuários podem criar suas próprias justificativas
CREATE POLICY "Users can create own justifications"
ON public.task_delay_justifications
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Usuários podem atualizar suas próprias justificativas
CREATE POLICY "Users can update own justifications"
ON public.task_delay_justifications
FOR UPDATE
USING (user_id = auth.uid());

-- CEO pode atualizar qualquer justificativa (para arquivar)
CREATE POLICY "CEO can update any justification"
ON public.task_delay_justifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'ceo'
  )
);

-- Índices para performance
CREATE INDEX idx_task_delay_notifications_task ON public.task_delay_notifications(task_id, task_table);
CREATE INDEX idx_task_delay_notifications_owner ON public.task_delay_notifications(task_owner_id);
CREATE INDEX idx_task_delay_notifications_role ON public.task_delay_notifications(task_owner_role);
CREATE INDEX idx_task_delay_justifications_notification ON public.task_delay_justifications(notification_id);
CREATE INDEX idx_task_delay_justifications_user ON public.task_delay_justifications(user_id);
CREATE INDEX idx_task_delay_justifications_role ON public.task_delay_justifications(user_role);