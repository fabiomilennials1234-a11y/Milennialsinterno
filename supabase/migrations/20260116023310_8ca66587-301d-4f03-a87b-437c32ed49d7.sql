-- Add strategy_link field to client_call_forms
ALTER TABLE public.client_call_forms ADD COLUMN IF NOT EXISTS strategy_link TEXT;

-- Create table for strategy requests
CREATE TABLE public.strategy_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  kanban_card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategy_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for strategy_requests
CREATE POLICY "Users can view all strategy requests"
ON public.strategy_requests
FOR SELECT
USING (true);

CREATE POLICY "Users can create strategy requests"
ON public.strategy_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update strategy requests"
ON public.strategy_requests
FOR UPDATE
USING (auth.uid() IS NOT NULL);