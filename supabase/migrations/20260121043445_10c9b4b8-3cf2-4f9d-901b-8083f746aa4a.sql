-- ============================================
-- PRODUTORA MODULE - Database Structure
-- ============================================

-- 1. Produtora Briefings
CREATE TABLE public.produtora_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL UNIQUE REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  script_url TEXT,
  observations TEXT,
  reference_video_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.produtora_briefings ENABLE ROW LEVEL SECURITY;

-- Policies for produtora_briefings
CREATE POLICY "produtora_briefings_select" ON public.produtora_briefings
  FOR SELECT USING (true);

CREATE POLICY "produtora_briefings_insert" ON public.produtora_briefings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'produtora', 'sucesso_cliente')
    )
  );

CREATE POLICY "produtora_briefings_update" ON public.produtora_briefings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'produtora', 'sucesso_cliente')
    )
  );

CREATE POLICY "produtora_briefings_delete" ON public.produtora_briefings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'produtora')
    )
  );

-- 2. Produtora Delay Notifications (for overdue cards)
CREATE TABLE public.produtora_delay_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL UNIQUE,
  card_title TEXT NOT NULL,
  produtora_id UUID NOT NULL,
  produtora_name TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.produtora_delay_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtora_delay_notifications_select" ON public.produtora_delay_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'produtora', 'sucesso_cliente', 'editor_video')
    )
  );

CREATE POLICY "produtora_delay_notifications_insert" ON public.produtora_delay_notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'produtora', 'sucesso_cliente', 'editor_video')
    )
  );

CREATE POLICY "produtora_delay_notifications_delete" ON public.produtora_delay_notifications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ceo', 'gestor_projetos')
    )
  );

-- 3. Produtora Delay Justifications
CREATE TABLE public.produtora_delay_justifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  produtora_id UUID NOT NULL,
  produtora_name TEXT NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID
);

ALTER TABLE public.produtora_delay_justifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtora_delay_justifications_select" ON public.produtora_delay_justifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'produtora', 'sucesso_cliente', 'editor_video')
    )
  );

CREATE POLICY "produtora_delay_justifications_insert" ON public.produtora_delay_justifications
  FOR INSERT WITH CHECK (produtora_id = auth.uid());

CREATE POLICY "produtora_delay_justifications_update" ON public.produtora_delay_justifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'ceo'
    )
  );

-- 4. Produtora Notification Dismissals
CREATE TABLE public.produtora_notification_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

ALTER TABLE public.produtora_notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtora_notification_dismissals_select" ON public.produtora_notification_dismissals
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "produtora_notification_dismissals_insert" ON public.produtora_notification_dismissals
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 5. Produtora Completion Notifications (for requester)
CREATE TABLE public.produtora_completion_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  card_title TEXT NOT NULL,
  requester_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  completed_by UUID NOT NULL,
  completed_by_name TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.produtora_completion_notifications ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.produtora_completion_notifications;

CREATE POLICY "produtora_completion_notifications_select" ON public.produtora_completion_notifications
  FOR SELECT USING (requester_id = auth.uid());

CREATE POLICY "produtora_completion_notifications_insert" ON public.produtora_completion_notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "produtora_completion_notifications_update" ON public.produtora_completion_notifications
  FOR UPDATE USING (requester_id = auth.uid());

CREATE POLICY "produtora_completion_notifications_delete" ON public.produtora_completion_notifications
  FOR DELETE USING (requester_id = auth.uid());