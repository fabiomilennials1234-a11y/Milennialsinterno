
-- =====================================================
-- ETAPA 1: BANCO DE DADOS - CONSULTOR COMERCIAL
-- =====================================================

-- 1. Adicionar status comercial na tabela clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS comercial_status text DEFAULT 'novo';

-- Índice para busca por status comercial
CREATE INDEX IF NOT EXISTS idx_clients_comercial_status ON public.clients(comercial_status);

-- 2. Tabela de tarefas do Consultor Comercial (diárias e semanais)
CREATE TABLE IF NOT EXISTS public.comercial_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'daily', -- 'daily' ou 'weekly'
  status text NOT NULL DEFAULT 'todo', -- 'todo', 'doing', 'done'
  priority text DEFAULT 'normal',
  due_date timestamp with time zone,
  related_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  is_auto_generated boolean DEFAULT false,
  auto_task_type text, -- 'marcar_consultoria', 'realizar_consultoria'
  justification text,
  justification_at timestamp with time zone,
  archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para comercial_tasks
CREATE INDEX IF NOT EXISTS idx_comercial_tasks_user_id ON public.comercial_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_comercial_tasks_status ON public.comercial_tasks(status);
CREATE INDEX IF NOT EXISTS idx_comercial_tasks_type ON public.comercial_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_comercial_tasks_client ON public.comercial_tasks(related_client_id);

-- RLS para comercial_tasks
ALTER TABLE public.comercial_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercial_tasks_select" ON public.comercial_tasks
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('ceo', 'gestor_projetos'))
  );

CREATE POLICY "comercial_tasks_insert" ON public.comercial_tasks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "comercial_tasks_update" ON public.comercial_tasks
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "comercial_tasks_delete" ON public.comercial_tasks
  FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'ceo')
  );

-- 3. Tabela de documentação diária do Consultor Comercial
CREATE TABLE IF NOT EXISTS public.comercial_daily_documentation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  documentation_date date NOT NULL DEFAULT CURRENT_DATE,
  content text,
  actions_done text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comercial_doc_user ON public.comercial_daily_documentation(user_id);
CREATE INDEX IF NOT EXISTS idx_comercial_doc_date ON public.comercial_daily_documentation(documentation_date);
CREATE INDEX IF NOT EXISTS idx_comercial_doc_client ON public.comercial_daily_documentation(client_id);

-- RLS
ALTER TABLE public.comercial_daily_documentation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercial_doc_select" ON public.comercial_daily_documentation
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('ceo', 'gestor_projetos'))
  );

CREATE POLICY "comercial_doc_insert" ON public.comercial_daily_documentation
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "comercial_doc_update" ON public.comercial_daily_documentation
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "comercial_doc_delete" ON public.comercial_daily_documentation
  FOR DELETE USING (user_id = auth.uid());

-- 4. Tabela de acompanhamento por gestor/dia
CREATE TABLE IF NOT EXISTS public.comercial_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercial_user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL, -- ID do gestor responsável
  manager_name text NOT NULL,
  current_day text DEFAULT 'segunda', -- segunda, terca, quarta, quinta, sexta
  last_moved_at timestamp with time zone DEFAULT now(),
  is_delayed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comercial_tracking_user ON public.comercial_tracking(comercial_user_id);
CREATE INDEX IF NOT EXISTS idx_comercial_tracking_client ON public.comercial_tracking(client_id);
CREATE INDEX IF NOT EXISTS idx_comercial_tracking_manager ON public.comercial_tracking(manager_id);
CREATE INDEX IF NOT EXISTS idx_comercial_tracking_day ON public.comercial_tracking(current_day);

-- RLS
ALTER TABLE public.comercial_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercial_tracking_select" ON public.comercial_tracking
  FOR SELECT USING (
    comercial_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('ceo', 'gestor_projetos'))
  );

CREATE POLICY "comercial_tracking_insert" ON public.comercial_tracking
  FOR INSERT WITH CHECK (comercial_user_id = auth.uid());

CREATE POLICY "comercial_tracking_update" ON public.comercial_tracking
  FOR UPDATE USING (comercial_user_id = auth.uid());

CREATE POLICY "comercial_tracking_delete" ON public.comercial_tracking
  FOR DELETE USING (comercial_user_id = auth.uid());

-- 5. Tabela de notificações de atraso do Consultor Comercial
CREATE TABLE IF NOT EXISTS public.comercial_delay_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  notification_type text NOT NULL, -- 'novo_cliente_24h', 'onboarding_5d', 'acompanhamento'
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name text,
  task_id uuid REFERENCES public.comercial_tasks(id) ON DELETE CASCADE,
  task_title text,
  due_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comercial_delay_notif_user ON public.comercial_delay_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_comercial_delay_notif_type ON public.comercial_delay_notifications(notification_type);

-- RLS
ALTER TABLE public.comercial_delay_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercial_delay_notif_select" ON public.comercial_delay_notifications
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('ceo', 'gestor_projetos', 'sucesso_cliente'))
  );

CREATE POLICY "comercial_delay_notif_insert" ON public.comercial_delay_notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('ceo', 'gestor_projetos', 'consultor_comercial', 'sucesso_cliente'))
  );

CREATE POLICY "comercial_delay_notif_delete" ON public.comercial_delay_notifications
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('ceo', 'gestor_projetos'))
  );

-- 6. Tabela de justificativas de atraso do Consultor Comercial
CREATE TABLE IF NOT EXISTS public.comercial_delay_justifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.comercial_delay_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  justification text NOT NULL,
  notification_type text NOT NULL,
  client_name text,
  archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  archived_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comercial_just_user ON public.comercial_delay_justifications(user_id);
CREATE INDEX IF NOT EXISTS idx_comercial_just_archived ON public.comercial_delay_justifications(archived);

-- RLS
ALTER TABLE public.comercial_delay_justifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercial_just_select" ON public.comercial_delay_justifications
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('ceo', 'gestor_projetos', 'sucesso_cliente'))
  );

CREATE POLICY "comercial_just_insert" ON public.comercial_delay_justifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "comercial_just_update" ON public.comercial_delay_justifications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'ceo')
  );

-- 7. Adicionar coluna assigned_comercial na tabela clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS assigned_comercial uuid;

-- Índice para busca por consultor comercial
CREATE INDEX IF NOT EXISTS idx_clients_assigned_comercial ON public.clients(assigned_comercial);

-- 8. Adicionar coluna comercial_entered_at para controle de 24h
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS comercial_entered_at timestamp with time zone;

-- 9. Adicionar coluna comercial_onboarding_started_at para controle de 5 dias
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS comercial_onboarding_started_at timestamp with time zone;

-- 10. Trigger para atualizar updated_at em comercial_tasks
CREATE OR REPLACE FUNCTION public.update_comercial_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_comercial_tasks_updated_at ON public.comercial_tasks;
CREATE TRIGGER update_comercial_tasks_updated_at
  BEFORE UPDATE ON public.comercial_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_comercial_tasks_updated_at();

-- 11. Trigger para atualizar updated_at em comercial_tracking
CREATE OR REPLACE FUNCTION public.update_comercial_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_comercial_tracking_updated_at ON public.comercial_tracking;
CREATE TRIGGER update_comercial_tracking_updated_at
  BEFORE UPDATE ON public.comercial_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_comercial_tracking_updated_at();

-- 12. Habilitar realtime para as novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_delay_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comercial_tracking;
