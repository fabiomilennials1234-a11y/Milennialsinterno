import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProfessionalStats {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  pendingTasks: number;
  completedToday: number;
  delayedTasks: number;
  clientCounts?: {
    otimo: number;
    bom: number;
    medio: number;
    ruim: number;
    onboarding: number;
    total: number;
  } | null;
}

interface TVDashboardPayload {
  all: ProfessionalStats[];
}

type RpcError = { message: string };
type RpcClient = {
  rpc: <T>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError | null }>;
};
const rpcClient = supabase as unknown as RpcClient;

export function useTVDashboardStats() {
  return useQuery({
    queryKey: ['tv-dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await rpcClient.rpc<TVDashboardPayload>('get_tv_dashboard_stats');
      if (error) throw error;
      const all = data?.all ?? [];

      return {
        designers:    all.filter(s => s.role === 'design'),
        editors:      all.filter(s => s.role === 'editor_video'),
        comercial:    all.filter(s => s.role === 'consultor_comercial'),
        devs:         all.filter(s => s.role === 'devs'),
        gestoresAds:  all.filter(s => s.role === 'gestor_ads'),
        all,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
