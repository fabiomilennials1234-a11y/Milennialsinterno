-- 20260507200000_project_task_templates.sql
--
-- Replaces hardcoded CASE/WHEN in cron functions with a configurable
-- project_task_templates table. CEO/CTO can CRUD templates via UI;
-- pg_cron reads from this table instead of literals.
-- ============================================================

-- ============================================================
-- 1. Table: project_task_templates
-- ============================================================

CREATE TABLE public.project_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  step TEXT DEFAULT NULL,
  task_type TEXT NOT NULL DEFAULT 'daily' CHECK (task_type IN ('daily', 'weekly')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_project_scoped BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER project_task_templates_moddatetime
  BEFORE UPDATE ON public.project_task_templates
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE public.project_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_task_templates_select" ON public.project_task_templates
  FOR SELECT USING (is_ceo(auth.uid()));

CREATE POLICY "project_task_templates_insert" ON public.project_task_templates
  FOR INSERT WITH CHECK (is_ceo(auth.uid()));

CREATE POLICY "project_task_templates_update" ON public.project_task_templates
  FOR UPDATE USING (is_ceo(auth.uid()));

CREATE POLICY "project_task_templates_delete" ON public.project_task_templates
  FOR DELETE USING (is_ceo(auth.uid()));

-- Index: cron queries filter by is_active + task_type
CREATE INDEX idx_task_templates_active_type
  ON public.project_task_templates (task_type)
  WHERE is_active = true;

-- ============================================================
-- 2. Seed: current hardcoded templates
-- ============================================================

-- Daily templates (is_project_scoped = true) — one task per project in that step
INSERT INTO public.project_task_templates (title, step, task_type, is_project_scoped) VALUES
  ('Cobrar briefing tecnico — {projeto}',                  'briefing',        'daily', true),
  ('Acompanhar definicao de arquitetura — {projeto}',      'arquitetura',     'daily', true),
  ('Verificar setup de ambiente — {projeto}',              'setup_ambiente',  'daily', true),
  ('Verificar progresso de desenvolvimento — {projeto}',   'desenvolvimento', 'daily', true),
  ('Revisar PRs e codigo — {projeto}',                     'code_review',     'daily', true),
  ('Acompanhar testes e QA — {projeto}',                   'testes',          'daily', true),
  ('Verificar deploy e producao — {projeto}',              'deploy',          'daily', true),
  ('Verificar estabilidade pos-entrega — {projeto}',       'acompanhamento',  'daily', true);

-- Weekly templates (is_project_scoped = false) — one global task if any project in step
INSERT INTO public.project_task_templates (title, step, task_type, is_project_scoped) VALUES
  ('Revisar briefings pendentes',                 'briefing',        'weekly', false),
  ('Revisar arquiteturas em andamento',           'arquitetura',     'weekly', false),
  ('Revisao geral de projetos em dev',            'desenvolvimento', 'weekly', false),
  ('Review geral de PRs pendentes',               'code_review',     'weekly', false),
  ('Revisao de qualidade geral',                  'testes',          'weekly', false),
  ('Revisao de projetos em acompanhamento',       'acompanhamento',  'weekly', false);

-- ============================================================
-- 3. Rewrite: _cron_generate_project_daily_tasks()
--    Now reads from project_task_templates instead of CASE/WHEN.
-- ============================================================

CREATE OR REPLACE FUNCTION public._cron_generate_project_daily_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cto_id UUID;
  v_tpl RECORD;
  v_project RECORD;
  v_final_title TEXT;
  v_created INT := 0;
  v_skipped INT := 0;
BEGIN
  -- Resolve CTO user_id
  SELECT user_id INTO v_cto_id
  FROM user_roles
  WHERE role = 'cto'
  LIMIT 1;

  IF v_cto_id IS NULL THEN
    RAISE LOG '[ProjectDailyTasks] No CTO found — aborting';
    RETURN;
  END IF;

  FOR v_tpl IN
    SELECT id, title, step, is_project_scoped
    FROM project_task_templates
    WHERE is_active = true
      AND task_type = 'daily'
  LOOP
    -- ── Case 1: step-bound, project-scoped → one task per project in that step
    IF v_tpl.step IS NOT NULL AND v_tpl.is_project_scoped THEN
      FOR v_project IN
        SELECT id, name
        FROM tech_projects
        WHERE status IN ('planning', 'active')
          AND current_step = v_tpl.step
      LOOP
        v_final_title := replace(v_tpl.title, '{projeto}', v_project.name);

        IF NOT EXISTS (
          SELECT 1 FROM department_tasks
          WHERE related_project_id = v_project.id
            AND title = v_final_title
            AND task_type = 'daily'
            AND status IN ('todo', 'doing')
            AND archived = false
        ) THEN
          INSERT INTO department_tasks (
            user_id, title, task_type, status, priority, department, related_project_id
          ) VALUES (
            v_cto_id, v_final_title, 'daily', 'todo', 'normal', 'devs', v_project.id
          );
          v_created := v_created + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END LOOP;

    -- ── Case 2: step-bound, global → one task if any project in that step
    ELSIF v_tpl.step IS NOT NULL AND NOT v_tpl.is_project_scoped THEN
      IF EXISTS (
        SELECT 1 FROM tech_projects
        WHERE status IN ('planning', 'active')
          AND current_step = v_tpl.step
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM department_tasks
          WHERE title = v_tpl.title
            AND task_type = 'daily'
            AND department = 'devs'
            AND status IN ('todo', 'doing')
            AND archived = false
        ) THEN
          INSERT INTO department_tasks (
            user_id, title, task_type, status, priority, department
          ) VALUES (
            v_cto_id, v_tpl.title, 'daily', 'todo', 'normal', 'devs'
          );
          v_created := v_created + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END IF;

    -- ── Case 3: no step → generic task (always)
    ELSIF v_tpl.step IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM department_tasks
        WHERE title = v_tpl.title
          AND task_type = 'daily'
          AND department = 'devs'
          AND status IN ('todo', 'doing')
          AND archived = false
      ) THEN
        INSERT INTO department_tasks (
          user_id, title, task_type, status, priority, department
        ) VALUES (
          v_cto_id, v_tpl.title, 'daily', 'todo', 'normal', 'devs'
        );
        v_created := v_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE LOG '[ProjectDailyTasks] Done: % created, % skipped', v_created, v_skipped;
