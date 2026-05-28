-- ============================================================
-- Meta Ads v3: replace single hourly cron with 3 mode-specific schedules
--
-- leads    -> */5 min  (pages/forms/leads only, 2-day window)
-- insights -> */30 min (campaign + ad insights + thumbnails, 2-day window)
-- full     -> daily 3AM BRT / 6 UTC (everything, 7-day window)
-- ============================================================

-- ============================================================
-- 1. Remove old hourly cron job (safe if not exists)
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'meta-ads-hourly-sync';
END;
$$;

-- ============================================================
-- 2. Parameterized trigger function (accepts mode)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_sync_meta_ads_mode(p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edge_url text;
  v_anon_key text;
  v_headers jsonb;
BEGIN
  v_edge_url := 'https://semhnpwxptfgqxhkoqsk.supabase.co/functions/v1/sync-meta-ads';

  SELECT value INTO v_anon_key
  FROM _internal_config
  WHERE key = 'supabase_anon_key';

  IF v_anon_key IS NULL THEN
    RAISE WARNING '[MetaAdsCron] anon key not found in _internal_config. Aborting.';
    RETURN;
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_anon_key
  );

  PERFORM net.http_post(
    url     := v_edge_url,
    body    := jsonb_build_object('source', 'cron', 'mode', p_mode),
    headers := v_headers,
    timeout_milliseconds := 120000
  );

  RAISE LOG '[MetaAdsCron] Dispatched sync mode=%', p_mode;
END;
$$;

-- ============================================================
-- 3. Update existing trigger_sync_meta_ads() to delegate
--    (backward compat for any external callers)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_sync_meta_ads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.trigger_sync_meta_ads_mode('full');
END;
$$;

-- ============================================================
-- 4. Schedule 3 cron jobs
-- ============================================================

-- Leads: every 5 minutes
SELECT cron.schedule(
  'meta-ads-leads-5min',
  '*/5 * * * *',
  $$SELECT public.trigger_sync_meta_ads_mode('leads')$$
);

-- Insights: every 30 minutes
SELECT cron.schedule(
  'meta-ads-insights-30min',
  '*/30 * * * *',
  $$SELECT public.trigger_sync_meta_ads_mode('insights')$$
);

-- Full sync: daily at 6 UTC (3AM BRT)
SELECT cron.schedule(
  'meta-ads-daily-3am',
  '0 6 * * *',
  $$SELECT public.trigger_sync_meta_ads_mode('full')$$
);
