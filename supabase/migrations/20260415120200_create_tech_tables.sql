-- 20260415120200_create_tech_tables.sql
-- Tables for Milennials Tech. All with RLS enabled (policies in a later migration).

BEGIN;

CREATE EXTENSION IF NOT EXISTS moddatetime;

-- Sprints
CREATE TABLE public.tech_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  goal TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status public.tech_sprint_status NOT NULL DEFAULT 'PLANNING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tech_sprints_date_range CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX tech_sprints_single_active
  ON public.tech_sprints (status) WHERE status = 'ACTIVE';

ALTER TABLE public.tech_sprints ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tech_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT,
  type public.tech_task_type NOT NULL,
  status public.tech_task_status NOT NULL DEFAULT 'BACKLOG',
  priority public.tech_task_priority NOT NULL,
  sprint_id UUID REFERENCES public.tech_sprints(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  deadline TIMESTAMPTZ,
  estimated_hours NUMERIC CHECK (estimated_hours IS NULL OR estimated_hours > 0),
  acceptance_criteria TEXT,
  technical_context TEXT,
  git_branch TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocker_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tech_tasks_status_idx ON public.tech_tasks (status);
CREATE INDEX tech_tasks_type_idx ON public.tech_tasks (type);
CREATE INDEX tech_tasks_assignee_idx ON public.tech_tasks (assignee_id);
CREATE INDEX tech_tasks_sprint_idx ON public.tech_tasks (sprint_id);

CREATE TRIGGER tech_tasks_moddatetime
  BEFORE UPDATE ON public.tech_tasks
  FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

ALTER TABLE public.tech_tasks ENABLE ROW LEVEL SECURITY;

-- Collaborators
CREATE TABLE public.tech_task_collaborators (
  task_id UUID NOT NULL REFERENCES public.tech_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX tech_task_collaborators_user_idx ON public.tech_task_collaborators (user_id);
ALTER TABLE public.tech_task_collaborators ENABLE ROW LEVEL SECURITY;

-- Time entries
CREATE TABLE public.tech_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tech_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.tech_time_entry_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tech_time_entries_task_idx ON public.tech_time_entries (task_id);
CREATE INDEX tech_time_entries_user_idx ON public.tech_time_entries (user_id);
CREATE INDEX tech_time_entries_user_latest ON public.tech_time_entries (user_id, created_at DESC);

ALTER TABLE public.tech_time_entries ENABLE ROW LEVEL SECURITY;

-- Activities (immutable)
CREATE TABLE public.tech_task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tech_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tech_task_activities_task_idx ON public.tech_task_activities (task_id, created_at DESC);

ALTER TABLE public.tech_task_activities ENABLE ROW LEVEL SECURITY;

COMMIT;
