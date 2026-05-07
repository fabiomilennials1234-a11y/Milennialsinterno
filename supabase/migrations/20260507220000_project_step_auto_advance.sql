-- 20260507220000_project_step_auto_advance.sql
--
-- Auto-advance project step when all tasks for the current step are done.
--
-- 1. Add project_step column to department_tasks
-- 2. Backfill existing tasks
-- 3. Trigger: auto-fill project_step on INSERT
-- 4. Trigger: auto-advance project step on task completion
-- 5. Update cron functions to populate project_step
-- 6. Update existing triggers to populate project_step

BEGIN;

-- ===========================================================================
-- 1. Add project_step column
-- ===========================================================================

ALTER TABLE public.department_tasks
  ADD COLUMN IF NOT EXISTS project_step TEXT;

CREATE INDEX IF NOT EXISTS idx_department_tasks_project_step
  ON public.department_tasks (related_project_id, project_step)
  WHERE related_project_id IS NOT NULL;

-- ===========================================================================
-- 2. Backfill existing tasks using project's current_step
-- ===========================================================================

UPDATE department_tasks dt
SET project_step = tp.current_step
FROM tech_projects tp
WHERE dt.related_project_id = tp.id
  AND dt.project_step IS NULL;

-- ===========================================================================
-- 3. Trigger: auto-fill project_step on INSERT
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._trg_department_task_fill_project_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.related_project_id IS NOT NULL AND NEW.project_step IS NULL THEN
    SELECT current_step INTO NEW.project_step
    FROM tech_projects
    WHERE id = NEW.related_project_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_department_task_fill_project_step ON public.department_tasks;

CREATE TRIGGER trg_department_task_fill_project_step
  BEFORE INSERT ON public.department_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_department_task_fill_project_step();

-- ===========================================================================
-- 4. Trigger: auto-advance project step when all tasks complete
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._trg_department_task_auto_advance_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_pending_count INT;
  v_steps TEXT[] := ARRAY[
    'briefing', 'arquitetura', 'setup_ambiente', 'desenvolvimento',
    'code_review', 'testes', 'deploy', 'acompanhamento'
  ];
  v_current_idx INT;
  v_next_step TEXT;
BEGIN
  -- Only fire when status changed TO 'done'
  IF NEW.status <> 'done' OR OLD.status = 'done' THEN
    RETURN NEW;
  END IF;

  -- Only for project-linked tasks
  IF NEW.related_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get project info
  SELECT id, current_step, status INTO v_project
  FROM tech_projects
  WHERE id = NEW.related_project_id;

  IF v_project IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only advance active/planning projects
  IF v_project.status NOT IN ('active', 'planning') THEN
    RETURN NEW;
  END IF;

  -- Only consider if task belongs to current step
  IF NEW.project_step IS NULL OR NEW.project_step <> v_project.current_step THEN
    RETURN NEW;
  END IF;

  -- Count remaining non-done, non-archived tasks for this project + step
  SELECT count(*) INTO v_pending_count
  FROM department_tasks
  WHERE related_project_id = NEW.related_project_id
    AND project_step = v_project.current_step
    AND id <> NEW.id
    AND status IN ('todo', 'doing')
    AND archived = false;

  -- If still pending tasks, don't advance
  IF v_pending_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Find next step
  SELECT array_position(v_steps, v_project.current_step) INTO v_current_idx;
  IF v_current_idx IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_current_idx >= array_length(v_steps, 1) THEN
    -- Last step completed -> mark project as completed
    UPDATE tech_projects
    SET status = 'completed'
    WHERE id = NEW.related_project_id;
  ELSE
    -- Advance to next step
    v_next_step := v_steps[v_current_idx + 1];
    UPDATE tech_projects
    SET current_step = v_next_step
    WHERE id = NEW.related_project_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_department_task_auto_advance_project ON public.department_tasks;

CREATE TRIGGER trg_department_task_auto_advance_project
  AFTER UPDATE ON public.department_tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'done')
  EXECUTE FUNCTION public._trg_department_task_auto_advance_project();

-- ===========================================================================
-- 5. Update cron functions to populate project_step
-- ===========================================================================

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
    -- Case 1: step-bound, project-scoped
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
            user_id, title, task_type, status, priority, department,
            related_project_id, project_step
          ) VALUES (
            v_cto_id, v_final_title, 'daily', 'todo', 'normal', 'devs',
            v_project.id, v_tpl.step
          );
          v_created := v_created + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END LOOP;

    -- Case 2: step-bound, global
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

    -- Case 3: no step
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
    -- Case 1: step-bound, project-scoped
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
            user_id, title, task_type, status, priority, department,
            related_project_id, project_step
          ) VALUES (
            v_cto_id, v_final_title, 'weekly', 'todo', 'normal', 'devs',
            v_project.id, v_tpl.step
          );
          v_created := v_created + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      END LOOP;

    -- Case 2: step-bound, global
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

    -- Case 3: no step
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

-- ===========================================================================
-- 6. Update existing triggers to populate project_step
-- ===========================================================================

