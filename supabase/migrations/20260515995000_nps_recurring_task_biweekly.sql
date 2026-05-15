-- Feature 9: Add biweekly recurrence support + NPS recurring task template
-- Biweekly = every 2 weeks. We use ISO week number: generates on Monday of even weeks.

-- 0. Expand check constraint to allow 'biweekly'
ALTER TABLE public.recurring_task_templates
  DROP CONSTRAINT IF EXISTS recurring_task_templates_recurrence_check;

ALTER TABLE public.recurring_task_templates
  ADD CONSTRAINT recurring_task_templates_recurrence_check
  CHECK (recurrence = ANY (ARRAY[
    'every_1h', 'every_6h', 'daily',
    'weekly_monday', 'weekly_tuesday', 'weekly_wednesday',
    'weekly_thursday', 'weekly_friday',
    'biweekly'
  ]));

-- 1. Update generate_recurring_tasks (auth-gated version) to handle 'biweekly'
CREATE OR REPLACE FUNCTION public.generate_recurring_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now      timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_today    date        := v_now::date;
  v_dow      integer     := EXTRACT(DOW FROM v_today)::integer; -- 0=sunday
  v_hour     integer     := EXTRACT(HOUR FROM v_now)::integer;
  v_week     integer     := EXTRACT(WEEK FROM v_today)::integer;
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
      OR (recurrence = 'biweekly' AND v_dow = 1 AND (v_week % 2) = 0)
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

      ELSIF v_template.recurrence = 'biweekly' THEN
        -- Dedup: no task from this template+user in current week
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE recurring_template_id = v_template.id
            AND user_id = v_user.user_id
            AND created_at >= date_trunc('week', v_now)
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
          CASE
            WHEN v_template.recurrence LIKE 'weekly_%' THEN 'weekly'
            WHEN v_template.recurrence = 'biweekly' THEN 'weekly'
            ELSE 'daily'
          END,
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


-- 2. Update _cron_generate_recurring_tasks (no-auth cron version) with same biweekly logic
CREATE OR REPLACE FUNCTION public._cron_generate_recurring_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now      timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_today    date        := v_now::date;
  v_dow      integer     := EXTRACT(DOW FROM v_today)::integer;
  v_hour     integer     := EXTRACT(HOUR FROM v_now)::integer;
  v_week     integer     := EXTRACT(WEEK FROM v_today)::integer;
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
      OR (recurrence = 'biweekly' AND v_dow = 1 AND (v_week % 2) = 0)
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

      ELSIF v_template.recurrence = 'biweekly' THEN
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE recurring_template_id = v_template.id
            AND user_id = v_user.user_id
            AND created_at >= date_trunc('week', v_now)
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
          CASE
            WHEN v_template.recurrence LIKE 'weekly_%' THEN 'weekly'
            WHEN v_template.recurrence = 'biweekly' THEN 'weekly'
            ELSE 'daily'
          END,
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


-- 3. Insert NPS recurring task template
INSERT INTO public.recurring_task_templates (
  title,
  description,
  department,
  target_role,
  recurrence,
  task_type,
  priority,
  is_active,
  created_by
) VALUES (
  'Cobrar o Time de Preencher o forms de NPS TIME + Baú de ideias',
  'Tarefa quinzenal: garantir que todo o time preencheu o formulário de NPS interno e o Baú de Ideias.',
  'sucesso_cliente',
  'sucesso_cliente',
  'biweekly',
  'weekly',
  'high',
  true,
  'fad37da1-ff00-449f-8180-bd56b1279763'
);
