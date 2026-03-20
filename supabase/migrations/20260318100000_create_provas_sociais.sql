-- Tipos de prova social pré-definidos
CREATE TABLE public.prova_social_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir tipos padrão
INSERT INTO public.prova_social_types (name) VALUES
  ('Vendas'), ('Leads'), ('Mensagens'), ('Reuniões'), ('Faturamento'), ('Oportunidades');

-- Provas sociais (cases)
CREATE TABLE public.provas_sociais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_logo_url TEXT,
  project_duration TEXT NOT NULL,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Métricas de cada prova social
CREATE TABLE public.prova_social_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_social_id UUID NOT NULL REFERENCES public.provas_sociais(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES public.prova_social_types(id) ON DELETE CASCADE,
  type_name TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.prova_social_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_sociais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prova_social_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can read types" ON public.prova_social_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can manage types" ON public.prova_social_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can read provas" ON public.provas_sociais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can manage provas" ON public.provas_sociais FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can read metrics" ON public.prova_social_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can manage metrics" ON public.prova_social_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);
