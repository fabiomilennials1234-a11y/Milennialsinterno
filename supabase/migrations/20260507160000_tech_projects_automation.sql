-- 20260507160000_tech_projects_automation.sql
--
-- Phase 4: Automation & Tracking for CTO Project Management
--
-- 1. Add related_project_id FK on department_tasks (mirrors related_client_id)
-- 2. Trigger: tech_projects.current_step change → create task for lead + update tracking
-- 3. Trigger: tech_projects.status change → tracking entry/exit + completion notification
-- 4. pg_cron: _cron_check_project_delays() — Mon-Fri 09:00 UTC (06:00 BRT)
--
-- All functions SECURITY DEFINER to bypass RLS (called by triggers / pg_cron).

BEGIN;

-- ===========================================================================
-- 1. Add related_project_id to department_tasks
-- ===========================================================================

ALTER TABLE public.department_tasks
  ADD COLUMN IF NOT EXISTS related_project_id UUID
    REFERENCES public.tech_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_department_tasks_related_project
  ON public.department_tasks (related_project_id);

-- ===========================================================================
-- 2. Trigger: current_step changed → create task for lead
-- ===========================================================================
--
-- State machine steps (in order):
--   briefing → arquitetura → setup_ambiente → desenvolvimento
--   → code_review → testes → deploy → acompanhamento
--
-- Tracking range: desenvolvimento through acompanhamento (indices 3-7)

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
        task_type, status, priority, related_project_id
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
        NEW.id
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

DROP TRIGGER IF EXISTS trg_tech_project_step_changed ON public.tech_projects;

CREATE TRIGGER trg_tech_project_step_changed
  AFTER UPDATE ON public.tech_projects
  FOR EACH ROW
  WHEN (OLD.current_step IS DISTINCT FROM NEW.current_step)
  EXECUTE FUNCTION public._trg_tech_project_step_changed();

-- ===========================================================================
-- 3. Trigger: status changed → tracking entry/exit + completion
-- ===========================================================================

CREATE OR REPLACE FUNCTION public._trg_tech_project_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracking_steps text[] := ARRAY[
    'desenvolvimento', 'code_review', 'testes', 'deploy', 'acompanhamento'
  ];
  v_cto_id uuid;
  v_weekday text;
  v_dow int;
BEGIN
  -- Only fire when status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- ---------- Status → 'active' + step in tracking range ----------
  IF NEW.status = 'active'
     AND NEW.current_step = ANY(v_tracking_steps)
  THEN
    -- Weekday mapping: 1=segunda .. 5=sexta, weekend→sexta
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
    ON CONFLICT (project_id)
    DO UPDATE SET
      lead_id = EXCLUDED.lead_id,
      current_day = EXCLUDED.current_day,
      last_moved_at = now(),
      is_delayed = false;

  -- ---------- Status → 'completed' ----------
  ELSIF NEW.status = 'completed' THEN
    -- Remove from tracking
    DELETE FROM public.tech_project_tracking WHERE project_id = NEW.id;

    -- Notify CTO
    SELECT ur.user_id INTO v_cto_id
    FROM public.user_roles ur
    WHERE ur.role = 'cto'
    LIMIT 1;

    IF v_cto_id IS NOT NULL THEN
      INSERT INTO public.system_notifications (
        recipient_id, recipient_role, notification_type,
        title, message, priority
      ) VALUES (
        v_cto_id,
        'cto',
        'project_completed',
        'Projeto concluido: ' || NEW.name,
        'O projeto "' || NEW.name || '" completou todas as etapas e foi marcado como concluido.',
        'medium'
      );
    END IF;

  -- ---------- Status → 'paused' ----------
  ELSIF NEW.status = 'paused' THEN
    DELETE FROM public.tech_project_tracking WHERE project_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tech_project_status_changed ON public.tech_projects;

CREATE TRIGGER trg_tech_project_status_changed
  AFTER UPDATE ON public.tech_projects
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public._trg_tech_project_status_changed();

-- ===========================================================================
-- 4. Trigger: INSERT on tech_projects with status='active' + tracked step
--    (handles case where project is created directly as active)
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
          task_type, status, priority, related_project_id
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
          NEW.id
        );
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tech_project_inserted ON public.tech_projects;

CREATE TRIGGER trg_tech_project_inserted
  AFTER INSERT ON public.tech_projects
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_tech_project_inserted();

-- ===========================================================================
-- 5. pg_cron: _cron_check_project_delays()
-- ===========================================================================
--
-- Conditions:
--   A) last_moved_at > 2 days → task for Lead (high priority)
--   B) last_moved_at > 5 days → notification for CTO
--   C) deadline < 3 days away → task for Lead
--   D) deadline passed → notification CTO + task Lead (high priority)
--
-- All idempotent: NOT EXISTS guard by related_project_id + title prefix + active status

CREATE OR REPLACE FUNCTION public._cron_check_project_delays()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    RECORD;
  v_count  integer := 0;
  v_cto_id uuid;
  v_title  text;
