import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Lista DISTINCT configs atrasadas envolvendo o user logado (RLS já filtra:
// usuário envolvido OR is_ceo). Pega via embed em crm_configuracoes para
// evitar N+1 (joins acontecem na mesma round-trip).
//
// `delayed_days` calculado no client a partir de `crm_configuracoes.created_at`
// + deadline do produto (mesma lógica do useCrmKanban.CRM_CONFIG_DEADLINE_DAYS).

const PRODUTO_DEADLINE_DAYS: Record<string, number> = {
  v8: 7,
  automation: 7,
  copilot: 10,
};

export interface DelayedConfigSummary {
  config_id: string;
  client_id: string;
  client_name: string;
  produto: string;
  detected_at: string;
  delayed_days: number;
}

interface PendingRowEmbedded {
  config_id: string;
  client_id: string;
  detected_at: string;
  crm_configuracoes: {
    produto: string | null;
    created_at: string | null;
    clients: {
      name: string | null;
    } | null;
  } | null;
}

function calcDelayedDays(createdAt: string | null, produto: string | null): number {
  if (!createdAt) return 0;
  const deadline = PRODUTO_DEADLINE_DAYS[produto ?? ''] ?? 7;
  const dueMs = new Date(createdAt).getTime() + deadline * 86_400_000;
  const days = Math.floor((Date.now() - dueMs) / 86_400_000);
  return Math.max(0, days);
}

export function useAllCrmDelayedConfigs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-crm-delayed-configs', user?.id],
    queryFn: async (): Promise<DelayedConfigSummary[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('crm_delay_justification_pending')
        .select(
          'config_id, client_id, detected_at, crm_configuracoes(produto, created_at, clients(name))',
        )
        .order('detected_at', { ascending: false });

      if (error) throw error;

      const seen = new Set<string>();
      const out: DelayedConfigSummary[] = [];
      for (const row of (data || []) as PendingRowEmbedded[]) {
        if (seen.has(row.config_id)) continue;
        seen.add(row.config_id);
        const produto = row.crm_configuracoes?.produto ?? 'unknown';
        const createdAt = row.crm_configuracoes?.created_at ?? null;
        out.push({
          config_id: row.config_id,
          client_id: row.client_id,
          client_name: row.crm_configuracoes?.clients?.name ?? 'Cliente',
          produto,
          detected_at: row.detected_at,
          delayed_days: calcDelayedDays(createdAt, produto),
        });
      }
      return out;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}
