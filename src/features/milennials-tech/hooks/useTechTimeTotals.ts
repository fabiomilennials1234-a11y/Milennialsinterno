import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TimeTotalRow {
  task_id: string;
  total_seconds: number;
}

export function useTechTimeTotals() {
  return useQuery<Record<string, number>>({
    queryKey: ['tech', 'timeTotals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tech_task_time_totals')
        .select('task_id, total_seconds');
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data as TimeTotalRow[])) {
        map[row.task_id] = row.total_seconds;
      }
      return map;
    },
    staleTime: 10_000,
    refetchInterval: 30_000, // refresh every 30s to update running timers
  });
}

export function formatTimeTotal(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  return `${m}m`;
}
