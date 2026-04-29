import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOutboundManagerBoards, type OutboundManagerBoard } from './useOutboundManagerBoards';

export interface OutboundDashboardData {
  totalActive: number;
  totalOnboarding: number;
  totalChurns: number;
  mrrOutbound: number;
  avgOnboardingDays: number;
  totalTasksDoneToday: number;
  totalMeetingsThisMonth: number;
  totalDocsToday: number;
  funnelData: { milestone: string; count: number; color: string }[];
  statusData: { name: string; value: number; color: string }[];
  managerPerformance: {
    name: string;
    activeClients: number;
    onboardingClients: number;
    tasksDone: number;
    docsToday: number;
  }[];
  monthlyEvolution: { mes: string; entradas: number; churns: number; ativos: number }[];
  managers: OutboundManagerBoard[];
}

type RpcError = { message: string };
type RpcClient = {
  rpc: <T>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError | null }>;
};
const rpcClient = supabase as unknown as RpcClient;

type Aggregated = Omit<OutboundDashboardData, 'managers'>;

export function useOutboundDashboard(selectedManagerId: string | null) {
  const { data: managers = [] } = useOutboundManagerBoards();

  return useQuery({
    queryKey: ['outbound-dashboard', selectedManagerId],
    queryFn: async (): Promise<OutboundDashboardData> => {
      const { data, error } = await rpcClient.rpc<Aggregated>('get_outbound_dashboard', {
        _manager_id: selectedManagerId,
      });
      if (error) throw error;
      if (!data) throw new Error('RPC get_outbound_dashboard retornou vazio');
      return { ...data, managers };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
