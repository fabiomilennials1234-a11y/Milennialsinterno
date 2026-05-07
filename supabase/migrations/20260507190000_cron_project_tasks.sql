-- ============================================================
-- pg_cron: Auto-generate daily & weekly CTO project tasks
-- Daily: Mon-Fri 09:00 UTC (06:00 BRT) — one per active project
-- Weekly: Mon 09:00 UTC — global review tasks per active step
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 1. Daily tasks — one per active project based on current_step
-- ============================================================

CREATE OR REPLACE FUNCTION public._cron_generate_project_daily_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cto_id UUID;
  v_project RECORD;
  v_title TEXT;
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

  FOR v_project IN
    SELECT id, name, current_step
    FROM tech_projects
    WHERE status IN ('planning', 'active')
  LOOP
    -- Build title based on current_step
    v_title := CASE v_project.current_step
      WHEN 'briefing'       THEN 'Cobrar briefing tecnico — ' || v_project.name
      WHEN 'arquitetura'    THEN 'Acompanhar definicao de arquitetura — ' || v_project.name
      WHEN 'setup_ambiente' THEN 'Verificar setup de ambiente — ' || v_project.name
      WHEN 'desenvolvimento' THEN 'Verificar progresso de desenvolvimento — ' || v_project.name
      WHEN 'code_review'    THEN 'Revisar PRs e codigo — ' || v_project.name
      WHEN 'testes'         THEN 'Acompanhar testes e QA — ' || v_project.name
      WHEN 'deploy'         THEN 'Verificar deploy e producao — ' || v_project.name
      WHEN 'acompanhamento' THEN 'Verificar estabilidade pos-entrega — ' || v_project.name
      ELSE NULL
    END;

    IF v_title IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Idempotency: skip if an active (todo/doing) task with same title+project+type exists
    IF NOT EXISTS (
      SELECT 1 FROM department_tasks
      WHERE related_project_id = v_project.id
        AND title = v_title
        AND task_type = 'daily'
        AND status IN ('todo', 'doing')
        AND archived = false
    ) THEN
      INSERT INTO department_tasks (
        user_id, title, task_type, status, priority, department, related_project_id
      ) VALUES (
        v_cto_id, v_title, 'daily', 'todo', 'normal', 'devs', v_project.id
      );
      v_created := v_created + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RAISE LOG '[ProjectDailyTasks] Done: % created, % skipped', v_created, v_skipped;
END;
$$;

-- ============================================================
-- 2. Weekly tasks — global review tasks per active step
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
  v_step TEXT;
  v_title TEXT;
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

  -- Only generate for steps that have at least one active project
  -- Setup and Deploy do NOT generate weekly tasks
  FOR v_step IN
    SELECT DISTINCT current_step
    FROM tech_projects
    WHERE status IN ('planning', 'active')
      AND current_step NOT IN ('setup_ambiente', 'deploy')
  LOOP
    v_title := CASE v_step
      WHEN 'briefing'        THEN 'Revisar briefings pendentes'
      WHEN 'arquitetura'     THEN 'Revisar arquiteturas em andamento'
      WHEN 'desenvolvimento' THEN 'Revisao geral de projetos em dev'
      WHEN 'code_review'     THEN 'Review geral de PRs pendentes'
      WHEN 'testes'          THEN 'Revisao de qualidade geral'
      WHEN 'acompanhamento'  THEN 'Revisao de projetos em acompanhamento'
      ELSE NULL
    END;

    IF v_title IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Idempotency: same title + weekly + same calendar week
    IF NOT EXISTS (
      SELECT 1 FROM department_tasks
      WHERE title = v_title
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
        v_cto_id, v_title, 'weekly', 'todo', 'normal', 'devs'
      );
      v_created := v_created + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RAISE LOG '[ProjectWeeklyTasks] Done: % created, % skipped', v_created, v_skipped;
END;
$$;

-- ============================================================
-- 3. Schedule cron jobs (idempotent)
-- ============================================================

-- Daily: Mon-Fri 09:00 UTC (06:00 BRT)
SELECT cron.unschedule('project-daily-cto-tasks')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'project-daily-cto-tasks');

SELECT cron.schedule(
  'project-daily-cto-tasks',
  '0 9 * * 1-5',
  $$SELECT public._cron_generate_project_daily_tasks()$$
);

-- Weekly: Monday 09:00 UTC (06:00 BRT)
SELECT cron.unschedule('project-weekly-cto-tasks')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'project-weekly-cto-tasks');

SELECT cron.schedule(
  'project-weekly-cto-tasks',
  '0 9 * * 1',
  $$SELECT public._cron_generate_project_weekly_tasks()$$
);
