-- Create HR vacancies table
CREATE TABLE public.rh_vagas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  column_id UUID REFERENCES public.kanban_columns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'solicitacao_vaga',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_at TIMESTAMP WITH TIME ZONE,
  position INTEGER DEFAULT 0
);

-- Create HR vacancy briefings table with the fixed template
CREATE TABLE public.rh_vaga_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id UUID REFERENCES public.rh_vagas(id) ON DELETE CASCADE,
  solicitado_por TEXT,
  area_squad TEXT,
  nome_vaga TEXT NOT NULL,
  modelo TEXT, -- Presencial / Híbrido / Remoto
  cidade_uf TEXT,
  regime TEXT, -- CLT / PJ
  faixa_salarial TEXT,
  objetivo_vaga TEXT,
  principais_responsabilidades TEXT,
  requisitos_obrigatorios TEXT,
  requisitos_desejaveis TEXT,
  ferramentas_obrigatorias TEXT,
  nivel TEXT, -- Jr / Pl / Sr
  data_limite DATE NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create HR candidates table (for tracking applicants)
CREATE TABLE public.rh_candidatos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id UUID REFERENCES public.rh_vagas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  linkedin TEXT,
  curriculo_url TEXT,
  status TEXT NOT NULL DEFAULT 'aplicado',
  etapa_entrevista INTEGER DEFAULT 0, -- 0=none, 1=primeiro, 2=segundo, 3=terceiro
  notas TEXT,
  avaliacao INTEGER, -- 1-5 stars
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create HR delay justifications table
CREATE TABLE public.rh_justificativas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id UUID REFERENCES public.rh_vagas(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  motivo TEXT NOT NULL,
  nova_data DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create HR vacancy comments table
CREATE TABLE public.rh_comentarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id UUID REFERENCES public.rh_vagas(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create HR vacancy activities table
CREATE TABLE public.rh_atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vaga_id UUID REFERENCES public.rh_vagas(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rh_vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_vaga_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_justificativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_atividades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rh_vagas
CREATE POLICY "Users can view rh_vagas" ON public.rh_vagas FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert rh_vagas" ON public.rh_vagas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update rh_vagas" ON public.rh_vagas FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete rh_vagas" ON public.rh_vagas FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for rh_vaga_briefings
CREATE POLICY "Users can view rh_vaga_briefings" ON public.rh_vaga_briefings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert rh_vaga_briefings" ON public.rh_vaga_briefings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update rh_vaga_briefings" ON public.rh_vaga_briefings FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete rh_vaga_briefings" ON public.rh_vaga_briefings FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for rh_candidatos
CREATE POLICY "Users can view rh_candidatos" ON public.rh_candidatos FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert rh_candidatos" ON public.rh_candidatos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update rh_candidatos" ON public.rh_candidatos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete rh_candidatos" ON public.rh_candidatos FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for rh_justificativas
CREATE POLICY "Users can view rh_justificativas" ON public.rh_justificativas FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert rh_justificativas" ON public.rh_justificativas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for rh_comentarios
CREATE POLICY "Users can view rh_comentarios" ON public.rh_comentarios FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert rh_comentarios" ON public.rh_comentarios FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for rh_atividades
CREATE POLICY "Users can view rh_atividades" ON public.rh_atividades FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert rh_atividades" ON public.rh_atividades FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add triggers for updated_at
CREATE TRIGGER update_rh_vagas_updated_at
  BEFORE UPDATE ON public.rh_vagas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rh_vaga_briefings_updated_at
  BEFORE UPDATE ON public.rh_vaga_briefings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rh_candidatos_updated_at
  BEFORE UPDATE ON public.rh_candidatos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();