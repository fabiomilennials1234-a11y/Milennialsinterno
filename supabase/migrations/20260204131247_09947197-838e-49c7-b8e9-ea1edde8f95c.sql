-- ==========================================
-- TABELAS PARA OKRs E FORMULÁRIO REUNIÃO 1a1
-- ==========================================

-- Tabela de OKRs (anuais e semanais)
CREATE TABLE public.okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('annual', 'weekly')),
  target_value NUMERIC DEFAULT 100,
  current_value NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de reuniões 1 a 1
CREATE TABLE public.meetings_one_on_one (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluated_manager_id UUID NOT NULL,
  evaluated_manager_name TEXT NOT NULL,
  documentation_up_to_date BOOLEAN DEFAULT false,
  correct_client_movement BOOLEAN DEFAULT false,
  
  -- Atrasos por área
  delay_video BOOLEAN DEFAULT false,
  delay_design BOOLEAN DEFAULT false,
  delay_site BOOLEAN DEFAULT false,
  delay_crm BOOLEAN DEFAULT false,
  delay_automation BOOLEAN DEFAULT false,
  
  -- Desafios e observações
  main_challenges TEXT[] DEFAULT '{}',
  general_observations TEXT,
  
  -- Metadados
  meeting_date DATE DEFAULT CURRENT_DATE,
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de problemas da semana (agregados das reuniões)
CREATE TABLE public.weekly_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_text TEXT NOT NULL,
  source_meeting_id UUID REFERENCES public.meetings_one_on_one(id) ON DELETE CASCADE,
  problem_type TEXT CHECK (problem_type IN ('challenge', 'delay_video', 'delay_design', 'delay_site', 'delay_crm', 'delay_automation', 'observation')),
  manager_id UUID,
  manager_name TEXT,
  week_start DATE,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para resumos semanais gerados por IA
CREATE TABLE public.weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  summary_text TEXT NOT NULL,
  main_challenges TEXT[],
  main_delays TEXT[],
  recommendations TEXT[],
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de desafios pré-definidos (para seleção no forms)
CREATE TABLE public.predefined_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_text TEXT NOT NULL UNIQUE,
  usage_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir desafios comuns iniciais
INSERT INTO public.predefined_challenges (challenge_text) VALUES
  ('Falta de comunicação com cliente'),
  ('Atraso na entrega de materiais'),
  ('Cliente não responde'),
  ('Mudança de escopo frequente'),
  ('Problema técnico na plataforma'),
  ('Falta de briefing claro'),
  ('Orçamento insuficiente'),
  ('Equipe sobrecarregada'),
  ('Prazo muito curto'),
  ('Dependência de terceiros');

-- Habilitar RLS
ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings_one_on_one ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predefined_challenges ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para OKRs (todos podem ver, apenas admin pode editar)
CREATE POLICY "Todos podem ver OKRs" ON public.okrs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem criar OKRs" ON public.okrs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins podem atualizar OKRs" ON public.okrs FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins podem deletar OKRs" ON public.okrs FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Políticas para reuniões 1 a 1
CREATE POLICY "Todos podem ver reuniões 1a1" ON public.meetings_one_on_one FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem criar reuniões 1a1" ON public.meetings_one_on_one FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins podem atualizar reuniões 1a1" ON public.meetings_one_on_one FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Políticas para problemas semanais
CREATE POLICY "Todos podem ver problemas semanais" ON public.weekly_problems FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerenciar problemas semanais" ON public.weekly_problems FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Políticas para resumos semanais
CREATE POLICY "Todos podem ver resumos semanais" ON public.weekly_summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sistema pode criar resumos" ON public.weekly_summaries FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para desafios predefinidos
CREATE POLICY "Todos podem ver desafios predefinidos" ON public.predefined_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerenciar desafios" ON public.predefined_challenges FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_okrs_updated_at BEFORE UPDATE ON public.okrs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings_one_on_one FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para problemas semanais
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_problems;
ALTER PUBLICATION supabase_realtime ADD TABLE public.okrs;