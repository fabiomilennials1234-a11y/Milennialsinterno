-- ============================================================
-- Meta Ads: preserve existing creative_thumbnail_url on upsert
--
-- WHY: thumbnail fetching is being decoupled from the ad-insights
-- critical path (90d backfill was timing out on the per-ad thumbnail
-- loop). After decoupling, the insights upsert runs with
-- creative_thumbnail_url = NULL and a separate enrichment step fills
-- it in. Without COALESCE, the next insights upsert (e.g. the */30min
-- cron re-syncing the same day) would overwrite a populated thumbnail
-- back to NULL, causing perpetual re-fetching and UI flicker.
--
-- Both the batch RPC (used by the edge function) and the single-row
-- RPC are patched for consistency.
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_meta_ads_insights_batch(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_row jsonb;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO meta_ads_insights (
      ad_account_id, campaign_id, campaign_name, date_start, date_stop,
      spend, impressions, clicks, reach, frequency,
      cpc, cpm, ctr, leads, conversions,
      actions_raw, fetched_at,
      adset_id, adset_name, ad_id, ad_name, creative_thumbnail_url
    ) VALUES (
      v_row->>'ad_account_id',
      v_row->>'campaign_id',
      v_row->>'campaign_name',
      (v_row->>'date_start')::date,
      (v_row->>'date_stop')::date,
      COALESCE((v_row->>'spend')::numeric, 0),
      COALESCE((v_row->>'impressions')::bigint, 0),
      COALESCE((v_row->>'clicks')::bigint, 0),
      COALESCE((v_row->>'reach')::bigint, 0),
      COALESCE((v_row->>'frequency')::numeric, 0),
      COALESCE((v_row->>'cpc')::numeric, 0),
      COALESCE((v_row->>'cpm')::numeric, 0),
      COALESCE((v_row->>'ctr')::numeric, 0),
      COALESCE((v_row->>'leads')::integer, 0),
      COALESCE((v_row->>'conversions')::integer, 0),
      (v_row->'actions_raw'),
      COALESCE((v_row->>'fetched_at')::timestamptz, now()),
      v_row->>'adset_id',
      v_row->>'adset_name',
      v_row->>'ad_id',
      v_row->>'ad_name',
      v_row->>'creative_thumbnail_url'
    )
    ON CONFLICT (ad_account_id, campaign_id, COALESCE(ad_id, ''), date_start)
    DO UPDATE SET
      campaign_name          = EXCLUDED.campaign_name,
      date_stop              = EXCLUDED.date_stop,
      spend                  = EXCLUDED.spend,
      impressions            = EXCLUDED.impressions,
      clicks                 = EXCLUDED.clicks,
      reach                  = EXCLUDED.reach,
      frequency              = EXCLUDED.frequency,
      cpc                    = EXCLUDED.cpc,
      cpm                    = EXCLUDED.cpm,
      ctr                    = EXCLUDED.ctr,
      leads                  = EXCLUDED.leads,
      conversions            = EXCLUDED.conversions,
      actions_raw            = EXCLUDED.actions_raw,
      fetched_at             = EXCLUDED.fetched_at,
      adset_id               = EXCLUDED.adset_id,
      adset_name             = EXCLUDED.adset_name,
      ad_name                = EXCLUDED.ad_name,
      -- Preserve a populated thumbnail when the incoming row has none.
      creative_thumbnail_url = COALESCE(EXCLUDED.creative_thumbnail_url, meta_ads_insights.creative_thumbnail_url),
      updated_at             = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.upsert_meta_ads_insight(
  p_ad_account_id text,
  p_campaign_id text,
  p_campaign_name text,
  p_date_start date,
  p_date_stop date,
  p_spend numeric,
  p_impressions bigint,
  p_clicks bigint,
  p_reach bigint,
  p_frequency numeric,
  p_cpc numeric,
  p_cpm numeric,
  p_ctr numeric,
  p_leads integer,
  p_conversions integer,
  p_actions_raw jsonb,
  p_fetched_at timestamptz,
  p_adset_id text DEFAULT NULL,
  p_adset_name text DEFAULT NULL,
  p_ad_id text DEFAULT NULL,
  p_ad_name text DEFAULT NULL,
  p_creative_thumbnail_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO meta_ads_insights (
    ad_account_id, campaign_id, campaign_name, date_start, date_stop,
    spend, impressions, clicks, reach, frequency,
    cpc, cpm, ctr, leads, conversions,
    actions_raw, fetched_at,
    adset_id, adset_name, ad_id, ad_name, creative_thumbnail_url
  ) VALUES (
    p_ad_account_id, p_campaign_id, p_campaign_name, p_date_start, p_date_stop,
    p_spend, p_impressions, p_clicks, p_reach, p_frequency,
    p_cpc, p_cpm, p_ctr, p_leads, p_conversions,
    p_actions_raw, p_fetched_at,
    p_adset_id, p_adset_name, p_ad_id, p_ad_name, p_creative_thumbnail_url
  )
  ON CONFLICT (ad_account_id, campaign_id, COALESCE(ad_id, ''), date_start)
  DO UPDATE SET
    campaign_name          = EXCLUDED.campaign_name,
    date_stop              = EXCLUDED.date_stop,
    spend                  = EXCLUDED.spend,
    impressions            = EXCLUDED.impressions,
    clicks                 = EXCLUDED.clicks,
    reach                  = EXCLUDED.reach,
    frequency              = EXCLUDED.frequency,
    cpc                    = EXCLUDED.cpc,
    cpm                    = EXCLUDED.cpm,
    ctr                    = EXCLUDED.ctr,
    leads                  = EXCLUDED.leads,
    conversions            = EXCLUDED.conversions,
    actions_raw            = EXCLUDED.actions_raw,
    fetched_at             = EXCLUDED.fetched_at,
    adset_id               = EXCLUDED.adset_id,
    adset_name             = EXCLUDED.adset_name,
    ad_name                = EXCLUDED.ad_name,
    creative_thumbnail_url = COALESCE(EXCLUDED.creative_thumbnail_url, meta_ads_insights.creative_thumbnail_url),
    updated_at             = now();
END;
$$;
