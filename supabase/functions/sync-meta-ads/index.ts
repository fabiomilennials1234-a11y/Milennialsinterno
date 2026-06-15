import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================
// Edge Function: sync-meta-ads (v3)
//
// Fetches campaign-level + ad-level insights + leads from Meta
// Marketing API and upserts into meta_ads_insights / meta_leads.
//
// Supports sync modes:
//   - mode='leads'         -> pages/forms/leads only, last 2 days (cron: */5 min)
//   - mode='insights'      -> campaign + ad insights + thumbnails, last 2 days (cron: */30 min)
//   - mode='full'          -> everything, last 7 days (cron: daily 3AM BRT)
//   - mode='backfill'      -> everything, last 90 days (manual only)
//   - mode='seed-accounts' -> discover client ad accounts from /me/adaccounts and
//                             register them as on_demand (CEO/CTO only, NEVER cron)
//
// Backward compat: backfill=true (no mode) maps to 'backfill'.
//
// Account scope (multi-conta — desacoplado de is_active):
//   - source='cron'             -> processes ONLY sync_policy='cron' accounts
//   - authenticated + account_id -> processes ONLY that one account (must be is_active)
//   - authenticated, no account_id -> processes ALL sync_policy='cron' (legacy default)
//
// Auth:
//   - source='cron' -> no JWT check (called via pg_net with anon key)
//   - otherwise     -> JWT required, must be CEO/CTO
//
// Fail-open: ad-level and lead errors don't block campaign-level.
// ============================================================

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";
// `conversions` is requested ALONGSIDE `actions` because Meta only emits the
// suffixed custom-conversion action_type (e.g.
// offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled) in the
// `conversions` field with action_breakdowns=action_type. `actions` alone
// collapses it into the un-suffixed offsite_conversion.fb_pixel_custom bucket.
const CAMPAIGN_FIELDS = "campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,conversions";
const AD_FIELDS = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,conversions";
const ACTION_BREAKDOWNS = "action_type";
const BATCH_SIZE = 200;
const MAX_PAGES = 100;

// Supabase edge functions have a wall-clock ceiling (~150s default). In
// backfill mode the universe of distinct ads can be large, so thumbnail
// enrichment runs under a time budget: it starts only while there's at least
// THUMBNAIL_DEADLINE_MARGIN_MS left, and stops mid-flight when the deadline
// passes. Insights are persisted BEFORE enrichment, so skipping thumbnails
// never loses data — the next cron cycle picks up whatever is still missing.
const EDGE_WALL_CLOCK_BUDGET_MS = 150_000;
const THUMBNAIL_DEADLINE_MARGIN_MS = 20_000;

// ---------- Types (duplicated from src/lib/meta-ads-utils.ts — Deno boundary) ----------

interface MetaAction {
  action_type: string;
  value: string;
}

interface RawMetaInsight {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: MetaAction[];
  conversions?: MetaAction[];
}

interface RawAdLevelInsight extends RawMetaInsight {
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
}

interface MetaAdsInsightRow {
  ad_account_id: string;
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  cpc: number;
  cpm: number;
  ctr: number;
  leads: number;
  conversions: number;
  actions_raw: MetaAction[] | null;
  fetched_at: string;
}

interface AdLevelInsightRow extends MetaAdsInsightRow {
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  creative_thumbnail_url: string | null;
}

interface LeadFieldEntry {
  name: string;
  values: string[];
}

interface RawMetaLead {
  id: string;
  created_time: string;
  field_data: LeadFieldEntry[];
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  campaign_id?: string;
  campaign_name?: string;
}

interface MetaLeadRow {
  lead_id: string;
  ad_account_id: string;
  form_id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  ad_id: string | null;
  ad_name: string | null;
  created_time: string;
  field_data: LeadFieldEntry[];
  fetched_at: string;
}

// ---------- Utils (duplicated from src/lib/meta-ads-utils.ts — Deno boundary) ----------

