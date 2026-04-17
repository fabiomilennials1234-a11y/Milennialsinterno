-- 20260417120000_tech_tasks_lock_created_by.sql
-- Make tech_tasks.created_by immutable at the database layer.
--
-- Rationale: created_by identifies who authored the task and is the only
-- reliable signal for discussing a task with its originator. Nothing in the
-- existing RLS policies prevents an UPDATE from rewriting that column, so any
-- executive or hot path could (accidentally or not) erase authorship. RLS
-- cannot compare OLD/NEW on UPDATE — a BEFORE UPDATE trigger is the correct
-- primitive.

CREATE OR REPLACE FUNCTION public.tech_tasks_lock_created_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tech_tasks_lock_created_by ON public.tech_tasks;

CREATE TRIGGER trg_tech_tasks_lock_created_by
  BEFORE UPDATE ON public.tech_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tech_tasks_lock_created_by();
