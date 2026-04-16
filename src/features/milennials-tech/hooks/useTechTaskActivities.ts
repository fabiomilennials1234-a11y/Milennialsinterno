import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TechTaskActivity } from '../types';

export function useTechTaskActivities(taskId: string) {
  return useQuery<TechTaskActivity[]>({
    queryKey: ['tech', 'activities', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tech_task_activities')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });
}