BEGIN
  -- Get CTO user_id once
  SELECT ur.user_id INTO v_cto_id
  FROM public.user_roles ur
  WHERE ur.role = 'cto'
  LIMIT 1;

  FOR v_row IN
    SELECT
      t.project_id,
      t.lead_id,
      t.last_moved_at,
      t.is_delayed,
      p.name         AS project_name,
      p.deadline,
      p.current_step,
      p.priority     AS project_priority
    FROM public.tech_project_tracking t
    JOIN public.tech_projects p
      ON p.id = t.project_id
     AND p.status = 'active'
  LOOP

    -- ===== A) Stalled > 2 days → task for Lead =====
    IF v_row.last_moved_at < now() - interval '2 days' THEN
      v_title := 'Verificar andamento do projeto ' || v_row.project_name;

      IF NOT EXISTS (
        SELECT 1
        FROM public.department_tasks
        WHERE related_project_id = v_row.project_id
          AND title = v_title
          AND status IN ('todo', 'doing')
          AND archived = false
      ) THEN
        INSERT INTO public.department_tasks (
          user_id, department, title, description,
          task_type, status, priority, related_project_id
        ) VALUES (
          v_row.lead_id,
          'devs',
          v_title,
          'Projeto parado ha mais de 2 dias na etapa "' || v_row.current_step
            || '". Verifique o andamento e atualize o status.',
          'daily',
          'todo',
          'high',
          v_row.project_id
        );
        v_count := v_count + 1;
      END IF;

      -- Mark as delayed in tracking
      UPDATE public.tech_project_tracking
      SET is_delayed = true
      WHERE project_id = v_row.project_id
        AND is_delayed = false;
    END IF;

    -- ===== B) Stalled > 5 days → notification for CTO =====
    IF v_row.last_moved_at < now() - interval '5 days'
       AND v_cto_id IS NOT NULL
    THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.system_notifications
        WHERE recipient_id = v_cto_id
          AND notification_type = 'project_stalled'
          AND title = 'Projeto parado ha 5+ dias: ' || v_row.project_name
          AND read = false
          AND dismissed = false
      ) THEN
        INSERT INTO public.system_notifications (
          recipient_id, recipient_role, notification_type,
          title, message, priority
        ) VALUES (
          v_cto_id,
          'cto',
          'project_stalled',
          'Projeto parado ha 5+ dias: ' || v_row.project_name,
          'O projeto "' || v_row.project_name || '" esta parado na etapa "'
            || v_row.current_step || '" ha mais de 5 dias. Requer atencao.',
          'high'
        );
        v_count := v_count + 1;
      END IF;
    END IF;

    -- ===== C) Deadline < 3 days away → task for Lead =====
    IF v_row.deadline IS NOT NULL
       AND v_row.deadline > now()
       AND v_row.deadline < now() + interval '3 days'
    THEN
      v_title := 'Deadline se aproximando — ' || v_row.project_name;

      IF NOT EXISTS (
        SELECT 1
        FROM public.department_tasks
        WHERE related_project_id = v_row.project_id
          AND title = v_title
          AND status IN ('todo', 'doing')
          AND archived = false
      ) THEN
        INSERT INTO public.department_tasks (
          user_id, department, title, description,
          task_type, status, priority, related_project_id
        ) VALUES (
          v_row.lead_id,
          'devs',
          v_title,
          'O deadline do projeto "' || v_row.project_name || '" e em '
            || to_char(v_row.deadline, 'DD/MM/YYYY HH24:MI')
            || '. Priorize a conclusao.',
          'daily',
          'todo',
          'high',
          v_row.project_id
        );
        v_count := v_count + 1;
      END IF;
    END IF;

    -- ===== D) Deadline passed → notification CTO + task Lead =====
    IF v_row.deadline IS NOT NULL
       AND v_row.deadline < now()
    THEN
      -- Task for Lead
      v_title := 'Deadline estourado — ' || v_row.project_name;

      IF NOT EXISTS (
        SELECT 1
        FROM public.department_tasks
        WHERE related_project_id = v_row.project_id
          AND title = v_title
          AND status IN ('todo', 'doing')
          AND archived = false
      ) THEN
        INSERT INTO public.department_tasks (
          user_id, department, title, description,
          task_type, status, priority, related_project_id
        ) VALUES (
          v_row.lead_id,
          'devs',
          v_title,
          'O deadline do projeto "' || v_row.project_name || '" era '
            || to_char(v_row.deadline, 'DD/MM/YYYY HH24:MI')
            || ' e ja passou. Atualize o status imediatamente.',
          'daily',
          'todo',
          'high',
          v_row.project_id
        );
        v_count := v_count + 1;
      END IF;

      -- Notification for CTO
      IF v_cto_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.system_notifications
          WHERE recipient_id = v_cto_id
            AND notification_type = 'project_deadline_passed'
            AND title = 'Deadline estourado: ' || v_row.project_name
            AND read = false
            AND dismissed = false
        ) THEN
          INSERT INTO public.system_notifications (
            recipient_id, recipient_role, notification_type,
            title, message, priority
          ) VALUES (
            v_cto_id,
            'cto',
            'project_deadline_passed',
            'Deadline estourado: ' || v_row.project_name,
            'O projeto "' || v_row.project_name || '" ultrapassou o deadline ('
              || to_char(v_row.deadline, 'DD/MM/YYYY')
              || '). Etapa atual: ' || v_row.current_step || '.',
            'high'
          );
          v_count := v_count + 1;
        END IF;
      END IF;
    END IF;

  END LOOP;

  RETURN v_count;
END;
$$;

-- Not exposed to authenticated users — pg_cron only
REVOKE ALL ON FUNCTION public._cron_check_project_delays() FROM PUBLIC;

-- ===========================================================================
-- 6. Schedule pg_cron: Mon-Fri 09:00 UTC (06:00 BRT)
-- ===========================================================================

SELECT cron.unschedule('tech-project-delays')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'tech-project-delays'
);

SELECT cron.schedule(
  'tech-project-delays',
  '0 9 * * 1-5',
  $$SELECT public._cron_check_project_delays()$$
);

COMMIT;
