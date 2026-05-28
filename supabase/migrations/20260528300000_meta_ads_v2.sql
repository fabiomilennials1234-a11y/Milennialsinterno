-- ============================================================
-- Meta Ads v2: ad-level insights, leads, manual sales
-- ============================================================

-- ============================================================
-- 1. ALTER meta_ads_insights: add ad-level columns
-- ============================================================
ALTER TABLE meta_ads_insights
  ADD COLUMN IF NOT EXISTS adset_id   text,
  ADD COLUMN IF NOT EXISTS adset_name text,
  ADD COLUMN IF NOT EXISTS ad_id      text,
  ADD COLUMN IF NOT EXISTS ad_name    text,
  ADD COLUMN IF NOT EXISTS creative_thumbnail_url text;

-- Drop old unique constraint (campaign-level only)
ALTER TABLE meta_ads_insights
  DROP CONSTRAINT IF EXISTS uq_insight_account_campaign_date;

-- New unique index supports both campaign-level (ad_id NULL → '') and ad-level rows
CREATE UNIQUE INDEX IF NOT EXISTS uq_insight_account_campaign_ad_date
  ON meta_ads_insights (ad_account_id, campaign_id, COALESCE(ad_id, ''), date_start);

-- Index for ad-level queries (creatives tab, leads ranking)
CREATE INDEX IF NOT EXISTS idx_insights_ad_id
  ON meta_ads_insights (ad_id) WHERE ad_id IS NOT NULL;


-- ============================================================
-- 2. RPC: upsert_meta_ads_insight
--    Handles expression-based unique index that Supabase JS
--    onConflict cannot reference directly.
-- ============================================================
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
    creative_thumbnail_url = EXCLUDED.creative_thumbnail_url,
    updated_at             = now();
END;
$$;


-- ============================================================
-- 3. Batch upsert variant for campaign-level (no ad_id)
--    Keeps backward compat with existing edge function upsert.
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
      creative_thumbnail_url = EXCLUDED.creative_thumbnail_url,
      updated_at             = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ============================================================
-- 4. Table: meta_leads
-- ============================================================
CREATE TABLE meta_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         text NOT NULL UNIQUE,
  ad_account_id   text NOT NULL,
  form_id         text,
  campaign_id     text,
  campaign_name   text,
  adset_id        text,
  ad_id           text,
  ad_name         text,
  created_time    timestamptz,
  field_data      jsonb,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meta_leads_account ON meta_leads (ad_account_id);
CREATE INDEX idx_meta_leads_created_time ON meta_leads (created_time DESC);
CREATE INDEX idx_meta_leads_campaign ON meta_leads (campaign_id) WHERE campaign_id IS NOT NULL;

ALTER TABLE meta_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ceo_select_meta_leads" ON meta_leads
  FOR SELECT TO authenticated
  USING (public.is_ceo(auth.uid()));

-- Service role bypass for edge function upserts (no RLS user policy needed for INSERT)
-- Edge function uses service_role key which bypasses RLS.

CREATE TRIGGER set_updated_at_meta_leads
  BEFORE UPDATE ON meta_leads
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);


-- ============================================================
-- 5. Table: meta_ads_manual_sales
-- ============================================================
CREATE TABLE meta_ads_manual_sales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id   text NOT NULL,
  campaign_id     text NOT NULL,
  campaign_name   text NOT NULL,
  sale_date       date NOT NULL,
  num_sales       integer NOT NULL DEFAULT 0,
  sales_value     numeric(12,2) NOT NULL DEFAULT 0,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_manual_sale_account_campaign_date
    UNIQUE (ad_account_id, campaign_id, sale_date)
);

CREATE INDEX idx_manual_sales_date ON meta_ads_manual_sales (sale_date DESC);
CREATE INDEX idx_manual_sales_account ON meta_ads_manual_sales (ad_account_id);

ALTER TABLE meta_ads_manual_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ceo_select_meta_ads_manual_sales" ON meta_ads_manual_sales
  FOR SELECT TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE POLICY "ceo_insert_meta_ads_manual_sales" ON meta_ads_manual_sales
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "ceo_update_meta_ads_manual_sales" ON meta_ads_manual_sales
  FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "ceo_delete_meta_ads_manual_sales" ON meta_ads_manual_sales
  FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE TRIGGER set_updated_at_meta_ads_manual_sales
  BEFORE UPDATE ON meta_ads_manual_sales
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
