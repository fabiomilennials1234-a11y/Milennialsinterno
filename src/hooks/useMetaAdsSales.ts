import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetaAdsSale {
  id: string;
  ad_account_id: string;
  campaign_id: string;
  campaign_name: string;
  sale_date: string;
  num_sales: number;
  sales_value: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useMetaAdsSales(params: {
  dateFrom: string;
  dateTo: string;
  accountId?: string;
}) {
  const { dateFrom, dateTo, accountId } = params;

  return useQuery({
    queryKey: ['meta-ads-sales', dateFrom, dateTo, accountId],
    queryFn: async (): Promise<MetaAdsSale[]> => {
      let q = supabase
        .from('meta_ads_manual_sales')
        .select('*')
        .gte('sale_date', dateFrom)
        .lte('sale_date', dateTo)
        .order('sale_date', { ascending: false });

      if (accountId && accountId !== 'all') {
        q = q.eq('ad_account_id', accountId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MetaAdsSale[];
    },
    staleTime: 60_000,
  });
}
