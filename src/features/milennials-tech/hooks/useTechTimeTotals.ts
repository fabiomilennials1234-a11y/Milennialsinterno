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
      const { data, error } = await supabase.rpc('tech_get_time_totals');
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of (data as TimeTotalRow[])) {
        if (row.total_seconds > 0) {
          map[row.task_id] = row.total_seconds;
        }
      }
      return map;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function formatTimeTotal(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
