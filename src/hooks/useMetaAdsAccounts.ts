import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetaAdAccount {
  id: string;
  account_id: string;
  account_name: string;
  client_id: string | null;
  is_active: boolean;
}

export function useMetaAdsAccounts() {
  return useQuery({
    queryKey: ['meta-ad-accounts'],
    queryFn: async (): Promise<MetaAdAccount[]> => {
      const { data, error } = await supabase
        .from('meta_ad_accounts')
        .select('id, account_id, account_name, client_id, is_active')
        .eq('is_active', true)
        .order('account_name');

      if (error) throw error;
      return (data ?? []) as MetaAdAccount[];
    },
    staleTime: 5 * 60_000,
  });
}
