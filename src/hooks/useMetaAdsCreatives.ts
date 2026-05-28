import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CreativeRow {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  creative_thumbnail_url: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
}

export function useMetaAdsCreatives(params: {
  dateFrom: string;
  dateTo: string;
  accountId?: string;
}) {
  const { dateFrom, dateTo, accountId } = params;

  return useQuery({
    queryKey: ['meta-ads-creatives', dateFrom, dateTo, accountId],
    queryFn: async (): Promise<CreativeRow[]> => {
      let q = supabase
        .from('meta_ads_insights')
        .select('ad_id, ad_name, campaign_name, creative_thumbnail_url, spend, impressions, clicks, ctr, cpc, leads')
        .not('ad_id', 'is', null)
        .gte('date_start', dateFrom)
        .lte('date_start', dateTo);

      if (accountId && accountId !== 'all') {
        q = q.eq('ad_account_id', accountId);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Aggregate by ad_id client-side
      const map = new Map<string, {
        ad_name: string;
        campaign_name: string;
        creative_thumbnail_url: string | null;
        spend: number;
        impressions: number;
        clicks: number;
        leads: number;
      }>();

      for (const row of data ?? []) {
        if (!row.ad_id) continue;
        const existing = map.get(row.ad_id);
        if (existing) {
          existing.spend += row.spend;
          existing.impressions += row.impressions;
          existing.clicks += row.clicks;
          existing.leads += row.leads;
          // Keep latest thumbnail
          if (row.creative_thumbnail_url) {
            existing.creative_thumbnail_url = row.creative_thumbnail_url;
          }
        } else {
          map.set(row.ad_id, {
            ad_name: row.ad_name ?? row.ad_id,
            campaign_name: row.campaign_name,
            creative_thumbnail_url: row.creative_thumbnail_url ?? null,
            spend: row.spend,
            impressions: row.impressions,
            clicks: row.clicks,
            leads: row.leads,
          });
        }
      }

      return Array.from(map.entries()).map(([ad_id, c]) => ({
        ad_id,
        ad_name: c.ad_name,
        campaign_name: c.campaign_name,
        creative_thumbnail_url: c.creative_thumbnail_url,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
        leads: c.leads,
        cpl: c.leads > 0 ? c.spend / c.leads : 0,
      }));
    },
    staleTime: 60_000,
  });
}
