-- 20260507260000_task_advance_to_step.sql
--
-- Replace manual "Advance Step" button with per-task advance_to_step.
-- When a task with advance_to_step is completed (status -> 'done'),
-- the linked project automatically advances to that step.
--
-- 1. Add advance_to_step column to department_tasks
-- 2. Trigger: advance project step on task completion

BEGIN;

-- ===========================================================================
-- 1. Add advance_to_step column
-- ===========================================================================

ALTER TABLE public.department_tasks
  ADD COLUMN IF NOT EXISTS advance_to_step TEXT;

-- ===========================================================================
-- 2. Trigger: advance project step when task with advance_to_step is done
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._trg_task_advance_project_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_steps TEXT[] := ARRAY[
    'briefing', 'arquitetura', 'setup_ambiente', 'desenvolvimento',
    'code_review', 'testes', 'deploy', 'acompanhamento'
  ];
BEGIN
  -- Only fire when status changed TO 'done'
  IF NEW.status <> 'done' OR OLD.status = 'done' THEN
    RETURN NEW;
  END IF;

  -- Only if advance_to_step and project are set
  IF NEW.advance_to_step IS NULL OR NEW.related_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate advance_to_step is a known step
  IF NOT (NEW.advance_to_step = ANY(v_steps)) THEN
    RETURN NEW;
  END IF;

  -- If last step (acompanhamento), also mark project completed
  IF NEW.advance_to_step = 'acompanhamento' THEN
    UPDATE tech_projects
    SET current_step = NEW.advance_to_step,
        status = 'completed'
    WHERE id = NEW.related_project_id
      AND status IN ('active', 'planning');
  ELSE
    UPDATE tech_projects
    SET current_step = NEW.advance_to_step
    WHERE id = NEW.related_project_id
      AND status IN ('active', 'planning');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_advance_project_step ON public.department_tasks;

CREATE TRIGGER trg_task_advance_project_step
  AFTER UPDATE ON public.department_tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done')
  EXECUTE FUNCTION public._trg_task_advance_project_step();

COMMIT;
