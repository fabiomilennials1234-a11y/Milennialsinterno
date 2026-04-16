import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTechTimer() {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tech', 'tasks'] });
    qc.invalidateQueries({ queryKey: ['tech', 'activeTimer'] });
    qc.invalidateQueries({ queryKey: ['tech', 'activities'] });
    qc.invalidateQueries({ queryKey: ['tech', 'timeTotals'] });
  };

  const start = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_start_timer', { _task_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const pause = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_pause_timer', { _task_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const resume = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_resume_timer', { _task_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const stop = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_stop_timer', { _task_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const sendToReview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_send_to_review', { _task_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_approve_task', { _task_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_reject_task', { _task_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const block = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('tech_block_task', {
        _task_id: id,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const unblock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_unblock_task', { _task_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { start, pause, resume, stop, sendToReview, approve, reject, block, unblock };
}
