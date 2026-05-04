-- 20260504260000_recurring_task_templates.sql
--
-- Recurring task templates: admins define templates with title, description,
-- target role and recurrence. A SECURITY DEFINER RPC generates department_tasks
-- for each active user of that role, with idempotency per user+template+date.
-- Scheduled via pg_cron at 06:00 BRT (09:00 UTC) Mon-Fri.

BEGIN;

-- ==================== TABLE ====================

CREATE TABLE public.recurring_task_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  department  text NOT NULL,
  target_role public.user_role NOT NULL,
  recurrence  text NOT NULL CHECK (recurrence IN ('daily', 'weekly_monday', 'weekly_tuesday', 'weekly_wednesday', 'weekly_thursday', 'weekly_friday')),
  task_type   text NOT NULL DEFAULT 'daily' CHECK (task_type IN ('daily', 'weekly')),
  priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_task_templates ENABLE ROW LEVEL SECURITY;

-- ==================== RLS (admin-only CRUD via helpers) ====================

CREATE POLICY recurring_task_templates_select ON public.recurring_task_templates
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY recurring_task_templates_insert ON public.recurring_task_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY recurring_task_templates_update ON public.recurring_task_templates
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY recurring_task_templates_delete ON public.recurring_task_templates
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT ALL ON public.recurring_task_templates TO authenticated;

-- ==================== INDEXES ====================

CREATE INDEX idx_recurring_templates_active
  ON public.recurring_task_templates (is_active)
  WHERE is_active = true;

CREATE INDEX idx_recurring_templates_target_role
  ON public.recurring_task_templates (target_role)
  WHERE is_active = true;

-- ==================== TRIGGER (updated_at) ====================

CREATE TRIGGER update_recurring_task_templates_updated_at
  BEFORE UPDATE ON public.recurring_task_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== RPC: generate_recurring_tasks ====================
-- Generates department_tasks for today based on active templates.
-- Queries user_roles (not profiles) because profiles has no role/status column.
-- SECURITY DEFINER to bypass RLS on department_tasks INSERT (tasks are
-- created for other users, not the caller).

CREATE OR REPLACE FUNCTION public.generate_recurring_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dow integer := EXTRACT(DOW FROM v_today)::integer; -- 0=sunday
  v_dow_name text;
  v_template RECORD;
  v_user RECORD;
  v_count integer := 0;
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
      OR recurrence = v_dow_name
    )
  LOOP
    -- user_roles has the role; profiles has user_id.
    -- We join to ensure the user actually exists in profiles.
    FOR v_user IN
      SELECT ur.user_id
      FROM public.user_roles ur
      INNER JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role = v_template.target_role
    LOOP
      -- Idempotency: skip if task already exists for this user+template+date
      IF NOT EXISTS (
        SELECT 1 FROM public.department_tasks
        WHERE user_id = v_user.user_id
        AND department = v_template.department
        AND title = v_template.title
        AND created_at::date = v_today
      ) THEN
        INSERT INTO public.department_tasks (
          user_id, department, title, description, task_type, status, priority
        ) VALUES (
          v_user.user_id,
          v_template.department,
          v_template.title,
          v_template.description,
          v_template.task_type,
          'todo',
          v_template.priority
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

-- ==================== pg_cron (Mon-Fri 06:00 BRT = 09:00 UTC) ====================
-- NOTE: pg_cron runs as superuser, so auth.uid() will be NULL in the cron context.
-- The RPC checks auth.uid() for manual invocations.
-- For cron, we need a wrapper that sets a role or we call direct SQL.
-- Since pg_cron bypasses RLS with superuser, we insert directly.
-- However, the cleaner approach: call the function but skip auth check for cron.
-- We'll use a separate cron-specific function:

CREATE OR REPLACE FUNCTION public._cron_generate_recurring_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dow integer := EXTRACT(DOW FROM v_today)::integer;
  v_dow_name text;
  v_template RECORD;
  v_user RECORD;
  v_count integer := 0;
BEGIN
  -- No auth check: this is called by pg_cron (superuser context)

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
      OR recurrence = v_dow_name
    )
  LOOP
    FOR v_user IN
      SELECT ur.user_id
      FROM public.user_roles ur
      INNER JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role = v_template.target_role
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.department_tasks
        WHERE user_id = v_user.user_id
        AND department = v_template.department
        AND title = v_template.title
        AND created_at::date = v_today
      ) THEN
        INSERT INTO public.department_tasks (
          user_id, department, title, description, task_type, status, priority
        ) VALUES (
          v_user.user_id,
          v_template.department,
          v_template.title,
          v_template.description,
          v_template.task_type,
          'todo',
          v_template.priority
        );
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- _cron function is NOT granted to authenticated — only callable by superuser/pg_cron
REVOKE ALL ON FUNCTION public._cron_generate_recurring_tasks() FROM PUBLIC;

-- pg_cron schedule — run via Supabase Dashboard > SQL Editor if inline fails:
-- SELECT cron.schedule(
--   'generate-recurring-tasks',
--   '0 9 * * 1-5',
--   $$SELECT public._cron_generate_recurring_tasks()$$
-- );

COMMIT;
