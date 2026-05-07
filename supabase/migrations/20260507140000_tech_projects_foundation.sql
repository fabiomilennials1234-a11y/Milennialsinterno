-- 20260507140000_tech_projects_foundation.sql
--
-- Foundation tables for Gestao de Projetos CTO:
--   tech_projects, tech_project_members, tech_project_tracking
--   + ALTER tech_tasks ADD project_id
--
-- RLS: executivos (CEO/CTO) only — devs do NOT see the project management layer.
-- Members SELECT also allows self-referencing (member can see their own membership).

BEGIN;

-- ===========================================================================
-- tech_projects
-- ===========================================================================

CREATE TABLE public.tech_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('client', 'internal')),
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'paused', 'completed')),
  current_step TEXT NOT NULL DEFAULT 'briefing',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  estimated_hours NUMERIC CHECK (estimated_hours IS NULL OR estimated_hours > 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tech_projects_status ON public.tech_projects (status);
CREATE INDEX idx_tech_projects_lead ON public.tech_projects (lead_id);
CREATE INDEX idx_tech_projects_client ON public.tech_projects (client_id);
CREATE INDEX idx_tech_projects_step ON public.tech_projects (current_step);

CREATE TRIGGER tech_projects_moddatetime
  BEFORE UPDATE ON public.tech_projects
  FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

ALTER TABLE public.tech_projects ENABLE ROW LEVEL SECURITY;

-- RLS: executivos only (CEO/CTO)
CREATE POLICY "tech_projects_select" ON public.tech_projects
  FOR SELECT TO authenticated
  USING (public.is_executive(auth.uid()));

CREATE POLICY "tech_projects_insert" ON public.tech_projects
  FOR INSERT TO authenticated
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_projects_update" ON public.tech_projects
  FOR UPDATE TO authenticated
  USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_projects_delete" ON public.tech_projects
  FOR DELETE TO authenticated
  USING (public.is_executive(auth.uid()));

-- ===========================================================================
-- tech_project_members
-- ===========================================================================

CREATE TABLE public.tech_project_members (
  project_id UUID NOT NULL REFERENCES public.tech_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allocated_hours_week NUMERIC NOT NULL DEFAULT 0 CHECK (allocated_hours_week >= 0),
  role TEXT NOT NULL DEFAULT 'dev' CHECK (role IN ('lead', 'dev', 'design', 'qa')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_tech_project_members_user ON public.tech_project_members (user_id);

ALTER TABLE public.tech_project_members ENABLE ROW LEVEL SECURITY;

-- SELECT: executivos + members of the project (self-referencing)
CREATE POLICY "tech_project_members_select" ON public.tech_project_members
  FOR SELECT TO authenticated
  USING (
    public.is_executive(auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "tech_project_members_insert" ON public.tech_project_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_project_members_update" ON public.tech_project_members
  FOR UPDATE TO authenticated
  USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_project_members_delete" ON public.tech_project_members
  FOR DELETE TO authenticated
  USING (public.is_executive(auth.uid()));

-- ===========================================================================
-- tech_project_tracking
-- ===========================================================================

CREATE TABLE public.tech_project_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.tech_projects(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES auth.users(id),
  current_day TEXT NOT NULL CHECK (current_day IN ('segunda', 'terca', 'quarta', 'quinta', 'sexta')),
  last_moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_delayed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tech_project_tracking_project_unique UNIQUE (project_id)
);

CREATE TRIGGER tech_project_tracking_moddatetime
  BEFORE UPDATE ON public.tech_project_tracking
  FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

ALTER TABLE public.tech_project_tracking ENABLE ROW LEVEL SECURITY;

-- RLS: executivos only
CREATE POLICY "tech_project_tracking_select" ON public.tech_project_tracking
  FOR SELECT TO authenticated
  USING (public.is_executive(auth.uid()));

CREATE POLICY "tech_project_tracking_insert" ON public.tech_project_tracking
  FOR INSERT TO authenticated
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_project_tracking_update" ON public.tech_project_tracking
  FOR UPDATE TO authenticated
  USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_project_tracking_delete" ON public.tech_project_tracking
  FOR DELETE TO authenticated
  USING (public.is_executive(auth.uid()));

-- ===========================================================================
-- ALTER tech_tasks — add project_id
-- ===========================================================================

ALTER TABLE public.tech_tasks
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.tech_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tech_tasks_project ON public.tech_tasks (project_id);

-- tech_tasks already has RLS. The new project_id column is visible to anyone
-- who can already SELECT tech_tasks (via can_see_tech). No new policy needed.

COMMIT;
