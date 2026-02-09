-- public_token: use pgcrypto from extensions schema (Supabase installs it there)
-- gen_random_bytes(integer) lives in extensions.gen_random_bytes on Supabase
CREATE TABLE public.nps_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Pesquisa NPS | Millennials',
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  public_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex')
);

-- Create NPS responses table
CREATE TABLE public.nps_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.nps_surveys(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  nps_score INTEGER NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
  score_reason TEXT NOT NULL,
  strategies_aligned TEXT NOT NULL CHECK (strategies_aligned IN ('sim', 'parcialmente', 'nao')),
  communication_rating TEXT NOT NULL CHECK (communication_rating IN ('excelente', 'bom', 'regular', 'ruim', 'outro')),
  communication_other TEXT,
  creatives_rating TEXT NOT NULL CHECK (creatives_rating IN ('excelente', 'bom', 'regular', 'ruim')),
  creatives_represent_brand TEXT NOT NULL CHECK (creatives_represent_brand IN ('sim_totalmente', 'parcialmente', 'nao')),
  improvement_suggestions TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nps_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

-- Policies for nps_surveys
CREATE POLICY "CEO and CS can manage surveys" 
ON public.nps_surveys 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'sucesso_cliente')
  )
);

-- Policies for nps_responses - authenticated users can view
CREATE POLICY "CEO and CS can view responses" 
ON public.nps_responses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('ceo', 'sucesso_cliente')
  )
);

-- Public can insert responses (via public token validation in app)
CREATE POLICY "Anyone can submit responses" 
ON public.nps_responses 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_nps_surveys_public_token ON public.nps_surveys(public_token);
CREATE INDEX idx_nps_responses_survey_id ON public.nps_responses(survey_id);

-- Update trigger for surveys
CREATE TRIGGER update_nps_surveys_updated_at
BEFORE UPDATE ON public.nps_surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