-- 6a. _trg_tech_project_step_changed: add project_step in INSERT
CREATE OR REPLACE FUNCTION public._trg_tech_project_step_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step_titles  jsonb;
  v_task_title   text;
  v_steps        text[] := ARRAY[
    'briefing', 'arquitetura', 'setup_ambiente', 'desenvolvimento',
    'code_review', 'testes', 'deploy', 'acompanhamento'
  ];
  v_step_idx     int;
BEGIN
  -- Only fire when current_step actually changed
  IF OLD.current_step IS NOT DISTINCT FROM NEW.current_step THEN
    RETURN NEW;
  END IF;

  -- Only fire for active projects
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Task title templates keyed by step
  v_step_titles := jsonb_build_object(
    'briefing',       'Levantar requisitos e documentar briefing — ',
    'arquitetura',    'Definir arquitetura e stack — ',
    'setup_ambiente', 'Configurar repositorio e ambiente — ',
    'desenvolvimento','Iniciar desenvolvimento — ',
    'code_review',    'Revisar codigo e aprovar PRs — ',
    'testes',         'Executar QA e validar entrega — ',
    'deploy',         'Realizar deploy e verificar producao — ',
    'acompanhamento', 'Acompanhar pos-entrega (7 dias) — '
  );

  v_task_title := trim(both '"' from (v_step_titles ->> NEW.current_step)) || NEW.name;

  -- Create task for lead (idempotent: skip if active task exists for this project+step)
  IF NEW.lead_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.department_tasks
      WHERE related_project_id = NEW.id
        AND title = v_task_title
        AND status IN ('todo', 'doing')
        AND archived = false
    ) THEN
      INSERT INTO public.department_tasks (
        user_id, department, title, description,
        task_type, status, priority, related_project_id, project_step
      ) VALUES (
        NEW.lead_id,
        'devs',
        v_task_title,
        'Tarefa automatica do projeto "' || NEW.name || '" — etapa: ' || NEW.current_step,
        'daily',
        'todo',
        CASE
          WHEN NEW.priority IN ('critical', 'high') THEN 'high'
          ELSE 'normal'
        END,
        NEW.id,
        NEW.current_step
      );
    END IF;
  END IF;

  -- Update tracking.last_moved_at if project is being tracked
  UPDATE public.tech_project_tracking
  SET last_moved_at = now(),
      is_delayed = false
  WHERE project_id = NEW.id;

  RETURN NEW;
END;
$$;

-- 6b. _trg_tech_project_inserted: add project_step in INSERT
CREATE OR REPLACE FUNCTION public._trg_tech_project_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracking_steps text[] := ARRAY[
    'desenvolvimento', 'code_review', 'testes', 'deploy', 'acompanhamento'
  ];
  v_weekday text;
  v_dow int;
BEGIN
  -- If inserted as active + tracked step, enter tracking
  IF NEW.status = 'active' AND NEW.current_step = ANY(v_tracking_steps) THEN
    v_dow := EXTRACT(DOW FROM now())::int;
    v_weekday := CASE v_dow
      WHEN 1 THEN 'segunda'
      WHEN 2 THEN 'terca'
      WHEN 3 THEN 'quarta'
      WHEN 4 THEN 'quinta'
      WHEN 5 THEN 'sexta'
      ELSE 'sexta'
    END;

    INSERT INTO public.tech_project_tracking (
      project_id, lead_id, current_day, last_moved_at, is_delayed
    ) VALUES (
      NEW.id,
      COALESCE(NEW.lead_id, NEW.created_by),
      v_weekday,
      now(),
      false
    )
    ON CONFLICT (project_id) DO NOTHING;
  END IF;

  -- If inserted as active, create first step task
  IF NEW.status = 'active' AND NEW.lead_id IS NOT NULL THEN
    DECLARE
      v_step_titles jsonb;
      v_task_title  text;
    BEGIN
      v_step_titles := jsonb_build_object(
        'briefing',       'Levantar requisitos e documentar briefing — ',
        'arquitetura',    'Definir arquitetura e stack — ',
        'setup_ambiente', 'Configurar repositorio e ambiente — ',
        'desenvolvimento','Iniciar desenvolvimento — ',
        'code_review',    'Revisar codigo e aprovar PRs — ',
        'testes',         'Executar QA e validar entrega — ',
        'deploy',         'Realizar deploy e verificar producao — ',
        'acompanhamento', 'Acompanhar pos-entrega (7 dias) — '
      );

      v_task_title := trim(both '"' from (v_step_titles ->> NEW.current_step)) || NEW.name;

      IF NOT EXISTS (
        SELECT 1
        FROM public.department_tasks
        WHERE related_project_id = NEW.id
          AND title = v_task_title
          AND status IN ('todo', 'doing')
          AND archived = false
      ) THEN
        INSERT INTO public.department_tasks (
          user_id, department, title, description,
          task_type, status, priority, related_project_id, project_step
        ) VALUES (
          NEW.lead_id,
          'devs',
          v_task_title,
          'Tarefa automatica do projeto "' || NEW.name || '" — etapa: ' || NEW.current_step,
          'daily',
          'todo',
          CASE
            WHEN NEW.priority IN ('critical', 'high') THEN 'high'
            ELSE 'normal'
          END,
          NEW.id,
          NEW.current_step
        );
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
