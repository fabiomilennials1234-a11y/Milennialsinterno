-- Table for design delay justifications
CREATE TABLE public.design_delay_justifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  designer_id UUID NOT NULL,
  designer_name TEXT NOT NULL,
  justification TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID
);

-- Enable RLS
ALTER TABLE public.design_delay_justifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Designers can create own justifications"
ON public.design_delay_justifications FOR INSERT
WITH CHECK (designer_id = auth.uid());

CREATE POLICY "Authorized roles can view justifications"
ON public.design_delay_justifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design', 'sucesso_cliente')
  )
);

CREATE POLICY "CEO can archive justifications"
ON public.design_delay_justifications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'ceo'
  )
);

-- Table for design delay notifications
CREATE TABLE public.design_delay_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  card_title TEXT NOT NULL,
  designer_id UUID NOT NULL,
  designer_name TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.design_delay_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Authorized roles can view notifications"
ON public.design_delay_notifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design', 'sucesso_cliente')
  )
);

CREATE POLICY "System can insert notifications"
ON public.design_delay_notifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design', 'sucesso_cliente')
  )
);

CREATE POLICY "Admins can delete notifications"
ON public.design_delay_notifications FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos')
  )
);

-- Table for notification dismissals
CREATE TABLE public.design_notification_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID NOT NULL,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Enable RLS
ALTER TABLE public.design_notification_dismissals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert own dismissals"
ON public.design_notification_dismissals FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own dismissals"
ON public.design_notification_dismissals FOR SELECT
USING (user_id = auth.uid());