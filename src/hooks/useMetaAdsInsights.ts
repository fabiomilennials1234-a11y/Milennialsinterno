import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ---------- Helpers ----------

interface ActionEntry {
  action_type: string;
  value: string;
}

/** Extract 3-second video views from Meta actions_raw JSONB. */
export function extractVideoViews(actionsRaw: unknown): number {
  if (!Array.isArray(actionsRaw)) return 0;
  const entry = (actionsRaw as ActionEntry[]).find(
    (a) => a?.action_type === 'video_view',
  );
  return Number(entry?.value ?? 0);
}

export interface MetaAdsInsight {
  id: string;
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
  actions_raw: unknown;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface DailyData {
  date: string;
  spend: number;
  leads: number;
}

export interface CampaignData {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  cpl: number;
  ctr: number;
  video_views: number;
  hook_rate: number;
  connect_rate: number;
}

export interface MetaAdsAggregates {
  totalSpend: number;
  totalLeads: number;
  avgCPL: number;
  totalImpressions: number;
  totalClicks: number;
  avgCTR: number;
  avgCPC: number;
  avgCPM: number;
  totalReach: number;
  totalVideoViews: number;
  avgHookRate: number;
  avgConnectRate: number;
  dailyData: DailyData[];
  campaignData: CampaignData[];
  top10Campaigns: CampaignData[];
  latestFetchedAt: string | null;
}

function computeAggregates(rows: MetaAdsInsight[]): MetaAdsAggregates {
  if (rows.length === 0) {
    return {
      totalSpend: 0,
      totalLeads: 0,
      avgCPL: 0,
      totalImpressions: 0,
      totalClicks: 0,
      avgCTR: 0,
      avgCPC: 0,
      avgCPM: 0,
      totalReach: 0,
      totalVideoViews: 0,
      avgHookRate: 0,
      avgConnectRate: 0,
      dailyData: [],
      campaignData: [],
      top10Campaigns: [],
      latestFetchedAt: null,
    };
  }

  // Totals
  let totalSpend = 0;
  let totalLeads = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalReach = 0;
  let totalVideoViews = 0;
  let latestFetchedAt = rows[0].fetched_at;

  // Daily aggregation
  const dailyMap = new Map<string, { spend: number; leads: number }>();
  // Campaign aggregation
  const campaignMap = new Map<string, {
    campaign_name: string;
    spend: number;
    leads: number;
    impressions: number;
    clicks: number;
    video_views: number;
  }>();

  for (const row of rows) {
    const rowVideoViews = extractVideoViews(row.actions_raw);

    totalSpend += row.spend;
    totalLeads += row.leads;
    totalImpressions += row.impressions;
    totalClicks += row.clicks;
    totalReach += row.reach;
    totalVideoViews += rowVideoViews;

    if (row.fetched_at > latestFetchedAt) {
      latestFetchedAt = row.fetched_at;
    }

    // Daily
    const existing = dailyMap.get(row.date_start);
    if (existing) {
      existing.spend += row.spend;
      existing.leads += row.leads;
    } else {
      dailyMap.set(row.date_start, { spend: row.spend, leads: row.leads });
    }

    // Campaign
    const campaignExisting = campaignMap.get(row.campaign_id);
    if (campaignExisting) {
      campaignExisting.spend += row.spend;
      campaignExisting.leads += row.leads;
      campaignExisting.impressions += row.impressions;
      campaignExisting.clicks += row.clicks;
      campaignExisting.video_views += rowVideoViews;
    } else {
      campaignMap.set(row.campaign_id, {
        campaign_name: row.campaign_name,
        spend: row.spend,
        leads: row.leads,
        impressions: row.impressions,
        clicks: row.clicks,
        video_views: rowVideoViews,
      });
    }
  }

  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const avgHookRate = totalImpressions > 0 ? (totalVideoViews / totalImpressions) * 100 : 0;
  const avgConnectRate = totalVideoViews > 0 ? (totalClicks / totalVideoViews) * 100 : 0;

  const dailyData: DailyData[] = Array.from(dailyMap.entries())
    .map(([date, d]) => ({ date, spend: d.spend, leads: d.leads }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const campaignData: CampaignData[] = Array.from(campaignMap.entries())
    .map(([campaign_id, c]) => ({
      campaign_id,
      campaign_name: c.campaign_name,
      spend: c.spend,
      leads: c.leads,
      impressions: c.impressions,
      clicks: c.clicks,
      cpl: c.leads > 0 ? c.spend / c.leads : 0,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      video_views: c.video_views,
      hook_rate: c.impressions > 0 ? (c.video_views / c.impressions) * 100 : 0,
      connect_rate: c.video_views > 0 ? (c.clicks / c.video_views) * 100 : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  const top10Campaigns = campaignData.slice(0, 10);

  return {
    totalSpend,
    totalLeads,
    avgCPL,
    totalImpressions,
    totalClicks,
    avgCTR,
    avgCPC,
    avgCPM,
    totalReach,
    totalVideoViews,
    avgHookRate,
    avgConnectRate,
    dailyData,
    campaignData,
    top10Campaigns,
    latestFetchedAt,
  };
}

export function useMetaAdsInsights(params: {
  dateFrom: string;
  dateTo: string;
  accountId?: string;
}) {
  const { dateFrom, dateTo, accountId } = params;

  const query = useQuery({
    queryKey: ['meta-ads-insights', dateFrom, dateTo, accountId],
    queryFn: async (): Promise<MetaAdsInsight[]> => {
      let q = supabase
        .from('meta_ads_insights')
        .select('*')
        .gte('date_start', dateFrom)
        .lte('date_start', dateTo)
        .order('date_start', { ascending: false });

      if (accountId && accountId !== 'all') {
        q = q.eq('ad_account_id', accountId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MetaAdsInsight[];
    },
    staleTime: 60_000,
  });

  const aggregates = computeAggregates(query.data ?? []);

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    aggregates,
  };
}
