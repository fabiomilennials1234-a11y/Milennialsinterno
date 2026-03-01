-- Tabela para notificações de novo cliente atribuído ao gestor de ads
CREATE TABLE public.ads_new_client_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ads_manager_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_by_name TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ads_new_client_notifications_ads_manager_id ON public.ads_new_client_notifications(ads_manager_id);
CREATE INDEX idx_ads_new_client_notifications_created_at ON public.ads_new_client_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.ads_new_client_notifications ENABLE ROW LEVEL SECURITY;

-- Policies: Ads managers can see their own notifications
CREATE POLICY "Ads managers can view new client notifications"
ON public.ads_new_client_notifications
FOR SELECT
USING (
  auth.uid() = ads_manager_id OR
  public.is_ceo(auth.uid()) OR
  public.has_role(auth.uid(), 'gestor_projetos')
);

-- Ads managers can update their own notifications (mark as read)
CREATE POLICY "Ads managers can update new client notifications"
ON public.ads_new_client_notifications
FOR UPDATE
USING (auth.uid() = ads_manager_id);

-- Any authenticated user can insert notifications
CREATE POLICY "Authenticated users can insert new client notifications"
ON public.ads_new_client_notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.ads_new_client_notifications;
