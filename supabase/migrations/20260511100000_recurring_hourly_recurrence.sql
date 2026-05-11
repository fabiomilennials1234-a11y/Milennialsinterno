-- 20260511100000_recurring_hourly_recurrence.sql
--
-- Add hourly recurrence options ('every_1h', 'every_6h') to recurring task
-- templates. Also adds recurring_template_id FK on department_tasks for
-- robust dedup (replaces fragile title-based matching). Reschedules pg_cron
-- from daily to hourly so hourly templates actually fire.

BEGIN;

-- ==================== 1. Expand recurrence CHECK constraint ====================

ALTER TABLE public.recurring_task_templates
  DROP CONSTRAINT recurring_task_templates_recurrence_check;

ALTER TABLE public.recurring_task_templates
  ADD CONSTRAINT recurring_task_templates_recurrence_check
  CHECK (recurrence IN (
    'every_1h', 'every_6h',
    'daily',
    'weekly_monday', 'weekly_tuesday', 'weekly_wednesday',
    'weekly_thursday', 'weekly_friday'
  ));

-- ==================== 2. Add recurring_template_id to department_tasks ====================

ALTER TABLE public.department_tasks
  ADD COLUMN IF NOT EXISTS recurring_template_id uuid
    REFERENCES public.recurring_task_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_department_tasks_recurring_template
  ON public.department_tasks (recurring_template_id, user_id, created_at)
  WHERE recurring_template_id IS NOT NULL;

-- ==================== 3. Rewrite: generate_recurring_tasks() (authenticated RPC) ====================

CREATE OR REPLACE FUNCTION public.generate_recurring_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now      timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_today    date        := v_now::date;
  v_dow      integer     := EXTRACT(DOW FROM v_today)::integer; -- 0=sunday
  v_hour     integer     := EXTRACT(HOUR FROM v_now)::integer;
  v_dow_name text;
  v_template RECORD;
  v_user     RECORD;
  v_count    integer := 0;
  v_should_generate boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Map DOW to recurrence name
  v_dow_name := CASE v_dow
    WHEN 1 THEN 'weekly_monday'
    WHEN 2 THEN 'weekly_tuesday'
    WHEN 3 THEN 'weekly_wednesday'
    WHEN 4 THEN 'weekly_thursday'
    WHEN 5 THEN 'weekly_friday'
    ELSE NULL
  END;

  FOR v_template IN
    SELECT * FROM public.recurring_task_templates
    WHERE is_active = true
    AND (
      recurrence = 'daily'
      OR recurrence = 'every_1h'
      OR recurrence = 'every_6h'
      OR recurrence = v_dow_name
    )
  LOOP
    FOR v_user IN
      SELECT ur.user_id
      FROM public.user_roles ur
      INNER JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role = v_template.target_role
    LOOP
      -- Determine if we should generate based on recurrence type
      v_should_generate := false;

      IF v_template.recurrence = 'every_1h' THEN
        -- Dedup: no task from this template+user in current hour
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE recurring_template_id = v_template.id
            AND user_id = v_user.user_id
            AND created_at >= date_trunc('hour', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
        );

      ELSIF v_template.recurrence = 'every_6h' THEN
        -- Dedup: no task from this template+user in last 6 hours
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE recurring_template_id = v_template.id
            AND user_id = v_user.user_id
            AND created_at >= (now() - interval '6 hours')
        );

      ELSE
        -- daily / weekly_*: dedup by date (backwards-compat: check both template_id and title fallback)
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE user_id = v_user.user_id
            AND department = v_template.department
            AND created_at::date = v_today
            AND (
              recurring_template_id = v_template.id
              OR (recurring_template_id IS NULL AND title = v_template.title)
            )
        );
      END IF;

      IF v_should_generate THEN
        INSERT INTO public.department_tasks (
          user_id, department, title, description, task_type, status, priority,
          recurring_template_id
        ) VALUES (
          v_user.user_id,
          v_template.department,
          v_template.title,
          v_template.description,
          CASE WHEN v_template.recurrence LIKE 'weekly_%' THEN 'weekly' ELSE 'daily' END,
          'todo',
          v_template.priority,
          v_template.id
        );
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurring_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_recurring_tasks() TO authenticated;

-- ==================== 4. Rewrite: _cron_generate_recurring_tasks() (pg_cron) ====================

CREATE OR REPLACE FUNCTION public._cron_generate_recurring_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now      timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_today    date        := v_now::date;
  v_dow      integer     := EXTRACT(DOW FROM v_today)::integer;
  v_hour     integer     := EXTRACT(HOUR FROM v_now)::integer;
  v_dow_name text;
  v_template RECORD;
  v_user     RECORD;
  v_count    integer := 0;
  v_should_generate boolean;
BEGIN
  -- No auth check: called by pg_cron (superuser context)

  v_dow_name := CASE v_dow
    WHEN 1 THEN 'weekly_monday'
    WHEN 2 THEN 'weekly_tuesday'
    WHEN 3 THEN 'weekly_wednesday'
    WHEN 4 THEN 'weekly_thursday'
    WHEN 5 THEN 'weekly_friday'
    ELSE NULL
  END;

  FOR v_template IN
    SELECT * FROM public.recurring_task_templates
    WHERE is_active = true
    AND (
      recurrence = 'daily'
      OR recurrence = 'every_1h'
      OR recurrence = 'every_6h'
      OR recurrence = v_dow_name
    )
  LOOP
    FOR v_user IN
      SELECT ur.user_id
      FROM public.user_roles ur
      INNER JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role = v_template.target_role
    LOOP
      v_should_generate := false;

      IF v_template.recurrence = 'every_1h' THEN
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE recurring_template_id = v_template.id
            AND user_id = v_user.user_id
            AND created_at >= date_trunc('hour', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'
        );

      ELSIF v_template.recurrence = 'every_6h' THEN
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE recurring_template_id = v_template.id
            AND user_id = v_user.user_id
            AND created_at >= (now() - interval '6 hours')
        );

      ELSE
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE user_id = v_user.user_id
            AND department = v_template.department
            AND created_at::date = v_today
            AND (
              recurring_template_id = v_template.id
              OR (recurring_template_id IS NULL AND title = v_template.title)
            )
        );
      END IF;

      IF v_should_generate THEN
        INSERT INTO public.department_tasks (
          user_id, department, title, description, task_type, status, priority,
          recurring_template_id
        ) VALUES (
          v_user.user_id,
          v_template.department,
          v_template.title,
          v_template.description,
          CASE WHEN v_template.recurrence LIKE 'weekly_%' THEN 'weekly' ELSE 'daily' END,
          'todo',
          v_template.priority,
          v_template.id
        );
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public._cron_generate_recurring_tasks() FROM PUBLIC;

-- ==================== 5. Reschedule pg_cron: hourly Mon-Fri ====================

-- Remove old daily-only schedule
SELECT cron.unschedule('generate-recurring-tasks');

-- New schedule: every hour Mon-Fri (covers hourly + daily + weekly)
SELECT cron.schedule(
  'generate-recurring-tasks',
  '0 * * * 1-5',
  $$SELECT public._cron_generate_recurring_tasks()$$
);

COMMIT;
