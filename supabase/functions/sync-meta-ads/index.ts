import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================
// Edge Function: sync-meta-ads (v2)
//
// Fetches campaign-level + ad-level insights + leads from Meta
// Marketing API and upserts into meta_ads_insights / meta_leads.
//
// Supports:
//   - backfill=true  -> last 90 days
//   - backfill=false -> last 7 days (default, used by hourly cron)
//
// Auth:
//   - source='cron' -> no JWT check (called via pg_net with anon key)
//   - otherwise     -> JWT required, must be CEO/CTO
//
// Fail-open: ad-level and lead errors don't block campaign-level.
// ============================================================

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";
const CAMPAIGN_FIELDS = "campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions";
const AD_FIELDS = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions";
const BATCH_SIZE = 200;
const MAX_PAGES = 100;

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

// ---------- Utils (duplicated from src/lib/meta-ads-utils.ts) ----------

function parseMetaActions(actions: MetaAction[]): { leads: number; conversions: number } {
  const leads = Number(actions.find(a => a.action_type === "lead")?.value ?? 0);
  const conversions = actions
    .filter(a => a.action_type.startsWith("offsite_conversion.") || a.action_type === "purchase")
    .reduce((sum, a) => sum + Number(a.value), 0);
  return { leads, conversions };
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function buildDateRange(isBackfill: boolean): { since: string; until: string } {
  const now = new Date();
  const until = formatDate(now);
  const since = new Date(now);
  since.setDate(since.getDate() - (isBackfill ? 90 : 7));
  return { since: formatDate(since), until };
}

function transformInsightRow(raw: RawMetaInsight, accountId: string): MetaAdsInsightRow {
  const { leads, conversions } = parseMetaActions(raw.actions ?? []);
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
    actions_raw: raw.actions ?? null,
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

  // Dedupe ad_ids for thumbnail fetching
  const uniqueAdIds = [...new Set(allRaw.map(r => r.ad_id).filter(Boolean))] as string[];
  const thumbnailMap = new Map<string, string>();

  // Fetch thumbnails in parallel batches of 10
  for (let i = 0; i < uniqueAdIds.length; i += 10) {
    const batch = uniqueAdIds.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (adId) => {
        const thumb = await fetchCreativeThumbnail(adId, accessToken);
        if (thumb) thumbnailMap.set(adId, thumb);
      })
    );
    // Log failures but continue
    for (const r of results) {
      if (r.status === "rejected") {
        console.warn(`[SyncMetaAds] Thumbnail fetch failed:`, r.reason);
      }
    }
  }

  const rows = allRaw.map(raw =>
    transformAdLevelInsightRow(raw, accountId, raw.ad_id ? thumbnailMap.get(raw.ad_id) : undefined)
  );

  return { rows };
}

// ---------- Meta API: Lead forms + leads ----------

interface LeadForm {
  id: string;
  name: string;
}

async function fetchLeadForms(
  accountId: string,
  accessToken: string,
): Promise<{ forms: LeadForm[]; error?: string }> {
  const forms: LeadForm[] = [];
  // accountId already has "act_" prefix from meta_ad_accounts table
  let url = `${META_GRAPH_URL}/${accountId}/leadgen_forms?fields=id,name&limit=100&access_token=${accessToken}`;
  let pageCount = 0;

  while (url && pageCount < 10) {
    pageCount++;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncMetaAds] Lead forms error for ${accountId}: ${response.status} ${errText}`);
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
  accessToken: string,
  accountId: string,
): Promise<{ rows: MetaLeadRow[]; error?: string }> {
  const allRows: MetaLeadRow[] = [];
  let url = `${META_GRAPH_URL}/${formId}/leads?fields=id,created_time,field_data,ad_id,ad_name,adset_id,campaign_id,campaign_name&limit=500&access_token=${accessToken}`;
  let pageCount = 0;

  while (url && pageCount < MAX_PAGES) {
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
      allRows.push({
        lead_id: lead.id,
        ad_account_id: accountId,
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

    url = data.paging?.next || null;
  }

  return { rows: allRows };
}

// ---------- Main Handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAccessToken = Deno.env.get("META_ACCESS_TOKEN");

    if (!metaAccessToken) {
      throw new Error("META_ACCESS_TOKEN not configured. Run: supabase secrets set META_ACCESS_TOKEN=...");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { backfill = false, source } = body as { backfill?: boolean; source?: string };

    // ---------- Auth ----------
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

    // ---------- Fetch active accounts ----------
    const { data: accounts, error: accountsError } = await supabase
      .from("meta_ad_accounts")
      .select("account_id, account_name")
      .eq("is_active", true);

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
    const { since, until } = buildDateRange(backfill);
    console.log(`[SyncMetaAds] Syncing ${accounts.length} accounts, range ${since}->${until}, backfill=${backfill}`);

    // ---------- Process each account ----------
    let totalCampaignRows = 0;
    let totalAdRows = 0;
    let totalLeadRows = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const acctLabel = `${account.account_name} (${account.account_id})`;
      console.log(`[SyncMetaAds] Processing ${acctLabel}...`);

      // === Campaign-level ===
      try {
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

      // === Ad-level (fail-open) ===
      try {
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

      // === Leads (fail-open) ===
      try {
        const { forms, error: formsError } = await fetchLeadForms(
          account.account_id,
          metaAccessToken,
        );

        if (formsError) errors.push(`${acctLabel} lead forms: ${formsError}`);

        for (const form of forms) {
          try {
            const { rows: leadRows, error: leadError } = await fetchLeadsForForm(
              form.id,
              metaAccessToken,
              account.account_id,
            );

            if (leadError) errors.push(`${acctLabel} form ${form.name}: ${leadError}`);

            if (leadRows.length > 0) {
              // Upsert leads in batches
              for (let i = 0; i < leadRows.length; i += BATCH_SIZE) {
                const batch = leadRows.slice(i, i + BATCH_SIZE);
                const { error: upsertError } = await supabase
                  .from("meta_leads")
                  .upsert(batch, { onConflict: "lead_id" });

                if (upsertError) {
                  const msg = `${acctLabel} lead upsert batch: ${upsertError.message}`;
                  console.error(`[SyncMetaAds] ${msg}`);
                  errors.push(msg);
                }
              }
              totalLeadRows += leadRows.length;
            }
          } catch (err) {
            const msg = `${acctLabel} form ${form.name}: ${err instanceof Error ? err.message : "Unknown"}`;
            console.error(`[SyncMetaAds] ${msg}`);
            errors.push(msg);
          }
        }

        if (forms.length > 0) {
          console.log(`[SyncMetaAds] ${acctLabel}: ${forms.length} forms, ${totalLeadRows} leads`);
        }
      } catch (err) {
        const msg = `${acctLabel} leads: ${err instanceof Error ? err.message : "Unknown"}`;
        console.error(`[SyncMetaAds] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(`[SyncMetaAds] Complete — campaigns=${totalCampaignRows}, ads=${totalAdRows}, leads=${totalLeadRows}, errors=${errors.length}`);

    return new Response(
      JSON.stringify({
        synced: {
          campaigns: totalCampaignRows,
          ads: totalAdRows,
          leads: totalLeadRows,
        },
        errors,
        accounts_processed: accounts.length,
        date_range: { since, until },
        backfill,
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
