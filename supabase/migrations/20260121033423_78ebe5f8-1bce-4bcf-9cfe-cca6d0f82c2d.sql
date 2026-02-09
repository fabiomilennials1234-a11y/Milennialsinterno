-- Create dev_briefings table (similar to video_briefings)
CREATE TABLE public.dev_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL UNIQUE,
  script_url TEXT,
  observations TEXT,
  materials_url TEXT,
  reference_video_url TEXT,
  identity_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT dev_briefings_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.kanban_cards(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.dev_briefings ENABLE ROW LEVEL SECURITY;

-- Policies for dev_briefings
CREATE POLICY "dev_briefings_select" ON public.dev_briefings
FOR SELECT USING (true);

CREATE POLICY "dev_briefings_insert" ON public.dev_briefings
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'devs', 'sucesso_cliente')
  )
);

CREATE POLICY "dev_briefings_update" ON public.dev_briefings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'devs', 'sucesso_cliente')
  )
);

CREATE POLICY "dev_briefings_delete" ON public.dev_briefings
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'devs')
  )
);

-- Create dev_delay_notifications table
CREATE TABLE public.dev_delay_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  card_title TEXT NOT NULL,
  dev_id UUID NOT NULL,
  dev_name TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dev_delay_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "dev_delay_notifications_select" ON public.dev_delay_notifications
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'devs', 'sucesso_cliente')
  )
);

CREATE POLICY "dev_delay_notifications_insert" ON public.dev_delay_notifications
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'devs', 'sucesso_cliente')
  )
);

CREATE POLICY "dev_delay_notifications_delete" ON public.dev_delay_notifications
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos')
  )
);

-- Create dev_delay_justifications table
CREATE TABLE public.dev_delay_justifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  dev_id UUID NOT NULL,
  dev_name TEXT NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID
);

-- Enable RLS
ALTER TABLE public.dev_delay_justifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "dev_delay_justifications_select" ON public.dev_delay_justifications
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'devs', 'sucesso_cliente')
  )
);

CREATE POLICY "dev_delay_justifications_insert" ON public.dev_delay_justifications
FOR INSERT WITH CHECK (dev_id = auth.uid());

CREATE POLICY "dev_delay_justifications_update" ON public.dev_delay_justifications
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'ceo'
  )
);

-- Create dev_notification_dismissals table
CREATE TABLE public.dev_notification_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dev_notification_dismissals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "dev_notification_dismissals_select" ON public.dev_notification_dismissals
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "dev_notification_dismissals_insert" ON public.dev_notification_dismissals
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create dev_completion_notifications table
CREATE TABLE public.dev_completion_notifications (
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

-- Enable RLS
ALTER TABLE public.dev_completion_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "dev_completion_notifications_select" ON public.dev_completion_notifications
FOR SELECT USING (requester_id = auth.uid());

CREATE POLICY "dev_completion_notifications_insert" ON public.dev_completion_notifications
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'devs', 'sucesso_cliente')
  )
);

CREATE POLICY "dev_completion_notifications_update" ON public.dev_completion_notifications
FOR UPDATE USING (requester_id = auth.uid());

CREATE POLICY "dev_completion_notifications_delete" ON public.dev_completion_notifications
FOR DELETE USING (requester_id = auth.uid());