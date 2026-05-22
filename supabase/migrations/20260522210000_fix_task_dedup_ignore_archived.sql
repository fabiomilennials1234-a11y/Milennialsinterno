-- Fix: task automation dedup checks must include archived tasks
--
-- Both useResultsReportAutomation (frontend) and create_weekly_gestor_tasks (cron)
-- filtered `archived IS NULL OR archived = false` in their dedup checks.
-- This made archived tasks invisible → automations recreated them every cycle.
--
-- Frontend fix: useResultsReportAutomation.ts (removed archived filter from query)
-- DB fix: create_weekly_gestor_tasks() (removed archived filter from EXISTS check)

CREATE OR REPLACE FUNCTION public.create_weekly_gestor_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gestor_id UUID;
  v_monday DATE;
  v_due_date DATE;
  v_week_tag TEXT;
  v_success_count INT := 0;
  v_skip_count INT := 0;
BEGIN
  v_monday := date_trunc('week', CURRENT_DATE)::date;
  v_due_date := v_monday + INTERVAL '1 day';
  v_week_tag := 'auto_weekly:' || v_monday::text;

  FOR v_gestor_id IN
    SELECT ur.user_id
    FROM user_roles ur
    JOIN profiles p ON p.user_id = ur.user_id
    WHERE ur.role = 'gestor_ads'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM ads_tasks
      WHERE ads_manager_id = v_gestor_id
        AND title = 'Enviar lema no grupo dos gestores'
        AND v_week_tag = ANY(tags)
    ) THEN
      INSERT INTO ads_tasks (
        ads_manager_id, title, description, task_type, status, priority, due_date, tags
      ) VALUES (
        v_gestor_id,
        'Enviar lema no grupo dos gestores',
        'Tarefa automática semanal — criada em ' || v_monday::text,
        'daily',
        'todo',
        'high',
        v_due_date,
        ARRAY[v_week_tag, 'auto_semanal']
      );
      v_success_count := v_success_count + 1;
    ELSE
      v_skip_count := v_skip_count + 1;
    END IF;
  END LOOP;

  RAISE LOG '[WeeklyTasks] Concluído: % tarefas criadas, % ignoradas (duplicatas)', v_success_count, v_skip_count;
END;
$$;
