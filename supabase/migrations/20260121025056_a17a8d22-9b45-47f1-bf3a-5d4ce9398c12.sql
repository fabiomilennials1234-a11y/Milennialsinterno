-- Table for design demand completion notifications
CREATE TABLE public.design_completion_notifications (
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
ALTER TABLE public.design_completion_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications"
  ON public.design_completion_notifications FOR SELECT
  USING (requester_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.design_completion_notifications FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design', 'sucesso_cliente')
  ));

CREATE POLICY "Users can update their own notifications"
  ON public.design_completion_notifications FOR UPDATE
  USING (requester_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON public.design_completion_notifications FOR DELETE
  USING (requester_id = auth.uid());