-- ============================================================
-- Outbound Manager Tables (clone do ADS Manager)
-- ============================================================

-- 0. Adicionar role 'outbound' ao enum user_role se não existir
DO $$
BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'outbound';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 1. Adicionar campo assigned_outbound_manager na tabela clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS assigned_outbound_manager UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_clients_assigned_outbound_manager
ON public.clients(assigned_outbound_manager);

-- 2. outbound_tasks (clone de ads_tasks)
CREATE TABLE IF NOT EXISTS public.outbound_tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    outbound_manager_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT DEFAULT 'daily',
    status TEXT DEFAULT 'todo',
    priority TEXT,
    due_date DATE,
    tags TEXT[] DEFAULT '{}',
    archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP WITH TIME ZONE,
    justification TEXT,
    justification_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_tasks_manager ON public.outbound_tasks(outbound_manager_id);
CREATE INDEX IF NOT EXISTS idx_outbound_tasks_archived ON public.outbound_tasks(archived);

ALTER TABLE public.outbound_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own outbound tasks" ON public.outbound_tasks;
CREATE POLICY "Users can manage own outbound tasks"
ON public.outbound_tasks FOR ALL
USING (outbound_manager_id = auth.uid())
WITH CHECK (outbound_manager_id = auth.uid());

DROP POLICY IF EXISTS "Admin can view all outbound tasks" ON public.outbound_tasks;
CREATE POLICY "Admin can view all outbound tasks"
ON public.outbound_tasks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
    )
);

-- 3. outbound_meetings (clone de ads_meetings)
CREATE TABLE IF NOT EXISTS public.outbound_meetings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    outbound_manager_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    meeting_date TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_meetings_manager ON public.outbound_meetings(outbound_manager_id);

ALTER TABLE public.outbound_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage outbound meetings" ON public.outbound_meetings;
CREATE POLICY "Admin can manage outbound meetings"
ON public.outbound_meetings FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('ceo', 'gestor_projetos')
    )
);

DROP POLICY IF EXISTS "Outbound managers can view their meetings" ON public.outbound_meetings;
CREATE POLICY "Outbound managers can view their meetings"
ON public.outbound_meetings FOR SELECT
USING (outbound_manager_id = auth.uid());

-- 4. outbound_daily_documentation (clone de ads_daily_documentation)
CREATE TABLE IF NOT EXISTS public.outbound_daily_documentation (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    outbound_manager_id UUID NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    documentation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    metrics TEXT,
    actions_done TEXT,
    client_budget TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_daily_doc_manager ON public.outbound_daily_documentation(outbound_manager_id);

ALTER TABLE public.outbound_daily_documentation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own outbound documentation" ON public.outbound_daily_documentation;
CREATE POLICY "Users can manage own outbound documentation"
ON public.outbound_daily_documentation FOR ALL
USING (outbound_manager_id = auth.uid())
WITH CHECK (outbound_manager_id = auth.uid());

DROP POLICY IF EXISTS "Admin can view all outbound documentation" ON public.outbound_daily_documentation;
CREATE POLICY "Admin can view all outbound documentation"
ON public.outbound_daily_documentation FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
    )
);

-- 5. outbound_new_client_notifications (clone de ads_new_client_notifications)
CREATE TABLE IF NOT EXISTS public.outbound_new_client_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    outbound_manager_id UUID NOT NULL,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_by_name TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_new_client_notif_manager ON public.outbound_new_client_notifications(outbound_manager_id);

ALTER TABLE public.outbound_new_client_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Outbound managers can view notifications" ON public.outbound_new_client_notifications;
CREATE POLICY "Outbound managers can view notifications"
ON public.outbound_new_client_notifications FOR SELECT
USING (
    outbound_manager_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('ceo', 'gestor_projetos')
    )
);

DROP POLICY IF EXISTS "Outbound managers can update own notifications" ON public.outbound_new_client_notifications;
CREATE POLICY "Outbound managers can update own notifications"
ON public.outbound_new_client_notifications FOR UPDATE
USING (outbound_manager_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can insert outbound notifications" ON public.outbound_new_client_notifications;
CREATE POLICY "Authenticated users can insert outbound notifications"
ON public.outbound_new_client_notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.outbound_new_client_notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 6. outbound_task_delay_notifications (clone de ads_task_delay_notifications)
CREATE TABLE IF NOT EXISTS public.outbound_task_delay_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    outbound_task_id UUID NOT NULL REFERENCES public.outbound_tasks(id) ON DELETE CASCADE,
    outbound_manager_id UUID NOT NULL,
    outbound_manager_name TEXT NOT NULL,
    task_title TEXT NOT NULL,
    task_due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(outbound_task_id)
);

