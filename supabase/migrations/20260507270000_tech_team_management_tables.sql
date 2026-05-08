-- ============================================================================
-- tech_dev_dailies — Daily standup documentation per dev (async)
-- ============================================================================

CREATE TABLE public.tech_dev_dailies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dev_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filled_by uuid NOT NULL REFERENCES auth.users(id),
  date date NOT NULL,
  did_yesterday text,
  doing_today text,
  blockers text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dev_user_id, date)
);

ALTER TABLE public.tech_dev_dailies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "executives_all" ON public.tech_dev_dailies
  FOR ALL USING (public.is_executive(auth.uid()));

CREATE INDEX idx_tech_dev_dailies_date ON public.tech_dev_dailies(date);
CREATE INDEX idx_tech_dev_dailies_dev ON public.tech_dev_dailies(dev_user_id);

-- updated_at trigger
CREATE TRIGGER trg_tech_dev_dailies_updated_at
  BEFORE UPDATE ON public.tech_dev_dailies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- tech_project_dailies — Daily project tracking documentation
-- ============================================================================

CREATE TABLE public.tech_project_dailies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.tech_projects(id) ON DELETE CASCADE,
  filled_by uuid NOT NULL REFERENCES auth.users(id),
  date date NOT NULL,
  status text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'blocked')),
  progress_today text,
  next_steps text,
  blockers text,
  completion_pct smallint NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, date)
);

ALTER TABLE public.tech_project_dailies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "executives_all" ON public.tech_project_dailies
  FOR ALL USING (public.is_executive(auth.uid()));

CREATE INDEX idx_tech_project_dailies_date ON public.tech_project_dailies(date);
CREATE INDEX idx_tech_project_dailies_project ON public.tech_project_dailies(project_id);

-- updated_at trigger
CREATE TRIGGER trg_tech_project_dailies_updated_at
  BEFORE UPDATE ON public.tech_project_dailies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- tech_one_on_ones — Weekly 1:1 meeting records
-- ============================================================================

CREATE TABLE public.tech_one_on_ones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dev_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id),
  week_start date NOT NULL,
  performance_rating smallint NOT NULL CHECK (performance_rating BETWEEN 1 AND 5),
  positives text,
  improvements text,
  agreements text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dev_user_id, week_start)
);

ALTER TABLE public.tech_one_on_ones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "executives_all" ON public.tech_one_on_ones
  FOR ALL USING (public.is_executive(auth.uid()));

CREATE INDEX idx_tech_one_on_ones_dev ON public.tech_one_on_ones(dev_user_id);
CREATE INDEX idx_tech_one_on_ones_week ON public.tech_one_on_ones(week_start);

-- updated_at trigger
CREATE TRIGGER trg_tech_one_on_ones_updated_at
  BEFORE UPDATE ON public.tech_one_on_ones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
