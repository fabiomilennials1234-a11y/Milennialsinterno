-- 20260428120000_fix_ads_tasks_select_own_and_weekly_type.sql
--
-- FIX duplo em public.ads_tasks:
--
-- BUG 1 — RLS sem SELECT pro dono (gestor de ads).
--   Migration 20260118221923_a0f4a392-74cf-4a03-b849-707fbb78147e dropou
--   policy "Users can manage own tasks" (FOR ALL — cobria SELECT) e recriou
--   apenas INSERT/UPDATE/DELETE escopadas por `ads_manager_id = auth.uid()`.
--   Migration 20260420220000_* adicionou SELECT mas restrito a
--   is_admin OR gestor_projetos OR sucesso_cliente. Resultado: o proprio
--   gestor_ads dono da tarefa nao consegue le-la — RLS bloqueia.
--
--   FIX: recriar policy "Users can view own tasks" FOR SELECT com
--        USING (ads_manager_id = auth.uid()). Idempotente (DROP IF EXISTS).
--
-- BUG 2 — Cron semanal grava task_type='daily'.
--   Funcao public.create_weekly_gestor_tasks() (migration 20260401150000)
--   insere as 2 tarefas semanais com task_type='daily' nas linhas 53 e 78.
--   A UI filtra a aba "weekly" por task_type='weekly' → aba sempre vazia,
--   mesmo com tarefas criadas pelo cron.
--
--   FIX: CREATE OR REPLACE FUNCTION reproduzindo o corpo original e trocando
--        task_type 'daily' → 'weekly' nos dois INSERTs. Backfill nas linhas
--        ja criadas pelo cron (identificadas pela tag 'auto_semanal').
--
-- ROLLBACK:
--   - Policy: DROP POLICY IF EXISTS "Users can view own tasks" ON public.ads_tasks;
--   - Funcao: re-aplicar 20260401150000_weekly_gestor_tasks_cron.sql.
--   - Backfill: nao reversivel automaticamente — registros que ja eram
--     'daily' sao indistinguiveis dos backfilled. Use snapshot pre-migration
--     se rollback for necessario.

BEGIN;

-- =====================================================================
-- BUG 1: RLS SELECT para o dono da tarefa
-- =====================================================================

DROP POLICY IF EXISTS "Users can view own tasks" ON public.ads_tasks;

CREATE POLICY "Users can view own tasks"
  ON public.ads_tasks
  FOR SELECT
  TO authenticated
  USING (ads_manager_id = auth.uid());

-- =====================================================================
-- BUG 2: cron weekly tasks com task_type correto
-- =====================================================================

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
        'weekly',
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
        'weekly',
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

-- =====================================================================
-- Backfill: tarefas ja criadas pelo cron com task_type='daily' incorreto
-- =====================================================================

UPDATE public.ads_tasks
   SET task_type = 'weekly'
 WHERE 'auto_semanal' = ANY(tags)
   AND task_type = 'daily';

COMMIT;
