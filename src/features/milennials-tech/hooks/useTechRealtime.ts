import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTechRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('tech-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tech_tasks' },
        () => {
          qc.invalidateQueries({ queryKey: ['tech', 'tasks'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tech_sprints' },
        () => {
          qc.invalidateQueries({ queryKey: ['tech', 'sprints'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tech_time_entries' },
        () => {
          qc.invalidateQueries({ queryKey: ['tech', 'timer'] });
          qc.invalidateQueries({ queryKey: ['tech', 'activeTimer'] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tech_task_activities' },
        () => {
          qc.invalidateQueries({ queryKey: ['tech', 'activities'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