END;
$$;

-- ============================================================
-- 4. Rewrite: _cron_generate_project_weekly_tasks()
-- ============================================================

CREATE OR REPLACE FUNCTION public._cron_generate_project_weekly_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cto_id UUID;
  v_monday DATE;
  v_tpl RECORD;
  v_project RECORD;
  v_final_title TEXT;
  v_created INT := 0;
  v_skipped INT := 0;
BEGIN
  -- Resolve CTO user_id
  SELECT user_id INTO v_cto_id
  FROM user_roles
  WHERE role = 'cto'
  LIMIT 1;

  IF v_cto_id IS NULL THEN
    RAISE LOG '[ProjectWeeklyTasks] No CTO found — aborting';
    RETURN;
  END IF;

  -- Monday of current week (for idempotency)
  v_monday := date_trunc('week', CURRENT_DATE)::date;

  FOR v_tpl IN
    SELECT id, title, step, is_project_scoped
    FROM project_task_templates
    WHERE is_active = true
      AND task_type = 'weekly'
  LOOP
    -- ── Case 1: step-bound, project-scoped → one task per project in that step
    IF v_tpl.step IS NOT NULL AND v_tpl.is_project_scoped THEN
      FOR v_project IN
        SELECT id, name
        FROM tech_projects
        WHERE status IN ('planning', 'active')
          AND current_step = v_tpl.step
      LOOP
        v_final_title := replace(v_tpl.title, '{projeto}', v_project.name);

        IF NOT EXISTS (
          SELECT 1 FROM department_tasks
          WHERE title = v_final_title
            AND task_type = 'weekly'
            AND department = 'devs'
            AND archived = false
            AND status IN ('todo', 'doing')
            AND created_at >= v_monday::timestamptz
            AND created_at < (v_monday + INTERVAL '7 days')::timestamptz
        ) THEN
          INSERT INTO department_tasks (
            user_id, title, task_type, status, priority, department, related_project_id
          ) VALUES (
            v_cto_id, v_final_title, 'weekly', 'todo', 'normal', 'devs', v_project.id
          );
          v_created := v_created + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END LOOP;

    -- ── Case 2: step-bound, global → one task if any project in that step
    ELSIF v_tpl.step IS NOT NULL AND NOT v_tpl.is_project_scoped THEN
      IF EXISTS (
        SELECT 1 FROM tech_projects
        WHERE status IN ('planning', 'active')
          AND current_step = v_tpl.step
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM department_tasks
          WHERE title = v_tpl.title
            AND task_type = 'weekly'
            AND department = 'devs'
            AND archived = false
            AND status IN ('todo', 'doing')
            AND created_at >= v_monday::timestamptz
            AND created_at < (v_monday + INTERVAL '7 days')::timestamptz
        ) THEN
          INSERT INTO department_tasks (
            user_id, title, task_type, status, priority, department
          ) VALUES (
            v_cto_id, v_tpl.title, 'weekly', 'todo', 'normal', 'devs'
          );
          v_created := v_created + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END IF;

    -- ── Case 3: no step → generic weekly task
    ELSIF v_tpl.step IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM department_tasks
        WHERE title = v_tpl.title
          AND task_type = 'weekly'
          AND department = 'devs'
          AND archived = false
          AND status IN ('todo', 'doing')
          AND created_at >= v_monday::timestamptz
          AND created_at < (v_monday + INTERVAL '7 days')::timestamptz
      ) THEN
        INSERT INTO department_tasks (
          user_id, title, task_type, status, priority, department
        ) VALUES (
          v_cto_id, v_tpl.title, 'weekly', 'todo', 'normal', 'devs'
        );
        v_created := v_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE LOG '[ProjectWeeklyTasks] Done: % created, % skipped', v_created, v_skipped;
END;
$$;
