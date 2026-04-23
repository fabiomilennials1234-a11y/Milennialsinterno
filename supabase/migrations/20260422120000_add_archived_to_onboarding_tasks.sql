-- 20260422120000_add_archived_to_onboarding_tasks.sql
--
-- Schema drift fix. Frontend (useOnboardingTasks, useCSOnboardingTracking,
-- useTaskDelayNotifications) assume coluna `archived` em onboarding_tasks
-- desde 20260113 mas migration nunca existiu. Resultado: 400 (42703) em
-- loop no TaskDelayModal global do MainLayout, poluindo dashboard e /rh.
-- Mirror do padrao ja aplicado em ads_tasks (migration 20260113212342).

BEGIN;

ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_archived
  ON public.onboarding_tasks(archived)
  WHERE archived = false;

COMMIT;
