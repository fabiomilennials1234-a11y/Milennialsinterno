-- Create table for exit reasons/feedback from churned clients
CREATE TABLE public.cs_exit_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  public_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  
  -- Form questions
  main_reason TEXT, -- Main reason for leaving
  satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5), -- 1-5 scale
  what_could_improve TEXT, -- What could we have done better
  would_recommend BOOLEAN, -- Would you recommend to others
  additional_feedback TEXT, -- Additional comments
  
  -- Metadata
  is_submitted BOOLEAN DEFAULT false,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  
  CONSTRAINT unique_client_exit_reason UNIQUE (client_id)
);

-- Enable RLS
ALTER TABLE public.cs_exit_reasons ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (CS team)
CREATE POLICY "Authenticated users can view all exit reasons"
ON public.cs_exit_reasons
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create exit reasons"
ON public.cs_exit_reasons
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update exit reasons"
ON public.cs_exit_reasons
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Policy for public form submission (via token)
CREATE POLICY "Public can submit via token"
ON public.cs_exit_reasons
FOR UPDATE
USING (public_token IS NOT NULL)
WITH CHECK (public_token IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_cs_exit_reasons_client_id ON public.cs_exit_reasons(client_id);
CREATE INDEX idx_cs_exit_reasons_public_token ON public.cs_exit_reasons(public_token);
CREATE INDEX idx_cs_exit_reasons_is_submitted ON public.cs_exit_reasons(is_submitted);