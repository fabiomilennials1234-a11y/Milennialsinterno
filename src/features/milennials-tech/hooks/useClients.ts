import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TechClientOption {
  id: string;
  name: string;
}

/**
 * Lightweight client list for dropdowns (id + name only).
 * Excludes archived clients.
 */
export function useTechClients() {
  return useQuery<TechClientOption[]>({
    queryKey: ['tech', 'clients-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .neq('archived', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}
