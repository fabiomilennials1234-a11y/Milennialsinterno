-- 20260601100000_restore_weekly_relatorio_task.sql
--
-- Diagnose (pedido 1): "tarefas automáticas do gestor de ads não geram".
--
-- Root cause: migration 20260520100000_ads_task_cleanup_and_rename.sql removed the
-- weekly task "Enviar relatório para todos os clientes" from create_weekly_gestor_tasks(),
-- leaving only "Enviar lema no grupo dos gestores". This was a global change — every
-- gestor_ads (including Gustavo Lima / "Guga", user_id 683c085f-8749-4584-b914-8521451af4dc)
-- stopped receiving the report task. Evidence: cron job 'weekly-gestor-tasks' (jobid 21)
-- ran 2026-06-01 09:00 UTC succeeded; tag auto_weekly:2026-06-01 produced 6 "Enviar lema"
-- rows and 0 "Enviar relatório" rows.
--
-- Fix: restore the report task in the function. Keep task_type='daily' to match the
-- surviving "Enviar lema" sibling (both surface in the "Tarefas Diárias" tab via
-- useAdsManager.ts:241 `.eq('task_type', taskType)`). Dedup check excludes the
-- archived filter (per 20260522210000 fix) so archived tasks are not recreated.
--
-- Idempotent. Safe to re-run.

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
    -- Task 1: Enviar relatório para todos os clientes (RESTORED)
    IF NOT EXISTS (
      SELECT 1 FROM ads_tasks
      WHERE ads_manager_id = v_gestor_id
        AND title = 'Enviar relatório para todos os clientes'
        AND v_week_tag = ANY(tags)
    ) THEN
      INSERT INTO ads_tasks (
        ads_manager_id, title, description, task_type, status, priority, due_date, tags
      ) VALUES (
        v_gestor_id,
        'Enviar relatório para todos os clientes',
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

    -- Task 2: Enviar lema no grupo dos gestores
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

-- Backfill: create the missing "Enviar relatório" task for the CURRENT week so gestores
-- (incl. Guga) get it now instead of waiting for next Monday's cron run. The function's
-- dedup makes this safe and idempotent.
SELECT public.create_weekly_gestor_tasks();
