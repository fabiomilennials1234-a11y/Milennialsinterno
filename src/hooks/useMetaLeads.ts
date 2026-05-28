import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetaLead {
  id: string;
  lead_id: string;
  ad_account_id: string;
  form_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  ad_id: string | null;
  ad_name: string | null;
  created_time: string | null;
  field_data: unknown;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export function useMetaLeads(params: {
  dateFrom: string;
  dateTo: string;
  accountId?: string;
  campaignId?: string;
  adId?: string;
}) {
  const { dateFrom, dateTo, accountId, campaignId, adId } = params;

  return useQuery({
    queryKey: ['meta-leads', dateFrom, dateTo, accountId, campaignId, adId],
    queryFn: async (): Promise<MetaLead[]> => {
      let q = supabase
        .from('meta_leads')
        .select('*')
        .gte('created_time', `${dateFrom}T00:00:00`)
        .lte('created_time', `${dateTo}T23:59:59`)
        .order('created_time', { ascending: false });

      if (accountId && accountId !== 'all') {
        q = q.eq('ad_account_id', accountId);
      }
      if (campaignId) {
        q = q.eq('campaign_id', campaignId);
      }
      if (adId) {
        q = q.eq('ad_id', adId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MetaLead[];
    },
    staleTime: 60_000,
  });
}
