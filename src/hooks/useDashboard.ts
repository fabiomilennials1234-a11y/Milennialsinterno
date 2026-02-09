import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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
      // Fetch all cards
      const { data: cards, error: cardsError } = await supabase
        .from('kanban_cards')
        .select('*, kanban_columns!inner(title)');

      if (cardsError) throw cardsError;

      // Fetch all boards
      const { data: boards, error: boardsError } = await supabase
        .from('kanban_boards')
        .select('*');

      if (boardsError) throw boardsError;

      // Fetch columns to identify completed ones
      const { data: columns, error: columnsError } = await supabase
        .from('kanban_columns')
        .select('*');

      if (columnsError) throw columnsError;

      // Get completed column IDs (columns named "Concluído")
      const completedColumnIds = columns
        ?.filter(c => c.title.toLowerCase().includes('conclu'))
        .map(c => c.id) || [];

      // Get in-progress column IDs
      const inProgressColumnIds = columns
        ?.filter(c => c.title.toLowerCase().includes('progresso'))
        .map(c => c.id) || [];

      const today = new Date().toISOString().split('T')[0];

      const totalCards = cards?.length || 0;
      const completedCards = cards?.filter(c => completedColumnIds.includes(c.column_id)).length || 0;
      const inProgressCards = cards?.filter(c => inProgressColumnIds.includes(c.column_id)).length || 0;
      const overdueCards = cards?.filter(c => 
        c.due_date && 
        c.due_date < today && 
        !completedColumnIds.includes(c.column_id)
      ).length || 0;

      // Stats per board
      const boardStats = boards?.map(board => {
        const boardCards = cards?.filter(c => c.board_id === board.id) || [];
        const boardCompletedIds = columns
          ?.filter(c => c.board_id === board.id && c.title.toLowerCase().includes('conclu'))
          .map(c => c.id) || [];
        const boardInProgressIds = columns
          ?.filter(c => c.board_id === board.id && c.title.toLowerCase().includes('progresso'))
          .map(c => c.id) || [];

        return {
          boardId: board.id,
          boardName: board.name,
          boardSlug: board.slug,
          total: boardCards.length,
          completed: boardCards.filter(c => boardCompletedIds.includes(c.column_id)).length,
          inProgress: boardCards.filter(c => boardInProgressIds.includes(c.column_id)).length,
          overdue: boardCards.filter(c => 
            c.due_date && 
            c.due_date < today && 
            !boardCompletedIds.includes(c.column_id)
          ).length,
        };
      }) || [];

      // Priority distribution
      const priorityDistribution = {
        low: cards?.filter(c => c.priority === 'low').length || 0,
        medium: cards?.filter(c => c.priority === 'medium').length || 0,
        high: cards?.filter(c => c.priority === 'high').length || 0,
        urgent: cards?.filter(c => c.priority === 'urgent').length || 0,
      };

      // Recent activity - fetch separately with proper joins
      const { data: activities } = await supabase
        .from('card_activities')
        .select('id, action, card_id, user_id, created_at, details')
        .order('created_at', { ascending: false })
        .limit(10);

      let recentActivity: RecentActivity[] = [];

      if (activities && activities.length > 0) {
        // Fetch card titles
        const cardIds = [...new Set(activities.map(a => a.card_id))];
        const { data: cardsData } = await supabase
          .from('kanban_cards')
          .select('id, title')
          .in('id', cardIds);
        
        const cardTitles = cardsData?.reduce((acc, c) => ({ ...acc, [c.id]: c.title }), {} as Record<string, string>) || {};

        // Fetch user names
        const userIds = [...new Set(activities.map(a => a.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);
        
        const userNames = profilesData?.reduce((acc, p) => ({ ...acc, [p.user_id]: p.name }), {} as Record<string, string>) || {};

        recentActivity = activities.map(a => ({
          id: a.id,
          action: a.action,
          cardTitle: cardTitles[a.card_id] || 'Card removido',
          userName: userNames[a.user_id] || 'Usuário',
          createdAt: a.created_at,
          details: a.details as RecentActivity['details'],
        }));
      }

      return {
        totalCards,
        completedCards,
        inProgressCards,
        overdueCards,
        boardStats,
        recentActivity,
        priorityDistribution,
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
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
