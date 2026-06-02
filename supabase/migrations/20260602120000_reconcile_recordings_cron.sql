-- ============================================================
-- Reunião Gravada v2 — Fase C: cron do reconciler
--
-- Dispara reconcile-recordings a cada 5min via pg_cron → pg_net.
-- Pattern: 20260515960000_oracle_daily_cron.sql (reusa _internal_config).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_reconcile_recordings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edge_url text := 'https://semhnpwxptfgqxhkoqsk.supabase.co/functions/v1/reconcile-recordings';
  v_anon_key text;
BEGIN
  SELECT value INTO v_anon_key FROM _internal_config WHERE key = 'supabase_anon_key';

  IF v_anon_key IS NULL THEN
    RAISE WARNING '[ReconcileRecordings] anon key not found in _internal_config. Aborting.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_url,
    body    := jsonb_build_object('source', 'cron'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    timeout_milliseconds := 30000
  );
END;
$$;

SELECT cron.unschedule('reconcile-recordings')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-recordings');

SELECT cron.schedule(
  'reconcile-recordings',
  '*/5 * * * *',
  $$SELECT public.trigger_reconcile_recordings()$$
);
