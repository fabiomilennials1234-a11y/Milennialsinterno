-- Desliga a geração automática das tarefas semanais do gestor de ads.
--
-- Causa raiz: cron job 'weekly-gestor-tasks' (jobid 21, segundas 09:00 UTC)
-- chamava create_weekly_gestor_tasks(), que inseria — para TODO gestor_ads —
-- duas tarefas fixas com task_type='daily':
--   * 'Enviar relatório para todos os clientes'
--   * 'Enviar lema no grupo dos gestores'
-- Como entram como 'daily', apareciam em "Tarefas Diárias" e eram percebidas
-- como geradas sem motivo. Decisão do fundador (2026-07-01): remover.
--
-- Ações:
--   1. Unschedule do cron job (para de gerar toda segunda).
--   2. Função vira no-op (se alguém re-schedular, não volta a gerar).
--   3. Limpa as tarefas ABERTAS (status='todo', não arquivadas). Histórico
--      'done' é preservado.

-- 1. Unschedule (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-gestor-tasks') THEN
    PERFORM cron.unschedule('weekly-gestor-tasks');
  END IF;
END $$;

-- 2. No-op guard: mantém a assinatura, mas não insere nada.
CREATE OR REPLACE FUNCTION public.create_weekly_gestor_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Desativada em 2026-07-01. Geração automática removida por decisão do fundador.
  RAISE LOG '[WeeklyTasks] Desativada — nenhuma tarefa gerada.';
END;
$function$;

-- 3. Limpa as tarefas abertas (não toca no histórico 'done' nem arquivadas)
DELETE FROM public.ads_tasks
WHERE title IN (
  'Enviar relatório para todos os clientes',
  'Enviar lema no grupo dos gestores'
)
AND status = 'todo'
AND archived = false;
