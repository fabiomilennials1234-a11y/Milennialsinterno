-- Create video delay notifications table (similar to design_delay_notifications)
CREATE TABLE IF NOT EXISTS public.video_delay_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  card_title TEXT NOT NULL,
  editor_id UUID NOT NULL,
  editor_name TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_delay_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authorized roles can view video delay notifications"
ON public.video_delay_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'editor_video', 'sucesso_cliente')
  )
);

CREATE POLICY "System can insert video delay notifications"
ON public.video_delay_notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'editor_video', 'sucesso_cliente')
  )
);

CREATE POLICY "Admins can delete video delay notifications"
ON public.video_delay_notifications
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos')
  )
);

-- Create video delay justifications table (similar to design_delay_justifications)
CREATE TABLE IF NOT EXISTS public.video_delay_justifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  editor_id UUID NOT NULL,
  editor_name TEXT NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID
);

-- Enable RLS
ALTER TABLE public.video_delay_justifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authorized roles can view video justifications"
ON public.video_delay_justifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'editor_video', 'sucesso_cliente')
  )
);

CREATE POLICY "Editors can create own video justifications"
ON public.video_delay_justifications
FOR INSERT
WITH CHECK (editor_id = auth.uid());

CREATE POLICY "CEO can archive video justifications"
ON public.video_delay_justifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'ceo'
  )
);

-- Create video notification dismissals table
CREATE TABLE IF NOT EXISTS public.video_notification_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_notification_dismissals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert own video dismissals"
ON public.video_notification_dismissals
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own video dismissals"
ON public.video_notification_dismissals
FOR SELECT
USING (user_id = auth.uid());

-- Create video completion notifications table (similar to design_completion_notifications)
CREATE TABLE IF NOT EXISTS public.video_completion_notifications (
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
ALTER TABLE public.video_completion_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own video completion notifications"
ON public.video_completion_notifications
FOR SELECT
USING (requester_id = auth.uid());

CREATE POLICY "Users can update their own video completion notifications"
ON public.video_completion_notifications
FOR UPDATE
USING (requester_id = auth.uid());

CREATE POLICY "Users can delete their own video completion notifications"
ON public.video_completion_notifications
FOR DELETE
USING (requester_id = auth.uid());

CREATE POLICY "System can insert video completion notifications"
ON public.video_completion_notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'editor_video', 'sucesso_cliente')
  )
);