type SyncMode = "leads" | "insights" | "full" | "backfill";

const SYNC_DAYS: Record<SyncMode, number> = {
  leads: 2,
  insights: 2,
  full: 7,
  backfill: 90,
};

// Mirror of src/lib/meta-ads-utils.ts (Deno boundary — cannot import).
// Hard purchases only. Custom pixel conversions (e.g. agendamento) are tracked
// individually downstream via actions_raw, never blended into `conversions`.
const PURCHASE_ACTION_TYPES = new Set([
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
]);

function parseMetaActions(actions: MetaAction[]): { leads: number; conversions: number } {
  const leads = Number(actions.find(a => a.action_type === "lead")?.value ?? 0);
  const conversions = actions
    .filter(a => PURCHASE_ACTION_TYPES.has(a.action_type))
    .reduce((sum, a) => sum + Number(a.value), 0);
  return { leads, conversions };
}

/**
 * Merge the `conversions` array (suffixed custom-conversion events) into the
 * `actions` array, deduping by action_type. The named custom-conversion events
 * (e.g. offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled) only
 * appear in `conversions`; persisting them into actions_raw lets the frontend
 * extractor read agendamentos by exact action_type.
 */
function mergeActions(actions?: MetaAction[], conversions?: MetaAction[]): MetaAction[] | null {
  const merged = new Map<string, MetaAction>();
  for (const a of actions ?? []) merged.set(a.action_type, a);
  for (const c of conversions ?? []) merged.set(c.action_type, c);
  return merged.size > 0 ? Array.from(merged.values()) : null;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function buildDateRange(mode: SyncMode): { since: string; until: string } {
  const now = new Date();
  const until = formatDate(now);
  const since = new Date(now);
  since.setDate(since.getDate() - SYNC_DAYS[mode]);
  return { since: formatDate(since), until };
}

function transformInsightRow(raw: RawMetaInsight, accountId: string): MetaAdsInsightRow {
  const { leads, conversions } = parseMetaActions(raw.actions ?? []);
  const actionsRaw = mergeActions(raw.actions, raw.conversions);
  return {
    ad_account_id: accountId,
    campaign_id: raw.campaign_id,
    campaign_name: raw.campaign_name,
    date_start: raw.date_start,
    date_stop: raw.date_stop,
    spend: Number(raw.spend ?? 0),
    impressions: Number(raw.impressions ?? 0),
    clicks: Number(raw.clicks ?? 0),
    reach: Number(raw.reach ?? 0),
    frequency: Number(raw.frequency ?? 0),
    cpc: Number(raw.cpc ?? 0),
    cpm: Number(raw.cpm ?? 0),
    ctr: Number(raw.ctr ?? 0),
    leads,
    conversions,
    actions_raw: actionsRaw,
    fetched_at: new Date().toISOString(),
  };
}

function transformAdLevelInsightRow(
  raw: RawAdLevelInsight,
  accountId: string,
  thumbnailUrl?: string,
): AdLevelInsightRow {
  const base = transformInsightRow(raw, accountId);
  return {
    ...base,
    adset_id: raw.adset_id ?? null,
    adset_name: raw.adset_name ?? null,
    ad_id: raw.ad_id ?? null,
    ad_name: raw.ad_name ?? null,
    creative_thumbnail_url: thumbnailUrl ?? null,
  };
}

// ---------- Meta API: Campaign-level insights ----------

async function fetchCampaignInsights(
  accountId: string,
  accessToken: string,
  since: string,
  until: string
): Promise<{ rows: MetaAdsInsightRow[]; error?: string }> {
  const allRows: MetaAdsInsightRow[] = [];
  const timeRange = JSON.stringify({ since, until });

  let url =
    `${META_GRAPH_URL}/${accountId}/insights` +
    `?level=campaign` +
    `&fields=${CAMPAIGN_FIELDS}` +
    `&action_breakdowns=${ACTION_BREAKDOWNS}` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&time_increment=1` +
    `&limit=500` +
    `&access_token=${accessToken}`;

  let pageCount = 0;

  while (url && pageCount < MAX_PAGES) {
    pageCount++;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncMetaAds] Campaign API error for ${accountId}: ${response.status} ${errText}`);
      return { rows: allRows, error: `Meta API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    const insights: RawMetaInsight[] = data.data || [];

    for (const raw of insights) {
      allRows.push(transformInsightRow(raw, accountId));
    }

    url = data.paging?.next || null;
  }

  return { rows: allRows };
}

// ---------- Meta API: Ad-level insights ----------

async function fetchCreativeThumbnail(
  adId: string,
  accessToken: string,
): Promise<string | undefined> {
  try {
    const response = await fetch(
      `${META_GRAPH_URL}/${adId}?fields=creative{thumbnail_url}&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    return data?.creative?.thumbnail_url ?? undefined;
  } catch {
    return undefined;
  }
}

