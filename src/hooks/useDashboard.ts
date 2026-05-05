import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface DashboardStats {
  totalCards: number;
  completedCards: number;
  inProgressCards: number;
  overdueCards: number;
  boardStats: {
    boardId: string;
    boardName: string;
    boardSlug: string;
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  }[];
  recentActivity: RecentActivity[];
  priorityDistribution: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
}

export interface RecentActivity {
  id: string;
  action: string;
  cardTitle: string;
  userName: string;
  createdAt: string;
  details?: {
    from?: string;
    to?: string;
    title?: string;
    from_column?: string;
    to_column?: string;
    from_status?: string;
    to_status?: string;
  };
}

export function useDashboardStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw error;
      return data as unknown as DashboardStats;
    },
    staleTime: 30_000,
  });

  // Real-time subscription for cards changes
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kanban_cards' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'card_activities' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
