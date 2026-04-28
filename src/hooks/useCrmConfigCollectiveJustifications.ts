import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Wrapper sobre RPC `get_crm_config_collective_justifications`.
// RPC retorna até 4 rows (uma por papel envolvido). Auth: user envolvido OR is_ceo
// — caso contrário a RPC raise exception (tratada via React Query error).
//
// Nomenclatura: a RPC devolve coluna `justification`. Renomeamos para
// `justification_text` na superfície do hook para alinhar com a semântica
// do componente (UI consome `justification_text`).

export interface CollectiveJustification {
  pending_id: string;
  user_id: string;
  user_role: string;
  user_name: string;
  justification_text: string | null;
  justified_at: string | null;
  detected_at: string;
  is_pending: boolean;
}

interface RpcRow {
  pending_id: string;
  user_id: string;
  user_role: string;
  user_name: string;
  justification: string | null;
  justified_at: string | null;
  detected_at: string;
  is_pending: boolean;
}

export function useCrmConfigCollectiveJustifications(configId: string | null) {
  return useQuery({
    queryKey: ['crm-config-collective-justifications', configId],
    queryFn: async (): Promise<CollectiveJustification[]> => {
      if (!configId) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        'get_crm_config_collective_justifications',
        { p_config_id: configId },
      );
      if (error) throw error;
      return ((data || []) as RpcRow[]).map(r => ({
        pending_id: r.pending_id,
        user_id: r.user_id,
        user_role: r.user_role,
        user_name: r.user_name,
        justification_text: r.justification,
        justified_at: r.justified_at,
        detected_at: r.detected_at,
        is_pending: r.is_pending,
      }));
    },
    enabled: !!configId,
    staleTime: 30 * 1000,
  });
}
