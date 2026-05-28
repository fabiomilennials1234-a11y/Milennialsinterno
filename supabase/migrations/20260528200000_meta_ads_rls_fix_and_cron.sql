-- ============================================================
-- Meta Ads: RLS policy fix (is_admin → is_ceo) + pg_cron hourly sync
-- ============================================================

-- ============================================================
-- 1. RLS FIX: meta_ad_accounts — drop is_admin, create is_ceo
-- ============================================================
DROP POLICY IF EXISTS "admin_select_meta_ad_accounts" ON meta_ad_accounts;
DROP POLICY IF EXISTS "admin_insert_meta_ad_accounts" ON meta_ad_accounts;
DROP POLICY IF EXISTS "admin_update_meta_ad_accounts" ON meta_ad_accounts;
DROP POLICY IF EXISTS "admin_delete_meta_ad_accounts" ON meta_ad_accounts;

CREATE POLICY "ceo_select_meta_ad_accounts" ON meta_ad_accounts
  FOR SELECT TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE POLICY "ceo_insert_meta_ad_accounts" ON meta_ad_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "ceo_update_meta_ad_accounts" ON meta_ad_accounts
  FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "ceo_delete_meta_ad_accounts" ON meta_ad_accounts
  FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));

-- ============================================================
-- 2. RLS FIX: meta_ads_insights — drop is_admin, create is_ceo
-- ============================================================
DROP POLICY IF EXISTS "admin_select_meta_ads_insights" ON meta_ads_insights;
DROP POLICY IF EXISTS "admin_insert_meta_ads_insights" ON meta_ads_insights;
DROP POLICY IF EXISTS "admin_update_meta_ads_insights" ON meta_ads_insights;
DROP POLICY IF EXISTS "admin_delete_meta_ads_insights" ON meta_ads_insights;

CREATE POLICY "ceo_select_meta_ads_insights" ON meta_ads_insights
  FOR SELECT TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE POLICY "ceo_insert_meta_ads_insights" ON meta_ads_insights
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "ceo_update_meta_ads_insights" ON meta_ads_insights
  FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "ceo_delete_meta_ads_insights" ON meta_ads_insights
  FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));

-- ============================================================
-- 3. pg_cron: trigger function for hourly Meta Ads sync
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_sync_meta_ads()
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
    body    := jsonb_build_object('backfill', false, 'source', 'cron'),
    headers := v_headers,
    timeout_milliseconds := 120000
  );

  RAISE LOG '[MetaAdsCron] Dispatched hourly sync';
END;
$$;

-- ============================================================
-- 4. Schedule: hourly (every hour, all days)
-- ============================================================
SELECT cron.unschedule('meta-ads-hourly-sync')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meta-ads-hourly-sync');

SELECT cron.schedule(
  'meta-ads-hourly-sync',
  '0 * * * *',
  $$SELECT public.trigger_sync_meta_ads()$$
);
