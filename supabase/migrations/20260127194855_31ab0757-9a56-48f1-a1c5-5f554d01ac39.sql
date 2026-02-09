-- Tabela para notificações de anotações do gestor de ads
CREATE TABLE public.ads_note_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ads_manager_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  note_id UUID NOT NULL REFERENCES public.client_notes(id) ON DELETE CASCADE,
  note_content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_by_name TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ads_note_notifications ENABLE ROW LEVEL SECURITY;

-- Policies: Ads managers can see their own notifications
CREATE POLICY "Ads managers can view their notifications"
ON public.ads_note_notifications
FOR SELECT
USING (
  auth.uid() = ads_manager_id OR 
  public.is_ceo(auth.uid()) OR 
  public.has_role(auth.uid(), 'gestor_projetos')
);

-- Ads managers can update their own notifications (mark as read)
CREATE POLICY "Ads managers can update their notifications"
ON public.ads_note_notifications
FOR UPDATE
USING (auth.uid() = ads_manager_id);

-- Any authenticated user can insert notifications
CREATE POLICY "Authenticated users can insert notifications"
ON public.ads_note_notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.ads_note_notifications;