CREATE INDEX IF NOT EXISTS idx_outbound_task_delay_notif_task ON public.outbound_task_delay_notifications(outbound_task_id);

ALTER TABLE public.outbound_task_delay_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Outbound delay notifications visible to allowed roles" ON public.outbound_task_delay_notifications;
CREATE POLICY "Outbound delay notifications visible to allowed roles"
ON public.outbound_task_delay_notifications FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('outbound', 'sucesso_cliente', 'gestor_projetos', 'ceo')
    )
);

DROP POLICY IF EXISTS "Authenticated can insert outbound delay notifications" ON public.outbound_task_delay_notifications;
CREATE POLICY "Authenticated can insert outbound delay notifications"
ON public.outbound_task_delay_notifications FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('outbound', 'sucesso_cliente', 'gestor_projetos', 'ceo')
    )
);

DROP POLICY IF EXISTS "Admin can delete outbound delay notifications" ON public.outbound_task_delay_notifications;
CREATE POLICY "Admin can delete outbound delay notifications"
ON public.outbound_task_delay_notifications FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('ceo', 'gestor_projetos')
    )
);

-- 7. outbound_task_delay_justifications (clone de ads_task_delay_justifications)
CREATE TABLE IF NOT EXISTS public.outbound_task_delay_justifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES public.outbound_task_delay_notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_role TEXT NOT NULL,
    justification TEXT NOT NULL,
    archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_outbound_task_delay_just_notif ON public.outbound_task_delay_justifications(notification_id);
CREATE INDEX IF NOT EXISTS idx_outbound_task_delay_just_user ON public.outbound_task_delay_justifications(user_id);

ALTER TABLE public.outbound_task_delay_justifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own outbound justifications" ON public.outbound_task_delay_justifications;
CREATE POLICY "Users can view own outbound justifications"
ON public.outbound_task_delay_justifications FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
    )
);

DROP POLICY IF EXISTS "Users can create own outbound justifications" ON public.outbound_task_delay_justifications;
CREATE POLICY "Users can create own outbound justifications"
ON public.outbound_task_delay_justifications FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own outbound justifications" ON public.outbound_task_delay_justifications;
CREATE POLICY "Users can update own outbound justifications"
ON public.outbound_task_delay_justifications FOR UPDATE
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('ceo', 'gestor_projetos')
    )
);

-- 8. outbound_task_comments (clone de ads_task_comments)
CREATE TABLE IF NOT EXISTS public.outbound_task_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.outbound_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.outbound_task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view outbound task comments" ON public.outbound_task_comments;
CREATE POLICY "Users can view outbound task comments"
ON public.outbound_task_comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.outbound_tasks t
        WHERE t.id = outbound_task_comments.task_id
        AND (
            t.outbound_manager_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_roles.user_id = auth.uid()
                AND user_roles.role::text IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
            )
        )
    )
);

DROP POLICY IF EXISTS "Users can create outbound task comments" ON public.outbound_task_comments;
CREATE POLICY "Users can create outbound task comments"
ON public.outbound_task_comments FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own outbound task comments" ON public.outbound_task_comments;
CREATE POLICY "Users can delete own outbound task comments"
ON public.outbound_task_comments FOR DELETE
USING (user_id = auth.uid());

-- 9. outbound_justifications (clone de ads_justifications)
CREATE TABLE IF NOT EXISTS public.outbound_justifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    outbound_manager_id UUID NOT NULL,
    reason TEXT NOT NULL,
    justification_type TEXT DEFAULT 'delay',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.outbound_justifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own outbound justifications" ON public.outbound_justifications;
CREATE POLICY "Users can manage own outbound justifications"
ON public.outbound_justifications FOR ALL
USING (outbound_manager_id = auth.uid())
WITH CHECK (outbound_manager_id = auth.uid());

DROP POLICY IF EXISTS "Admin can view all outbound justifications" ON public.outbound_justifications;
CREATE POLICY "Admin can view all outbound justifications"
ON public.outbound_justifications FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('ceo', 'gestor_projetos', 'sucesso_cliente')
    )
);
