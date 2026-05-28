import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================
// Edge Function: sync-meta-ads
//
// Fetches campaign-level insights from Meta Marketing API and
// upserts into meta_ads_insights. Supports:
//   - backfill=true  → last 90 days
//   - backfill=false → last 7 days (default, used by hourly cron)
//
// Auth:
//   - source='cron' → no JWT check (called via pg_net with anon key)
//   - otherwise     → JWT required, must be CEO/CTO
// ============================================================

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";
const FIELDS = "campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions";
const BATCH_SIZE = 200; // rows per upsert batch

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

// ---------- Meta API Fetcher ----------

async function fetchInsightsForAccount(
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
    `&fields=${FIELDS}` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&time_increment=1` +
    `&limit=500` +
    `&access_token=${accessToken}`;

  let pageCount = 0;
  const MAX_PAGES = 100; // safety

  while (url && pageCount < MAX_PAGES) {
    pageCount++;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000), // 30s per page
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncMetaAds] Meta API error for ${accountId}: ${response.status} ${errText}`);
      return { rows: allRows, error: `Meta API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    const insights: RawMetaInsight[] = data.data || [];

    for (const raw of insights) {
      allRows.push(transformInsightRow(raw, accountId));
    }

    // Cursor pagination
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

    // Service role client — used for all DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { backfill = false, source } = body as { backfill?: boolean; source?: string };

    // ---------- Auth ----------
    if (source !== "cron") {
      // Manual sync — require JWT + CEO/CTO role
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

      // Check role
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
    console.log(`[SyncMetaAds] Syncing ${accounts.length} accounts, range ${since}→${until}, backfill=${backfill}`);

    // ---------- Process each account (fail-open) ----------
    let totalSynced = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        console.log(`[SyncMetaAds] Processing ${account.account_name} (${account.account_id})...`);

        const { rows, error } = await fetchInsightsForAccount(
          account.account_id,
          metaAccessToken,
          since,
          until
        );

        if (error) {
          errors.push(`${account.account_name}: ${error}`);
        }

        if (rows.length === 0) {
          console.log(`[SyncMetaAds] ${account.account_name}: 0 rows`);
          continue;
        }

        // Upsert in batches
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const { error: upsertError } = await supabase
            .from("meta_ads_insights")
            .upsert(batch, { onConflict: "ad_account_id,campaign_id,date_start" });

          if (upsertError) {
            const msg = `${account.account_name} upsert batch ${Math.floor(i / BATCH_SIZE)}: ${upsertError.message}`;
            console.error(`[SyncMetaAds] ${msg}`);
            errors.push(msg);
          }
        }

        totalSynced += rows.length;
        console.log(`[SyncMetaAds] ${account.account_name}: ${rows.length} rows upserted`);
      } catch (accountError) {
        const msg = `${account.account_name}: ${accountError instanceof Error ? accountError.message : "Unknown error"}`;
        console.error(`[SyncMetaAds] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(`[SyncMetaAds] Complete — ${totalSynced} rows synced, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        synced: totalSynced,
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
