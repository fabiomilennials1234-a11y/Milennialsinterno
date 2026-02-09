-- Create table for storing job posting platforms
CREATE TABLE public.rh_vaga_plataformas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id UUID NOT NULL REFERENCES public.rh_vagas(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL,
  budget NUMERIC(10,2),
  descricao TEXT,
  expectativa_curriculos INTEGER,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rh_vaga_plataformas ENABLE ROW LEVEL SECURITY;

-- Create policies (RH data is public within organization for now)
CREATE POLICY "Allow read access for authenticated users" 
ON public.rh_vaga_plataformas 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Allow insert for authenticated users" 
ON public.rh_vaga_plataformas 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" 
ON public.rh_vaga_plataformas 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Allow delete for authenticated users" 
ON public.rh_vaga_plataformas 
FOR DELETE 
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_rh_vaga_plataformas_updated_at
BEFORE UPDATE ON public.rh_vaga_plataformas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();