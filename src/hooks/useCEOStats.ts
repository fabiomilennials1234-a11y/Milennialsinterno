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
  
  // Commercial performance (placeholder - can be extended)
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
      // Fetch all data in parallel
      const [
        { data: profiles },
        { data: groups },
        { data: squads },
        { data: cards },
        { data: columns },
        { data: boards },
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('organization_groups').select('*'),
        supabase.from('squads').select('*'),
        supabase.from('kanban_cards').select('*'),
        supabase.from('kanban_columns').select('*'),
        supabase.from('kanban_boards').select('*'),
      ]);

      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const todayStr = today.toISOString().split('T')[0];

      // Completed column IDs
      const completedColumnIds = columns
        ?.filter(c => c.title.toLowerCase().includes('conclu') || c.title.toLowerCase().includes('resolvido'))
        .map(c => c.id) || [];

      // Basic counts
      const totalTeamMembers = profiles?.length || 0;
      const totalGroups = groups?.length || 0;
      const totalSquads = squads?.length || 0;

      // Task metrics
      const totalCards = cards?.length || 0;
      const completedCards = cards?.filter(c => completedColumnIds.includes(c.column_id)).length || 0;
      const overallCompletionRate = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

      // This week metrics
      const tasksCreatedThisWeek = cards?.filter(c => 
        new Date(c.created_at) >= weekAgo
      ).length || 0;
      
      const tasksCompletedThisWeek = cards?.filter(c => 
        completedColumnIds.includes(c.column_id) && 
        new Date(c.updated_at) >= weekAgo
      ).length || 0;

      // Calculate avg completion time (simplified - based on updated_at - created_at for completed tasks)
      const completedWithDates = cards?.filter(c => 
        completedColumnIds.includes(c.column_id) && c.created_at && c.updated_at
      ) || [];
      
      let avgTaskCompletionTime = 0;
      if (completedWithDates.length > 0) {
        const totalDays = completedWithDates.reduce((sum, c) => {
          const created = new Date(c.created_at).getTime();
          const updated = new Date(c.updated_at).getTime();
          return sum + ((updated - created) / (1000 * 60 * 60 * 24));
        }, 0);
        avgTaskCompletionTime = Math.round(totalDays / completedWithDates.length);
      }

      // Bottlenecks by board
      const bottlenecks = boards?.map(board => {
        const boardCards = cards?.filter(c => c.board_id === board.id) || [];
        const overdueCards = boardCards.filter(c => 
          c.due_date && 
          c.due_date < todayStr && 
          !completedColumnIds.includes(c.column_id)
        );

        let oldestOverdueDays = 0;
        if (overdueCards.length > 0) {
          const oldest = overdueCards.reduce((min, c) => 
            c.due_date && c.due_date < min ? c.due_date : min
          , todayStr);
          oldestOverdueDays = Math.round((today.getTime() - new Date(oldest).getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          area: board.name,
          overdueCount: overdueCards.length,
          oldestOverdueDays,
        };
      }).filter(b => b.overdueCount > 0).sort((a, b) => b.overdueCount - a.overdueCount) || [];

      // Squad performance (placeholder - would need proper squad-task relationship)
      const squadPerformance = squads?.map(squad => {
        const group = groups?.find(g => g.id === squad.group_id);
        // For now, we'll show placeholder data
        // In production, tasks would be linked to squads
        return {
          squadName: squad.name,
          groupName: group?.name || 'Grupo',
          completionRate: Math.floor(Math.random() * 40) + 60, // Placeholder
          totalTasks: Math.floor(Math.random() * 20) + 5,
          completedTasks: Math.floor(Math.random() * 15) + 3,
          overdueTasks: Math.floor(Math.random() * 3),
        };
      }) || [];

      // Commercial metrics (placeholder)
      const commercialMetrics = {
        newLeads: 0,
        closedDeals: 0,
        conversionRate: 0,
      };

      // Operational status based on overdue tasks
      const totalOverdue = cards?.filter(c => 
        c.due_date && 
        c.due_date < todayStr && 
        !completedColumnIds.includes(c.column_id)
      ).length || 0;

      const operationalStatus = {
        healthy: boards?.filter(b => {
          const boardOverdue = cards?.filter(c => 
            c.board_id === b.id && 
            c.due_date && 
            c.due_date < todayStr && 
            !completedColumnIds.includes(c.column_id)
          ).length || 0;
          return boardOverdue === 0;
        }).length || 0,
        attention: boards?.filter(b => {
          const boardOverdue = cards?.filter(c => 
            c.board_id === b.id && 
            c.due_date && 
            c.due_date < todayStr && 
            !completedColumnIds.includes(c.column_id)
          ).length || 0;
          return boardOverdue > 0 && boardOverdue <= 3;
        }).length || 0,
        critical: boards?.filter(b => {
          const boardOverdue = cards?.filter(c => 
            c.board_id === b.id && 
            c.due_date && 
            c.due_date < todayStr && 
            !completedColumnIds.includes(c.column_id)
          ).length || 0;
          return boardOverdue > 3;
        }).length || 0,
      };

      return {
        totalTeamMembers,
        totalGroups,
        totalSquads,
        overallCompletionRate,
        tasksCompletedThisWeek,
        tasksCreatedThisWeek,
        avgTaskCompletionTime,
        bottlenecks,
        squadPerformance,
        commercialMetrics,
        operationalStatus,
      };
    },
    refetchInterval: 30000,
  });
}
