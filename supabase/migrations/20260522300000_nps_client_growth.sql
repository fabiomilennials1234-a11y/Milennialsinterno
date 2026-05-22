-- NPS Client Growth: schema + RLS + recurring task
-- Adds 'client_growth' survey type for client-facing Growth surveys
-- with dedicated response table and monthly recurring task.

-- 1. Expand nps_surveys survey_type CHECK to include 'client_growth'
ALTER TABLE public.nps_surveys
  DROP CONSTRAINT IF EXISTS nps_surveys_survey_type_check;

ALTER TABLE public.nps_surveys
  ADD CONSTRAINT nps_surveys_survey_type_check
  CHECK (survey_type IN ('client', 'team', 'client_growth'));

-- 2. Create nps_client_growth_responses table
CREATE TABLE IF NOT EXISTS public.nps_client_growth_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.nps_surveys(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  results_evolution TEXT NOT NULL CHECK (results_evolution IN (
    'muito_abaixo', 'abaixo', 'dentro', 'acima', 'muito_acima'
  )),
  biggest_challenges TEXT[] NOT NULL DEFAULT '{}',
  challenges_other TEXT,
  alignment_assessment TEXT NOT NULL CHECK (alignment_assessment IN (
    'totalmente', 'parcialmente', 'pouco', 'nao'
  )),
  strengthen_areas TEXT[] NOT NULL DEFAULT '{}',
  strengthen_other TEXT,
  improvement_suggestions TEXT NOT NULL,
  next_months_goal TEXT NOT NULL,
  nps_score SMALLINT NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.nps_client_growth_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit client growth responses"
  ON public.nps_client_growth_responses
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin and CS can view client growth responses"
  ON public.nps_client_growth_responses
  FOR SELECT
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'));

-- 4. Expand recurring_task_templates recurrence CHECK to include 'monthly'
ALTER TABLE public.recurring_task_templates
  DROP CONSTRAINT IF EXISTS recurring_task_templates_recurrence_check;

ALTER TABLE public.recurring_task_templates
  ADD CONSTRAINT recurring_task_templates_recurrence_check
  CHECK (recurrence = ANY (ARRAY[
    'every_1h', 'every_6h', 'daily',
    'weekly_monday', 'weekly_tuesday', 'weekly_wednesday',
    'weekly_thursday', 'weekly_friday',
    'biweekly', 'monthly'
  ]));

-- 5. Update generate_recurring_tasks (auth-gated) to handle 'monthly'
CREATE OR REPLACE FUNCTION public.generate_recurring_tasks()
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
  v_day      integer     := EXTRACT(DAY FROM v_today)::integer;
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
      OR (recurrence = 'monthly' AND v_day = 1)
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

      ELSIF v_template.recurrence = 'monthly' THEN
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE recurring_template_id = v_template.id
            AND user_id = v_user.user_id
            AND created_at >= date_trunc('month', v_now)
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
            WHEN v_template.recurrence = 'monthly' THEN 'weekly'
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

-- 6. Update _cron_generate_recurring_tasks (no-auth cron) with same monthly logic
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
  v_day      integer     := EXTRACT(DAY FROM v_today)::integer;
  v_dow_name text;
  v_template RECORD;
  v_user     RECORD;
  v_count    integer := 0;
  v_should_generate boolean;
BEGIN
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
      OR (recurrence = 'monthly' AND v_day = 1)
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

      ELSIF v_template.recurrence = 'monthly' THEN
        v_should_generate := NOT EXISTS (
          SELECT 1 FROM public.department_tasks
          WHERE recurring_template_id = v_template.id
            AND user_id = v_user.user_id
            AND created_at >= date_trunc('month', v_now)
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
            WHEN v_template.recurrence = 'monthly' THEN 'weekly'
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

-- 7. Insert monthly recurring task template for Growth NPS
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
  'Enviar Pesquisa Growth para os clientes',
  'Tarefa mensal: enviar a Pesquisa de Evolução e Experiência (NPS Growth) para todos os clientes ativos.',
  'sucesso_cliente',
  'sucesso_cliente',
  'monthly',
  'weekly',
  'high',
  true,
  'fad37da1-ff00-449f-8180-bd56b1279763'
);
