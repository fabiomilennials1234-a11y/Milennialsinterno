-- ============================================================
-- Oracle Daily Cron — Dispara geração de resumos diários
-- Diariamente às 09:00 UTC (06:00 BRT)
--
-- Fluxo: pg_cron → PL/pgSQL → net.http_post → edge function
-- ============================================================

-- 1. Habilitar pg_net para chamadas HTTP a partir do banco
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Tabela de config interna (não exposta via PostgREST)
--    Armazena a anon key pra uso pelo cron
CREATE TABLE IF NOT EXISTS public._internal_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Sem RLS — tabela só acessível por SECURITY DEFINER functions
ALTER TABLE public._internal_config ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy = nenhum acesso via PostgREST/client

INSERT INTO public._internal_config (key, value)
VALUES ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbWhucHd4cHRmZ3F4aGtvcXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDgxNzQsImV4cCI6MjA4NjIyNDE3NH0.Fr5cEPpRiFIU-TOR2iilLTHnvH1osbWpdsOwY5fNzPw')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Função que dispara geração para todos os grupos e usuários
CREATE OR REPLACE FUNCTION public.trigger_oracle_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_user record;
  v_edge_url text;
  v_anon_key text;
  v_headers jsonb;
  v_group_count int := 0;
  v_user_count int := 0;
BEGIN
  v_edge_url := 'https://semhnpwxptfgqxhkoqsk.supabase.co/functions/v1/generate-oracle-summary';

  -- Buscar anon key da tabela interna
  SELECT value INTO v_anon_key
  FROM _internal_config
  WHERE key = 'supabase_anon_key';

  IF v_anon_key IS NULL THEN
    RAISE WARNING '[OracleCron] anon key not found in _internal_config. Aborting.';
    RETURN;
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_anon_key
  );

  -- Grupo oracles — um por organization_group com membros ativos
  FOR v_group IN
    SELECT DISTINCT og.id AS group_id
    FROM organization_groups og
    JOIN profiles p ON p.group_id = og.id
    JOIN user_roles ur ON ur.user_id = p.user_id
  LOOP
    PERFORM net.http_post(
      url     := v_edge_url,
      body    := jsonb_build_object('type', 'group', 'group_id', v_group.group_id),
      headers := v_headers,
      timeout_milliseconds := 30000
    );
    v_group_count := v_group_count + 1;
  END LOOP;

  -- Individual oracles — um por usuário ativo (com role atribuído)
  FOR v_user IN
    SELECT DISTINCT p.user_id
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
  LOOP
    PERFORM net.http_post(
      url     := v_edge_url,
      body    := jsonb_build_object('type', 'individual', 'user_id', v_user.user_id),
      headers := v_headers,
      timeout_milliseconds := 30000
    );
    v_user_count := v_user_count + 1;
  END LOOP;

  RAISE LOG '[OracleCron] Dispatched % group + % individual summaries', v_group_count, v_user_count;
END;
$$;

-- 4. Agendar: diariamente às 09:00 UTC (06:00 BRT)
SELECT cron.unschedule('oracle-daily-summaries')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'oracle-daily-summaries');

SELECT cron.schedule(
  'oracle-daily-summaries',
  '0 9 * * *',
  $$SELECT public.trigger_oracle_summaries()$$
);
