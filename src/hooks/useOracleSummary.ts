import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OracleSummary {
  id: string;
  summary_type: 'group' | 'individual';
  group_id: string | null;
  user_id: string | null;
  reference_date: string;
  summary_content: string;
  model_used: string;
  tokens_used: number | null;
  created_at: string;
}

/**
 * Busca o resumo oráculo mais recente.
 *
 * Para grupo:      useOracleSummary('group', groupId)
 * Para individual: useOracleSummary('individual', undefined, userId)
 *
 * RLS garante que só dados permitidos retornam.
 */
export function useOracleSummary(
  type: 'group' | 'individual',
  groupId?: string | null,
  userId?: string | null
) {
  const enabled =
    (type === 'group' && !!groupId) ||
    (type === 'individual' && !!userId);

  return useQuery<OracleSummary | null>({
    queryKey: ['oracle-summary', type, groupId, userId],
    queryFn: async () => {
      let query = supabase
        .from('oracle_summaries')
        .select('id, summary_type, group_id, user_id, reference_date, summary_content, model_used, tokens_used, created_at')
        .eq('summary_type', type)
        .neq('summary_content', '')
        .order('reference_date', { ascending: false })
        .limit(1);

      if (type === 'group' && groupId) {
        query = query.eq('group_id', groupId);
      } else if (type === 'individual' && userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('[useOracleSummary] Error:', error);
        throw error;
      }

      return (data as OracleSummary) || null;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5min — summaries are daily, no need to refetch often
    refetchOnWindowFocus: false,
  });
}
