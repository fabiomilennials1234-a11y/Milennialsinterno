-- ============================================================
-- Automação semanal: cria 2 tarefas para todos os gestores
-- Toda segunda-feira às 06:00 BRT (09:00 UTC)
-- ============================================================

-- 1. Habilitar pg_cron (já vem habilitado no Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Função que cria as tarefas semanais
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
  -- Calcular a segunda-feira da semana atual
  v_monday := date_trunc('week', CURRENT_DATE)::date;
  -- Prazo: 1 dia após a segunda (terça-feira)
  v_due_date := v_monday + INTERVAL '1 day';
  -- Tag de referência da semana para idempotência
  v_week_tag := 'auto_weekly:' || v_monday::text;

  -- Iterar sobre todos os gestores de ads ativos
  FOR v_gestor_id IN
    SELECT ur.user_id
    FROM user_roles ur
    JOIN profiles p ON p.user_id = ur.user_id
    WHERE ur.role = 'gestor_ads'
  LOOP
    -- Tarefa 1: Enviar relatório para todos os clientes
    -- Verificar idempotência: não criar se já existe para esta semana
    IF NOT EXISTS (
      SELECT 1 FROM ads_tasks
      WHERE ads_manager_id = v_gestor_id
        AND title = 'Enviar relatório para todos os clientes'
        AND v_week_tag = ANY(tags)
        AND (archived IS NULL OR archived = false)
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

    -- Tarefa 2: Enviar lema no grupo dos gestores
    IF NOT EXISTS (
      SELECT 1 FROM ads_tasks
      WHERE ads_manager_id = v_gestor_id
        AND title = 'Enviar lema no grupo dos gestores'
        AND v_week_tag = ANY(tags)
        AND (archived IS NULL OR archived = false)
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

-- 3. Agendar execução: toda segunda-feira às 09:00 UTC (06:00 BRT)
-- Remove job anterior se existir (idempotente)
SELECT cron.unschedule('weekly-gestor-tasks')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-gestor-tasks'
);

SELECT cron.schedule(
  'weekly-gestor-tasks',           -- nome do job
  '0 9 * * 1',                     -- cron: toda segunda às 09:00 UTC = 06:00 BRT
  $$SELECT public.create_weekly_gestor_tasks()$$
);
