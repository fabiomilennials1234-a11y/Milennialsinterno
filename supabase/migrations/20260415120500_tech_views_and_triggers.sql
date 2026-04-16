-- 20260415120500_tech_views_and_triggers.sql

BEGIN;

-- View: total active seconds per task, derived from event stream.
CREATE OR REPLACE VIEW public.tech_task_time_totals AS
WITH ordered AS (
  SELECT
    task_id,
    user_id,
    type,
    created_at,
    LEAD(created_at) OVER (PARTITION BY task_id ORDER BY created_at) AS next_at,
    LEAD(type) OVER (PARTITION BY task_id ORDER BY created_at) AS next_type
  FROM public.tech_time_entries
),
intervals AS (
  SELECT
    task_id,
    CASE
      WHEN type IN ('START','RESUME') AND next_type IN ('PAUSE','STOP') THEN
        EXTRACT(EPOCH FROM (next_at - created_at))
      WHEN type IN ('START','RESUME') AND next_at IS NULL THEN
        EXTRACT(EPOCH FROM (now() - created_at))
      ELSE 0
    END AS seconds
  FROM ordered
)
SELECT
  task_id,
  COALESCE(SUM(seconds), 0)::bigint AS total_seconds
FROM intervals
GROUP BY task_id;

GRANT SELECT ON public.tech_task_time_totals TO authenticated;

-- Trigger: activity on task insert and status change
CREATE OR REPLACE FUNCTION public.tech_tasks_activity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
    VALUES (NEW.id, COALESCE(NEW.created_by, auth.uid()), 'task_created', '{}'::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
      VALUES (
        NEW.id,
        COALESCE(auth.uid(), NEW.created_by),
        'status_changed',
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tech_tasks_activity_insert
  AFTER INSERT ON public.tech_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.tech_tasks_activity_trigger();

CREATE TRIGGER tech_tasks_activity_update
  AFTER UPDATE ON public.tech_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.tech_tasks_activity_trigger();

COMMIT;
