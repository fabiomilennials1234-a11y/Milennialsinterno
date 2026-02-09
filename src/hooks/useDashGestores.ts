import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GestorStats {
  id: string;
  name: string;
  avatar: string | null;
  clientCounts: {
    otimo: number;
    bom: number;
    medio: number;
    ruim: number;
  };
  churnCount: number;
  documentedYesterday: boolean;
}

interface ProfileRow {
  user_id: string;
  name: string | null;
  avatar: string | null;
}

interface ClientRow {
  id: string;
  assigned_ads_manager: string | null;
  client_label: string | null;
}

interface ChurnRow {
  id: string;
  assigned_ads_manager: string | null;
}

interface DocRow {
  ads_manager_id: string;
}

async function fetchGestores(): Promise<ProfileRow[]> {
  const result = await (supabase.from('profiles') as any).select('user_id, name, avatar').eq('role', 'gestor_ads');
  if (result.error) throw result.error;
  return result.data || [];
}

async function fetchClients(): Promise<ClientRow[]> {
  const result = await (supabase.from('clients') as any).select('id, assigned_ads_manager, client_label').eq('archived', false);
  if (result.error) throw result.error;
  return result.data || [];
}

async function fetchChurns(): Promise<ChurnRow[]> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const result = await (supabase.from('clients') as any).select('id, assigned_ads_manager').eq('status', 'churned').gte('archived_at', startOfMonth.toISOString());
  return result.data || [];
}

async function fetchDocumentation(): Promise<Set<string>> {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const result = await (supabase.from('client_daily_tracking') as any).select('ads_manager_id').gte('last_moved_at', yesterday);
  return new Set((result.data || []).map((d: DocRow) => d.ads_manager_id));
}

export function useDashGestores() {
  return useQuery({
    queryKey: ['dash-gestores-stats'],
    queryFn: async (): Promise<GestorStats[]> => {
      const [gestores, clients, churns, documentedManagers] = await Promise.all([
        fetchGestores(),
        fetchClients(),
        fetchChurns(),
        fetchDocumentation()
      ]);

      const labelCategories: Record<string, 'otimo' | 'bom' | 'medio' | 'ruim'> = {
        'otimo': 'otimo', 'bom': 'bom', 'medio': 'medio', 'ruim': 'ruim',
        'green': 'otimo', 'blue': 'bom', 'yellow': 'medio', 'orange': 'medio', 'red': 'ruim',
      };

      return gestores.map(gestor => {
        const gestorClients = clients.filter(c => c.assigned_ads_manager === gestor.user_id);
        const clientCounts = { otimo: 0, bom: 0, medio: 0, ruim: 0 };

        for (const client of gestorClients) {
          const label = client.client_label?.toLowerCase();
          clientCounts[label && labelCategories[label] ? labelCategories[label] : 'medio']++;
        }

        return {
          id: gestor.user_id,
          name: gestor.name || 'Gestor',
          avatar: gestor.avatar,
          clientCounts,
          churnCount: churns.filter(c => c.assigned_ads_manager === gestor.user_id).length,
          documentedYesterday: documentedManagers.has(gestor.user_id),
        };
      });
    },
    staleTime: 30000,
  });
}

export function useWeeklyProblemsStats() {
  return useQuery({
    queryKey: ['weekly-problems-stats'],
    queryFn: async () => {
      const { data: problems, error } = await supabase
        .from('weekly_problems')
        .select('*')
        .eq('archived', false);

      if (error) throw error;

      const problemCounts: Record<string, number> = {};
      const challengeCounts: Record<string, number> = {};

      for (const problem of problems || []) {
        const type = problem.problem_type || 'outros';
        problemCounts[type] = (problemCounts[type] || 0) + 1;
        if (type === 'challenge' && problem.problem_text) {
          challengeCounts[problem.problem_text] = (challengeCounts[problem.problem_text] || 0) + 1;
        }
      }

      const topChallenges = Object.entries(challengeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([text, count]) => ({ text, count }));

      return {
        total: problems?.length || 0,
        byType: problemCounts,
        topChallenges,
        problems: problems || [],
      };
    },
    staleTime: 30000,
  });
}
