-- Tabela trainings
CREATE TABLE public.trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  class_date DATE,
  class_time TIME,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_days TEXT[],
  allowed_roles TEXT[],
  class_links TEXT[],
  thumbnail_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela training_lessons
CREATE TABLE public.training_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lesson_url TEXT NOT NULL DEFAULT '',
  order_index INTEGER DEFAULT 0,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Triggers updated_at (padrão do projeto)
CREATE TRIGGER set_trainings_updated_at
  BEFORE UPDATE ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_lessons ENABLE ROW LEVEL SECURITY;

-- Políticas trainings: leitura autenticados, escrita CEO
CREATE POLICY "Authenticated can view trainings" ON public.trainings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "CEO can manage trainings" ON public.trainings
  FOR ALL TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));

-- Políticas training_lessons: herda acesso via training
CREATE POLICY "Authenticated can view lessons" ON public.training_lessons
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "CEO can manage lessons" ON public.training_lessons
  FOR ALL TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));
