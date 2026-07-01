-- 20260701140000_harden_cron_function_grants.sql
--
-- POR QUÊ: follow-up de segurança do hardening de _cron_generate_recurring_tasks
-- (20260701130000). O mesmo padrão de vuln latente existe em 4 outras funções
-- _cron_*: são SECURITY DEFINER (executam como owner/postgres) invocadas SÓ pelo
-- pg_cron, mas carregam EXECUTE aberto pra anon/authenticated — e 2 delas até
-- pra PUBLIC (default privilege do Supabase que nunca foi revogado). Isso é
-- superfície de escrita não autorizada: qualquer JWT (anon inclusive) podia
-- chamar via PostgREST RPC e disparar geração de tarefas como owner.
--
-- Auditado no remoto (2026-07-01), proacl antes:
--   _cron_check_project_delays        : postgres, anon, authenticated, service_role
--   _cron_generate_crm_stalled_tasks  : postgres, anon, authenticated, service_role
--   _cron_generate_project_daily_tasks: PUBLIC, postgres, anon, authenticated, service_role
--   _cron_generate_project_weekly_tasks: PUBLIC, postgres, anon, authenticated, service_role
--
-- Todas: prokind=f, prosecdef=true, 0 args, search_path=public já setado.
--
-- Ação: REVOKE EXECUTE de PUBLIC/anon/authenticated. Mantém postgres (owner) e
-- service_role (edge functions auditáveis). NÃO altera corpo/lógica. O cron
-- roda como superuser/postgres — REVOKE não afeta o agendamento.
-- ALTER ... SET search_path = public reafirmado por defesa em profundidade
-- (idempotente; já está setado nas 4).

BEGIN;

-- _cron_check_project_delays
REVOKE ALL ON FUNCTION public._cron_check_project_delays() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cron_check_project_delays() FROM anon;
REVOKE ALL ON FUNCTION public._cron_check_project_delays() FROM authenticated;
ALTER FUNCTION public._cron_check_project_delays() SET search_path = public;

-- _cron_generate_crm_stalled_tasks
REVOKE ALL ON FUNCTION public._cron_generate_crm_stalled_tasks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cron_generate_crm_stalled_tasks() FROM anon;
REVOKE ALL ON FUNCTION public._cron_generate_crm_stalled_tasks() FROM authenticated;
ALTER FUNCTION public._cron_generate_crm_stalled_tasks() SET search_path = public;

-- _cron_generate_project_daily_tasks
REVOKE ALL ON FUNCTION public._cron_generate_project_daily_tasks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cron_generate_project_daily_tasks() FROM anon;
REVOKE ALL ON FUNCTION public._cron_generate_project_daily_tasks() FROM authenticated;
ALTER FUNCTION public._cron_generate_project_daily_tasks() SET search_path = public;

-- _cron_generate_project_weekly_tasks
REVOKE ALL ON FUNCTION public._cron_generate_project_weekly_tasks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cron_generate_project_weekly_tasks() FROM anon;
REVOKE ALL ON FUNCTION public._cron_generate_project_weekly_tasks() FROM authenticated;
ALTER FUNCTION public._cron_generate_project_weekly_tasks() SET search_path = public;

COMMIT;
