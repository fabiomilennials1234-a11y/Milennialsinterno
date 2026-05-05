import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CEOStats {
  // Overview
  totalTeamMembers: number;
  totalGroups: number;
  totalSquads: number;

  // Performance metrics
  overallCompletionRate: number;
  tasksCompletedThisWeek: number;
  tasksCreatedThisWeek: number;
  avgTaskCompletionTime: number; // in days

  // Bottlenecks
  bottlenecks: {
    area: string;
    overdueCount: number;
    oldestOverdueDays: number;
  }[];

  // Squad Performance
  squadPerformance: {
    squadName: string;
    groupName: string;
    completionRate: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
  }[];

  // Commercial performance (placeholder)
  commercialMetrics: {
    newLeads: number;
    closedDeals: number;
    conversionRate: number;
  };

  // Operational status
  operationalStatus: {
    healthy: number;
    attention: number;
    critical: number;
  };
}

export function useCEOStats() {
  return useQuery({
    queryKey: ['ceo-stats'],
    queryFn: async (): Promise<CEOStats> => {
      const { data, error } = await supabase.rpc('get_ceo_stats');
      if (error) throw error;
      return data as unknown as CEOStats;
    },
    refetchInterval: 300_000,
    staleTime: 60_000,
  });
}
