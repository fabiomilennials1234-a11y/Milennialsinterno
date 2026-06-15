import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetaAdAccount {
  id: string;
  account_id: string;
  account_name: string;
  client_id: string | null;
  is_active: boolean;
  sync_policy: 'cron' | 'on_demand';
  is_principal: boolean;
}

/**
 * Default account for the UI selector: the principal account's id, or the
 * 'all' sentinel when no principal exists (e.g. before the migration ran, or
 * if the principal was deleted). Pure so it can be unit-tested without React.
 */
export function resolveDefaultAccountId(accounts: Pick<MetaAdAccount, 'account_id' | 'is_principal'>[]): string {
  return accounts.find(a => a.is_principal)?.account_id ?? 'all';
}

export function useMetaAdsAccounts() {
  return useQuery({
    queryKey: ['meta-ad-accounts'],
    queryFn: async (): Promise<MetaAdAccount[]> => {
      const { data, error } = await supabase
        .from('meta_ad_accounts')
        .select('id, account_id, account_name, client_id, is_active, sync_policy, is_principal')
        // Principal first (it's the UI default), then alphabetical.
        .eq('is_active', true)
        .order('is_principal', { ascending: false })
        .order('account_name');

      if (error) throw error;
      return (data ?? []) as MetaAdAccount[];
    },
    staleTime: 5 * 60_000,
  });
}
