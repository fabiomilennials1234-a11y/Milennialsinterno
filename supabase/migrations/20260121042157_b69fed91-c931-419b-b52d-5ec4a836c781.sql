-- Create atrizes completion notifications table
CREATE TABLE public.atrizes_completion_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL,
  card_title TEXT NOT NULL,
  completed_by UUID NOT NULL,
  completed_by_name TEXT NOT NULL,
  requester_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.atrizes_completion_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications (where they are the requester)
CREATE POLICY "Users can view their own atrizes notifications"
ON public.atrizes_completion_notifications
FOR SELECT
USING (auth.uid() = requester_id);

-- Policy: Authenticated users can insert notifications
CREATE POLICY "Authenticated users can insert atrizes notifications"
ON public.atrizes_completion_notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own atrizes notifications"
ON public.atrizes_completion_notifications
FOR UPDATE
USING (auth.uid() = requester_id);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.atrizes_completion_notifications;