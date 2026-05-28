-- Meta Ads integration tables
-- Stores ad account mappings and campaign-level insights fetched from Meta Marketing API.
-- is_cto() and is_gestor_projetos() don't exist as separate helpers.
-- is_admin() covers ceo + cto + gestor_projetos — exact match for the intended audience.

-- ============================================================
-- Table: meta_ad_accounts
-- Maps Meta ad account IDs to internal clients.
-- ============================================================
CREATE TABLE meta_ad_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   text NOT NULL UNIQUE,
  account_name text NOT NULL,
  client_id    uuid REFERENCES clients(id) ON DELETE SET NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- FK index for client_id (used in joins / RLS-adjacent queries)
CREATE INDEX idx_meta_ad_accounts_client_id ON meta_ad_accounts (client_id);

ALTER TABLE meta_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_meta_ad_accounts" ON meta_ad_accounts
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_insert_meta_ad_accounts" ON meta_ad_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_update_meta_ad_accounts" ON meta_ad_accounts
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_delete_meta_ad_accounts" ON meta_ad_accounts
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_meta_ad_accounts
  BEFORE UPDATE ON meta_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);


-- ============================================================
-- Table: meta_ads_insights
-- Campaign-level daily metrics fetched from Meta Marketing API.
-- ============================================================
CREATE TABLE meta_ads_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id   text NOT NULL,
  campaign_id     text NOT NULL,
  campaign_name   text NOT NULL,
  date_start      date NOT NULL,
  date_stop       date NOT NULL,
  spend           numeric(12,2) NOT NULL DEFAULT 0,
  impressions     bigint NOT NULL DEFAULT 0,
  clicks          bigint NOT NULL DEFAULT 0,
  reach           bigint NOT NULL DEFAULT 0,
  frequency       numeric(8,4) NOT NULL DEFAULT 0,
  cpc             numeric(10,4) NOT NULL DEFAULT 0,
  cpm             numeric(10,4) NOT NULL DEFAULT 0,
  ctr             numeric(8,4) NOT NULL DEFAULT 0,
  leads           integer NOT NULL DEFAULT 0,
  conversions     integer NOT NULL DEFAULT 0,
  actions_raw     jsonb,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_insight_account_campaign_date
    UNIQUE (ad_account_id, campaign_id, date_start)
);

-- Composite index for queries filtering by account + date range
CREATE INDEX idx_insights_account_date ON meta_ads_insights (ad_account_id, date_start DESC);

-- Index for date-only queries (dashboards, aggregations)
CREATE INDEX idx_insights_date ON meta_ads_insights (date_start DESC);

ALTER TABLE meta_ads_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_meta_ads_insights" ON meta_ads_insights
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_insert_meta_ads_insights" ON meta_ads_insights
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_update_meta_ads_insights" ON meta_ads_insights
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_delete_meta_ads_insights" ON meta_ads_insights
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_updated_at_meta_ads_insights
  BEFORE UPDATE ON meta_ads_insights
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);


-- ============================================================
-- Seed: MilennialsB2B ad account
-- ============================================================
INSERT INTO meta_ad_accounts (account_id, account_name, is_active)
VALUES ('act_738610258782410', 'MilennialsB2B', true);
