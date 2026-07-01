-- 20260701130000_drop_create_weekly_gestor_tasks.sql
--
-- POR QUÊ: aposenta em definitivo a função bespoke role-based
-- public.create_weekly_gestor_tasks(). A migration anterior
-- (20260701120000_disable_weekly_gestor_tasks.sql) desagendou o cron
-- (jobid 21 'weekly-gestor-tasks') e transformou a função em no-op. Aqui
-- fechamos o ciclo: DROP da função.
--
-- INVARIANTE ARQUITETURAL (ADR 0016): geração de tarefa recorrente é SEMPRE
-- data-driven por template ativo em recurring_task_templates, gerada por
-- public._cron_generate_recurring_tasks() (gerador ÚNICO), com dedup por
-- recurring_template_id. NUNCA hardcoded por role numa função SQL bespoke.
-- Não reseeda a task legada; se o relatório semanal voltar, vira template.
--
-- Verificado antes do drop (remoto, 2026-07-01):
--   - 0 funções/triggers referenciam create_weekly_gestor_tasks (pg_proc.prosrc);
--   - nenhum cron.job aponta pra ela (jobid 21 já desagendado).
--
-- Bônus de hardening: _cron_generate_recurring_tasks estava com EXECUTE para
-- anon e authenticated (default privilege do Supabase + o REVOKE não foi
-- reaplicado no CREATE OR REPLACE da migration NPS). É SECURITY DEFINER sem
-- auth-check — só cron/service podem chamar. Reforçamos o REVOKE aqui.

BEGIN;

-- 1. Guard idempotente: desagenda cron órfão se ainda existir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-gestor-tasks') THEN
    PERFORM cron.unschedule('weekly-gestor-tasks');
  END IF;
END $$;

-- 2. Guard de dependência: aborta se algo passou a chamar a função.
DO $$
DECLARE
  v_dep text;
BEGIN
  SELECT string_agg(n.nspname || '.' || p.proname, ', ')
    INTO v_dep
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind = 'f'
    AND p.proname <> 'create_weekly_gestor_tasks'
    AND p.prosrc ILIKE '%create_weekly_gestor_tasks%';

  IF v_dep IS NOT NULL THEN
    RAISE EXCEPTION 'Abort drop: create_weekly_gestor_tasks ainda é referenciada por: %', v_dep;
  END IF;
END $$;

-- 3. DROP da função bespoke.
DROP FUNCTION IF EXISTS public.create_weekly_gestor_tasks();

-- 4. Hardening do gerador canônico: só owner/service_role executam.
REVOKE ALL ON FUNCTION public._cron_generate_recurring_tasks() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cron_generate_recurring_tasks() FROM anon;
REVOKE ALL ON FUNCTION public._cron_generate_recurring_tasks() FROM authenticated;

-- 5. Trava search_path do gerador (SECURITY DEFINER). O CREATE OR REPLACE da
-- migration NPS (20260522300000) perdeu o SET search_path que o sibling
-- generate_recurring_tasks mantém. Reforçamos aqui.
ALTER FUNCTION public._cron_generate_recurring_tasks() SET search_path = public;

COMMIT;
