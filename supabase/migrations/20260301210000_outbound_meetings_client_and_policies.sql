-- Add client_id to outbound_meetings for linking meetings to clients
ALTER TABLE public.outbound_meetings
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_outbound_meetings_client ON public.outbound_meetings(client_id);

-- Allow outbound managers to INSERT their own meetings
DROP POLICY IF EXISTS "Outbound managers can insert their meetings" ON public.outbound_meetings;
CREATE POLICY "Outbound managers can insert their meetings"
ON public.outbound_meetings FOR INSERT
WITH CHECK (outbound_manager_id = auth.uid());

-- Allow outbound managers to UPDATE their own meetings
DROP POLICY IF EXISTS "Outbound managers can update their meetings" ON public.outbound_meetings;
CREATE POLICY "Outbound managers can update their meetings"
ON public.outbound_meetings FOR UPDATE
USING (outbound_manager_id = auth.uid());

-- Allow outbound managers to DELETE their own meetings
DROP POLICY IF EXISTS "Outbound managers can delete their meetings" ON public.outbound_meetings;
CREATE POLICY "Outbound managers can delete their meetings"
ON public.outbound_meetings FOR DELETE
USING (outbound_manager_id = auth.uid());