async function fetchAdLevelInsights(
  accountId: string,
  accessToken: string,
  since: string,
  until: string
): Promise<{ rows: AdLevelInsightRow[]; error?: string }> {
  const allRaw: RawAdLevelInsight[] = [];
  const timeRange = JSON.stringify({ since, until });

  let url =
    `${META_GRAPH_URL}/${accountId}/insights` +
    `?level=ad` +
    `&fields=${AD_FIELDS}` +
    `&action_breakdowns=${ACTION_BREAKDOWNS}` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&time_increment=1` +
    `&limit=500` +
    `&access_token=${accessToken}`;

  let pageCount = 0;

  while (url && pageCount < MAX_PAGES) {
    pageCount++;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncMetaAds] Ad-level API error for ${accountId}: ${response.status} ${errText}`);
      return { rows: [], error: `Ad-level Meta API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    allRaw.push(...(data.data || []));
    url = data.paging?.next || null;
  }

  // Thumbnails are fetched in a separate enrichment step (see
  // enrichMissingThumbnails) so the thumbnail loop can never block — or be
  // truncated by — persistence of the insights themselves. Rows are returned
  // with creative_thumbnail_url = null; enrichment fills only what's missing.
  const rows = allRaw.map(raw => transformAdLevelInsightRow(raw, accountId));

  return { rows };
}

// ---------- Meta API: Thumbnail enrichment (decoupled from insights path) ----------

/**
 * Fetch creative thumbnails ONLY for the given ad_ids (already filtered to
 * those missing a thumbnail in the DB), in parallel batches of 10 with a 10s
 * per-request timeout. Returns a map of ad_id -> thumbnail_url for the ones
 * that resolved. `deadline` (epoch ms) bounds wall-clock time: when exceeded,
 * the loop stops early and returns whatever was gathered so far. Insights are
 * already persisted by the time this runs, so a partial result is safe.
 */
async function fetchThumbnailsForAdIds(
  adIds: string[],
  accessToken: string,
  deadline?: number,
): Promise<{ map: Map<string, string>; truncated: boolean }> {
  const map = new Map<string, string>();

  for (let i = 0; i < adIds.length; i += 10) {
    if (deadline !== undefined && Date.now() >= deadline) {
      return { map, truncated: true };
    }

    const batch = adIds.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (adId) => {
        const thumb = await fetchCreativeThumbnail(adId, accessToken);
        if (thumb) map.set(adId, thumb);
      }),
    );
    for (const r of results) {
      if (r.status === "rejected") {
        console.warn(`[SyncMetaAds] Thumbnail fetch failed:`, r.reason);
      }
    }
  }

  return { map, truncated: false };
}

// ---------- Meta API: Pages (for Lead Ads) ----------

interface MetaPage {
  id: string;
  name: string;
  access_token: string;
}

async function fetchPages(
  userAccessToken: string,
): Promise<{ pages: MetaPage[]; error?: string }> {
  const pages: MetaPage[] = [];
  let url = `${META_GRAPH_URL}/me/accounts?fields=id,name,access_token&limit=100&access_token=${userAccessToken}`;
  let pageCount = 0;

  while (url && pageCount < 10) {
    pageCount++;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncMetaAds] Pages API error: ${response.status} ${errText}`);
      return { pages, error: `Pages API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    pages.push(...(data.data || []));
    url = data.paging?.next || null;
  }

  return { pages };
}

// ---------- Meta API: Lead forms + leads (via Page Access Token) ----------

interface LeadForm {
  id: string;
  name: string;
  status: string;
}

async function fetchLeadForms(
  pageId: string,
  pageAccessToken: string,
): Promise<{ forms: LeadForm[]; error?: string }> {
  const forms: LeadForm[] = [];
  let url = `${META_GRAPH_URL}/${pageId}/leadgen_forms?fields=id,name,status&limit=100&access_token=${pageAccessToken}`;
  let pageCount = 0;

  while (url && pageCount < 10) {
    pageCount++;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncMetaAds] Lead forms error for page ${pageId}: ${response.status} ${errText}`);
      return { forms, error: `Lead forms API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    forms.push(...(data.data || []));
    url = data.paging?.next || null;
  }

  return { forms };
}

async function fetchLeadsForForm(
  formId: string,
  pageAccessToken: string,
  adAccountId: string,
  sinceDate: string,
): Promise<{ rows: MetaLeadRow[]; error?: string }> {
  const allRows: MetaLeadRow[] = [];
  const cutoff = new Date(sinceDate);
  let url =
    `${META_GRAPH_URL}/${formId}/leads` +
    `?fields=id,created_time,field_data,ad_id,ad_name,adset_id,campaign_id,campaign_name` +
    `&limit=500` +
    `&access_token=${pageAccessToken}`;
  let pageCount = 0;
  let reachedCutoff = false;

  while (url && pageCount < MAX_PAGES && !reachedCutoff) {
    pageCount++;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncMetaAds] Leads error for form ${formId}: ${response.status} ${errText}`);
      return { rows: allRows, error: `Leads API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    const leads: RawMetaLead[] = data.data || [];

    for (const lead of leads) {
      const leadDate = new Date(lead.created_time);
      if (leadDate < cutoff) {
        reachedCutoff = true;
        break;
      }

      allRows.push({
        lead_id: lead.id,
        ad_account_id: adAccountId,
        form_id: formId,
        campaign_id: lead.campaign_id ?? null,
        campaign_name: lead.campaign_name ?? null,
        adset_id: lead.adset_id ?? null,
        ad_id: lead.ad_id ?? null,
        ad_name: lead.ad_name ?? null,
        created_time: lead.created_time,
        field_data: lead.field_data ?? [],
        fetched_at: new Date().toISOString(),
      });
    }

    url = reachedCutoff ? null : (data.paging?.next || null);
  }

  return { rows: allRows };
}

// ---------- Thumbnail enrichment: persist missing thumbnails ----------

/**
 * For a single account: find ad_ids that currently have NO thumbnail in the
 * DB, fetch thumbnails for only those, and write them back. Runs AFTER
 * insights are persisted and is bounded by `deadline` (epoch ms, optional) so
 * it can never delay or truncate insight persistence. Returns a small summary
 * for logging. Errors are caught by the caller (fail-open).
 */
async function enrichMissingThumbnails(
  supabase: SupabaseClient,
  accountId: string,
  accessToken: string,
  deadline?: number,
): Promise<{ updated: number; missing: number; truncated: boolean }> {
  const { data, error } = await supabase
    .from("meta_ads_insights")
    .select("ad_id")
    .eq("ad_account_id", accountId)
    .not("ad_id", "is", null)
    .is("creative_thumbnail_url", null);

  if (error) {
    throw new Error(`thumbnail query: ${error.message}`);
  }

  const missingAdIds = [...new Set((data ?? []).map((r) => r.ad_id as string))];
  if (missingAdIds.length === 0) {
    return { updated: 0, missing: 0, truncated: false };
  }

  const { map, truncated } = await fetchThumbnailsForAdIds(missingAdIds, accessToken, deadline);

  let updated = 0;
  for (const [adId, thumb] of map) {
    const { error: updErr } = await supabase
      .from("meta_ads_insights")
      .update({ creative_thumbnail_url: thumb })
      .eq("ad_account_id", accountId)
      .eq("ad_id", adId)
      .is("creative_thumbnail_url", null);

    if (updErr) {
      console.warn(`[SyncMetaAds] Thumbnail update failed for ad ${adId}:`, updErr.message);
    } else {
      updated++;
    }
  }

  return { updated, missing: missingAdIds.length, truncated };
}

// ---------- Meta API: Ad account discovery (seed-accounts mode) ----------

interface RawAdAccount {
  // `id` already carries the act_ prefix (e.g. act_123). `account_id` is the
  // bare numeric id. We persist `id` to match meta_ads_insights.ad_account_id.
  id: string;
  account_id: string;
  name?: string;
  account_status?: number;
}

async function fetchOwnedAdAccounts(
  userAccessToken: string,
): Promise<{ accounts: RawAdAccount[]; error?: string }> {
  const accounts: RawAdAccount[] = [];
  let url =
    `${META_GRAPH_URL}/me/adaccounts` +
    `?fields=account_id,name,account_status,id` +
    `&limit=200` +
    `&access_token=${userAccessToken}`;
  let pageCount = 0;

  while (url && pageCount < MAX_PAGES) {
    pageCount++;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncMetaAds] adaccounts API error: ${response.status} ${errText}`);
      return { accounts, error: `adaccounts API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    accounts.push(...(data.data || []));
    url = data.paging?.next || null;
  }

  return { accounts };
}

/**
 * Discover active (account_status===1) ad accounts the token can see and
 * register them as on_demand, is_active=true. Idempotent via upsert on the
 * unique account_id. Never sets is_principal and never touches sync_policy of
 * existing rows beyond the upsert default — the principal (Milennials) is set in
 * migration and must NOT be demoted here, so we only insert/refresh name and
 * leave sync_policy='on_demand' for newcomers via DEFAULT.
 */
async function seedAdAccounts(
  supabase: SupabaseClient,
  accessToken: string,
): Promise<{ seeded: number; skipped: number; total: number; error?: string }> {
  const { accounts, error } = await fetchOwnedAdAccounts(accessToken);
  if (error && accounts.length === 0) {
    return { seeded: 0, skipped: 0, total: 0, error };
  }

  const active = accounts.filter((a) => a.account_status === 1);
  const skipped = accounts.length - active.length;

  if (active.length === 0) {
    return { seeded: 0, skipped, total: accounts.length, error };
  }

  // Read existing account_ids to avoid clobbering sync_policy/is_principal of
  // rows already configured (e.g. Milennials principal+cron). Upsert with
  // onConflict=account_id only ADDS new on_demand rows; existing rows keep their
  // current policy because we don't include sync_policy for known accounts.
  const { data: existing } = await supabase
    .from("meta_ad_accounts")
    .select("account_id");
  const knownIds = new Set((existing ?? []).map((r) => r.account_id as string));

  const newRows = active
    .filter((a) => !knownIds.has(a.id))
    .map((a) => ({
      account_id: a.id,
      account_name: a.name ?? a.id,
      sync_policy: "on_demand" as const,
      is_active: true,
    }));

  // Refresh names for accounts we already know, without touching policy/principal.
  const refreshRows = active
    .filter((a) => knownIds.has(a.id))
    .map((a) => ({ account_id: a.id, account_name: a.name ?? a.id }));

  let seeded = 0;
  if (newRows.length > 0) {
    const { error: insertErr } = await supabase
      .from("meta_ad_accounts")
      .upsert(newRows, { onConflict: "account_id", ignoreDuplicates: false });
    if (insertErr) {
      return { seeded: 0, skipped, total: accounts.length, error: insertErr.message };
    }
    seeded = newRows.length;
  }

  for (const r of refreshRows) {
    await supabase
      .from("meta_ad_accounts")
      .update({ account_name: r.account_name })
      .eq("account_id", r.account_id);
  }

  return { seeded, skipped, total: accounts.length, error };
}

// ---------- Main Handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN");

    if (!metaAccessToken) {
      throw new Error("META_ACCESS_TOKEN not configured. Run: supabase secrets set META_ACCESS_TOKEN=...");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { backfill = false, source, mode: rawMode, account_id: rawAccountId } = body as {
      backfill?: boolean;
      source?: string;
      mode?: string;
      account_id?: string;
    };

    // seed-accounts is a discovery mode, not a sync mode — handled separately and
    // NEVER reachable from cron (see auth gate below).
    const isSeedAccounts = rawMode === "seed-accounts";

    // On-demand single-account scope. Only honored on the authenticated path;
    // used solely in a parametrized .eq() (no raw SQL), so injection-safe.
    const requestedAccountId =
      typeof rawAccountId === "string" && rawAccountId.length > 0 ? rawAccountId : null;

    // Resolve sync mode: explicit mode takes precedence, then backfill compat
    const validModes: SyncMode[] = ["leads", "insights", "full", "backfill"];
    const mode: SyncMode =
      rawMode && validModes.includes(rawMode as SyncMode)
        ? (rawMode as SyncMode)
        : backfill
          ? "backfill"
          : "full";

    // ---------- Auth ----------
    // seed-accounts and on-demand single-account scope are privileged operations
    // that MUST run authenticated (CEO/CTO). The cron path bypasses JWT, so it is
    // explicitly forbidden from triggering account discovery or arbitrary scoped
    // syncs — defense in depth against a forged source='cron' body.
    if (source === "cron" && (isSeedAccounts || requestedAccountId)) {
      return new Response(
        JSON.stringify({ error: "cron cannot run seed-accounts or scoped on-demand sync" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (source !== "cron") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing Authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!
      ).auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!roleData || (roleData.role !== "ceo" && roleData.role !== "cto")) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions — CEO/CTO only" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ---------- seed-accounts: discover + register, then return ----------
    if (isSeedAccounts) {
      const result = await seedAdAccounts(supabase, metaAccessToken);
      console.log(`[SyncMetaAds] seed-accounts: seeded=${result.seeded}, skipped=${result.skipped}, total=${result.total}`);
      return new Response(
        JSON.stringify({ mode: "seed-accounts", ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Fetch accounts to process ----------
    // Cron auto-syncs only sync_policy='cron' accounts (keeps the 40 client
    // accounts off the */30 cron → no Graph rate-limit blowup). An authenticated
    // on-demand call with account_id targets exactly one selectable account.
    let accountsQuery = supabase
      .from("meta_ad_accounts")
      .select("account_id, account_name");

    if (requestedAccountId) {
      accountsQuery = accountsQuery
        .eq("account_id", requestedAccountId)
        .eq("is_active", true);
    } else {
      accountsQuery = accountsQuery.eq("sync_policy", "cron");
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError) {
      throw new Error(`Failed to fetch ad accounts: ${accountsError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, errors: [], accounts_processed: 0, message: "No active ad accounts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Determine date range ----------
    const { since, until } = buildDateRange(mode);
    const doInsights = mode !== "leads";
    // Leads are sourced from the token's Pages (Milennials' lead forms), not
    // per-ad-account. A scoped on-demand sync of a single client account must NOT
    // re-walk every Page — it would be slow, unrelated to that account, and would
    // tag leads with the wrong ad_account_id. Skip leads when account-scoped.
    const doLeads = mode !== "insights" && !requestedAccountId;
    console.log(`[SyncMetaAds] Syncing ${accounts.length} accounts, range ${since}->${until}, mode=${mode}`);

    // Thumbnail enrichment is time-bounded only in backfill (large ad universe,
    // close to the wall-clock ceiling). Other modes have small daily windows and
    // run enrichment unbounded.
    const thumbnailDeadline =
      mode === "backfill"
        ? startedAt + EDGE_WALL_CLOCK_BUDGET_MS - THUMBNAIL_DEADLINE_MARGIN_MS
        : undefined;

    // ---------- Process each account ----------
    let totalCampaignRows = 0;
    let totalAdRows = 0;
    let totalLeadRows = 0;
    let totalThumbnailsUpdated = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const acctLabel = `${account.account_name} (${account.account_id})`;
      console.log(`[SyncMetaAds] Processing ${acctLabel} (mode=${mode})...`);

      // === Campaign-level (skip in leads-only mode) ===
      if (doInsights) try {
        const { rows, error } = await fetchCampaignInsights(
          account.account_id,
          metaAccessToken,
          since,
          until
        );

        if (error) errors.push(`${acctLabel} campaigns: ${error}`);

        if (rows.length > 0) {
          // Use batch RPC for campaign-level upserts (handles COALESCE index)
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const { error: rpcError } = await supabase.rpc("upsert_meta_ads_insights_batch", {
              p_rows: JSON.parse(JSON.stringify(batch)),
            });

            if (rpcError) {
              const msg = `${acctLabel} campaign upsert batch ${Math.floor(i / BATCH_SIZE)}: ${rpcError.message}`;
              console.error(`[SyncMetaAds] ${msg}`);
              errors.push(msg);
            }
          }
          totalCampaignRows += rows.length;
          console.log(`[SyncMetaAds] ${acctLabel}: ${rows.length} campaign rows`);
        }
      } catch (err) {
        const msg = `${acctLabel} campaigns: ${err instanceof Error ? err.message : "Unknown"}`;
        console.error(`[SyncMetaAds] ${msg}`);
        errors.push(msg);
      }

      // === Ad-level (fail-open, skip in leads-only mode) ===
      if (doInsights) try {
        const { rows: adRows, error: adError } = await fetchAdLevelInsights(
          account.account_id,
          metaAccessToken,
          since,
          until
        );

        if (adError) errors.push(`${acctLabel} ads: ${adError}`);

        if (adRows.length > 0) {
          for (let i = 0; i < adRows.length; i += BATCH_SIZE) {
            const batch = adRows.slice(i, i + BATCH_SIZE);
            const { error: rpcError } = await supabase.rpc("upsert_meta_ads_insights_batch", {
              p_rows: JSON.parse(JSON.stringify(batch)),
            });

            if (rpcError) {
              const msg = `${acctLabel} ad upsert batch ${Math.floor(i / BATCH_SIZE)}: ${rpcError.message}`;
              console.error(`[SyncMetaAds] ${msg}`);
              errors.push(msg);
            }
          }
          totalAdRows += adRows.length;
          console.log(`[SyncMetaAds] ${acctLabel}: ${adRows.length} ad rows`);
        }
      } catch (err) {
        const msg = `${acctLabel} ads: ${err instanceof Error ? err.message : "Unknown"}`;
        console.error(`[SyncMetaAds] ${msg}`);
        errors.push(msg);
      }

      // === Thumbnail enrichment (fail-open, runs AFTER insights persist) ===
      // Cosmetic — never allowed to block or roll back insight persistence.
      if (doInsights) {
        if (thumbnailDeadline !== undefined && Date.now() >= thumbnailDeadline) {
          console.log(`[SyncMetaAds] ${acctLabel}: skipping thumbnails (time budget exhausted) — insights already persisted`);
        } else try {
          const { updated, missing, truncated } = await enrichMissingThumbnails(
            supabase,
            account.account_id,
            metaAccessToken,
            thumbnailDeadline,
          );
          totalThumbnailsUpdated += updated;
          if (missing > 0) {
            console.log(`[SyncMetaAds] ${acctLabel}: thumbnails ${updated}/${missing} filled${truncated ? " (truncated by time budget)" : ""}`);
          }
        } catch (err) {
          const msg = `${acctLabel} thumbnails: ${err instanceof Error ? err.message : "Unknown"}`;
          console.warn(`[SyncMetaAds] ${msg}`);
          errors.push(msg);
        }
      }

    }

    // === Leads via Page Access Tokens (fail-open, skip in insights-only mode) ===
    if (doLeads) try {
      const { pages, error: pagesError } = await fetchPages(metaAccessToken);

      if (pagesError) errors.push(`Pages: ${pagesError}`);

      // Use first active ad account ID for traceability in meta_leads rows
      const defaultAccountId = accounts[0]?.account_id ?? "unknown";

      for (const page of pages) {
        const pageLabel = `${page.name} (${page.id})`;
        try {
          const { forms, error: formsError } = await fetchLeadForms(
            page.id,
            page.access_token,
          );

          if (formsError) errors.push(`${pageLabel} lead forms: ${formsError}`);

          const activeForms = forms.filter(f => f.status === "ACTIVE");

          for (const form of activeForms) {
            try {
              const { rows: leadRows, error: leadError } = await fetchLeadsForForm(
                form.id,
                page.access_token,
                defaultAccountId,
                since,
              );

              if (leadError) errors.push(`${pageLabel} form ${form.name}: ${leadError}`);

              if (leadRows.length > 0) {
                for (let i = 0; i < leadRows.length; i += BATCH_SIZE) {
                  const batch = leadRows.slice(i, i + BATCH_SIZE);
                  const { error: upsertError } = await supabase
                    .from("meta_leads")
                    .upsert(batch, { onConflict: "lead_id" });

                  if (upsertError) {
                    const msg = `${pageLabel} lead upsert batch: ${upsertError.message}`;
                    console.error(`[SyncMetaAds] ${msg}`);
                    errors.push(msg);
                  }
                }
                totalLeadRows += leadRows.length;
                console.log(`[SyncMetaAds] ${pageLabel} form "${form.name}": ${leadRows.length} leads`);
              }
            } catch (err) {
              const msg = `${pageLabel} form ${form.name}: ${err instanceof Error ? err.message : "Unknown"}`;
              console.error(`[SyncMetaAds] ${msg}`);
              errors.push(msg);
            }
          }

          if (forms.length > 0) {
            console.log(`[SyncMetaAds] ${pageLabel}: ${forms.length} forms (${activeForms.length} active), ${totalLeadRows} total leads so far`);
          }
        } catch (err) {
          const msg = `${pageLabel} leads: ${err instanceof Error ? err.message : "Unknown"}`;
          console.error(`[SyncMetaAds] ${msg}`);
          errors.push(msg);
        }
      }

      console.log(`[SyncMetaAds] Pages processed: ${pages.length}`);
    } catch (err) {
      const msg = `Leads (pages): ${err instanceof Error ? err.message : "Unknown"}`;
      console.error(`[SyncMetaAds] ${msg}`);
      errors.push(msg);
    }

    console.log(`[SyncMetaAds] Complete — mode=${mode}, campaigns=${totalCampaignRows}, ads=${totalAdRows}, thumbnails=${totalThumbnailsUpdated}, leads=${totalLeadRows}, errors=${errors.length}, elapsed=${Date.now() - startedAt}ms`);

    return new Response(
      JSON.stringify({
        synced: {
          campaigns: totalCampaignRows,
          ads: totalAdRows,
          thumbnails: totalThumbnailsUpdated,
          leads: totalLeadRows,
        },
        errors,
        accounts_processed: accounts.length,
        date_range: { since, until },
        mode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SyncMetaAds] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
