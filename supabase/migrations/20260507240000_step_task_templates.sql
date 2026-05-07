-- 20260507240000_step_task_templates.sql
--
-- Add 'step' as a third task_type for project_task_templates and department_tasks.
-- Step tasks are generated ONCE when a project enters a specific step (via trigger).
--
-- 1. ALTER CHECK constraints to allow 'step'
-- 2. Rewrite _trg_tech_project_step_changed() to generate step template tasks
-- 3. Rewrite _trg_tech_project_inserted() to generate step template tasks
-- 4. Rebuild index

BEGIN;

-- ===========================================================================
-- 1. ALTER CHECK constraints
-- ===========================================================================

ALTER TABLE public.project_task_templates
  DROP CONSTRAINT project_task_templates_task_type_check;
ALTER TABLE public.project_task_templates
  ADD CONSTRAINT project_task_templates_task_type_check
  CHECK (task_type IN ('daily', 'weekly', 'step'));

ALTER TABLE public.department_tasks
  DROP CONSTRAINT department_tasks_task_type_check;
ALTER TABLE public.department_tasks
  ADD CONSTRAINT department_tasks_task_type_check
  CHECK (task_type IN ('daily', 'weekly', 'step'));

-- ===========================================================================
-- 2. Rewrite _trg_tech_project_step_changed()
--    Keeps existing hardcoded task for lead.
--    Adds: loop over step templates to generate step tasks.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._trg_tech_project_step_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step_titles  jsonb;
  v_task_title   text;
  v_cto_id       uuid;
  v_tpl          RECORD;
  v_final_title  text;
  v_assignee     uuid;
BEGIN
  -- Only fire when current_step actually changed
  IF OLD.current_step IS NOT DISTINCT FROM NEW.current_step THEN
    RETURN NEW;
  END IF;

  -- Only fire for active projects
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Resolve CTO for fallback assignment
  SELECT user_id INTO v_cto_id
  FROM user_roles
  WHERE role = 'cto'
  LIMIT 1;

  -- ── Existing: hardcoded task for lead ──

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

  -- ── New: generate tasks from step templates ──

  v_assignee := COALESCE(NEW.lead_id, v_cto_id);

  IF v_assignee IS NOT NULL THEN
    FOR v_tpl IN
      SELECT id, title
      FROM project_task_templates
      WHERE task_type = 'step'
        AND step = NEW.current_step
        AND is_active = true
    LOOP
      v_final_title := replace(v_tpl.title, '{projeto}', NEW.name);

      IF NOT EXISTS (
        SELECT 1 FROM department_tasks
        WHERE related_project_id = NEW.id
          AND title = v_final_title
          AND task_type = 'step'
          AND project_step = NEW.current_step
          AND status IN ('todo', 'doing')
          AND archived = false
      ) THEN
        INSERT INTO department_tasks (
          user_id, department, title, description,
          task_type, status, priority,
          related_project_id, project_step, is_blocking
        ) VALUES (
          v_assignee,
          'devs',
          v_final_title,
          'Tarefa de etapa (template) do projeto "' || NEW.name || '" — etapa: ' || NEW.current_step,
          'step',
          'todo',
          CASE
            WHEN NEW.priority IN ('critical', 'high') THEN 'high'
            ELSE 'normal'
          END,
          NEW.id,
          NEW.current_step,
          true
        );
      END IF;
    END LOOP;
  END IF;

  -- Update tracking.last_moved_at if project is being tracked
  UPDATE public.tech_project_tracking
  SET last_moved_at = now(),
      is_delayed = false
  WHERE project_id = NEW.id;

  RETURN NEW;
END;
$$;

-- ===========================================================================
-- 3. Rewrite _trg_tech_project_inserted()
--    Keeps existing hardcoded task + tracking logic.
--    Adds: loop over step templates when inserted as active.
-- ===========================================================================

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
  v_cto_id uuid;
  v_tpl RECORD;
  v_final_title text;
  v_assignee uuid;
BEGIN
  -- Resolve CTO for fallback assignment
  SELECT user_id INTO v_cto_id
  FROM user_roles
  WHERE role = 'cto'
  LIMIT 1;

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

  -- If inserted as active, create first step task (hardcoded)
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

  -- ── New: generate tasks from step templates (only for active projects) ──

  IF NEW.status = 'active' THEN
    v_assignee := COALESCE(NEW.lead_id, v_cto_id);

    IF v_assignee IS NOT NULL THEN
      FOR v_tpl IN
        SELECT id, title
        FROM project_task_templates
        WHERE task_type = 'step'
          AND step = NEW.current_step
          AND is_active = true
      LOOP
        v_final_title := replace(v_tpl.title, '{projeto}', NEW.name);

        IF NOT EXISTS (
          SELECT 1 FROM department_tasks
          WHERE related_project_id = NEW.id
            AND title = v_final_title
            AND task_type = 'step'
            AND project_step = NEW.current_step
            AND status IN ('todo', 'doing')
            AND archived = false
        ) THEN
          INSERT INTO department_tasks (
            user_id, department, title, description,
            task_type, status, priority,
            related_project_id, project_step, is_blocking
          ) VALUES (
            v_assignee,
            'devs',
            v_final_title,
            'Tarefa de etapa (template) do projeto "' || NEW.name || '" — etapa: ' || NEW.current_step,
            'step',
            'todo',
            CASE
              WHEN NEW.priority IN ('critical', 'high') THEN 'high'
              ELSE 'normal'
            END,
            NEW.id,
            NEW.current_step,
            true
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ===========================================================================
-- 4. Rebuild index (covers all three task_type values)
-- ===========================================================================

DROP INDEX IF EXISTS idx_task_templates_active_type;
CREATE INDEX idx_task_templates_active_type
  ON public.project_task_templates (task_type)
  WHERE is_active = true;

COMMIT;
