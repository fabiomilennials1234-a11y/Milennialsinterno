-- Create table to store client strategies/funnels
CREATE TABLE public.client_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- General settings
  minimum_investment NUMERIC,
  recommended_investment NUMERIC,
  ad_location TEXT,
  use_client_material BOOLEAN DEFAULT false,
  client_material_details TEXT,
  
  -- Platform selections (which platforms are enabled)
  meta_enabled BOOLEAN DEFAULT false,
  google_enabled BOOLEAN DEFAULT false,
  linkedin_enabled BOOLEAN DEFAULT false,
  
  -- Meta Strategies (JSON with detailed config for each)
  meta_millennials_mensagem JSONB,
  meta_millennials_cadastro JSONB,
  meta_millennials_call JSONB,
  meta_captacao_representantes JSONB,
  meta_captacao_sdr JSONB,
  meta_disparo_email JSONB,
  meta_grupo_vip JSONB,
  meta_aumento_base JSONB,
  
  -- Google Strategies
  google_pmax JSONB,
  google_pesquisa JSONB,
  google_display JSONB,
  
  -- LinkedIn Strategies
  linkedin_vagas JSONB,
  linkedin_cadastro JSONB,
  
  -- Published link (public access token)
  public_token UUID DEFAULT gen_random_uuid(),
  is_published BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.client_strategies ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view strategies" 
  ON public.client_strategies 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can create strategies" 
  ON public.client_strategies 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update strategies" 
  ON public.client_strategies 
  FOR UPDATE 
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete strategies" 
  ON public.client_strategies 
  FOR DELETE 
  TO authenticated
  USING (true);

-- Policy for public access via token (for the public strategy page)
CREATE POLICY "Public can view published strategies via token" 
  ON public.client_strategies 
  FOR SELECT 
  TO anon
  USING (is_published = true);

-- Index for fast token lookups
CREATE INDEX idx_client_strategies_public_token ON public.client_strategies(public_token);
CREATE INDEX idx_client_strategies_client_id ON public.client_strategies(client_id);

-- Update trigger
CREATE TRIGGER update_client_strategies_updated_at
  BEFORE UPDATE ON public.client_strategies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();