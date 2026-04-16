import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TechTimeEntry } from '../types';

interface ActiveTimerState {
  activeTaskId: string | null;
  elapsed: number;
}

export function useActiveTimer(): ActiveTimerState {
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: lastEntry } = useQuery<TechTimeEntry | null>({
    queryKey: ['tech', 'activeTimer'],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('tech_time_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: !!user?.id,
  });

  const isActive =
    lastEntry?.type === 'START' || lastEntry?.type === 'RESUME';

  const activeTaskId = isActive ? lastEntry!.task_id : null;

  // Compute the initial elapsed offset from the last entry timestamp
  useEffect(() => {
    if (isActive && lastEntry) {
      const startMs = new Date(lastEntry.created_at).getTime();
      const nowMs = Date.now();
      setElapsed(Math.floor((nowMs - startMs) / 1000));
    } else {
      setElapsed(0);
    }
  }, [isActive, lastEntry]);

  // Tick every second while active
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  return { activeTaskId, elapsed };
}
