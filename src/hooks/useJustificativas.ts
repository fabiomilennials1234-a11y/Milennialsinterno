import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PendenteItem {
  notification_id: string;
  task_id: string;
  task_table: string;
  task_title: string;
  task_due_date: string;
  task_owner_id: string;
  task_owner_name: string;
  task_owner_role: string;
  master_comment: string | null;
  requires_revision: boolean;
  created_at: string;
}

export interface DoneItem {
  justification_id: string;
  notification_id: string;
  task_id: string;
  task_table: string;
  task_title: string;
  task_due_date: string;
  justification: string;
  master_comment: string | null;
  master_comment_at: string | null;
  created_at: string;
}

export interface TeamItem {
  user_id: string;
  user_name: string;
  user_role: string;
  notification_id: string;
  task_id: string;
  task_table: string;
  task_title: string;
  task_due_date: string;
  justification_id: string | null;
  justification_text: string | null;
  master_comment: string | null;
  requires_revision: boolean;
  archived: boolean;
  created_at: string;
}

const COMMON_QUERY_OPTS = {
  refetchOnWindowFocus: true,
  refetchInterval: 30_000,
  staleTime: 15_000,
};

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['justif-pending-mine'] });
  qc.invalidateQueries({ queryKey: ['justif-done-mine'] });
  qc.invalidateQueries({ queryKey: ['justif-team'] });
}

export function useJustificativasPendentes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['justif-pending-mine', user?.id],
    queryFn: async (): Promise<PendenteItem[]> => {
      const { data, error } = await supabase.rpc('get_justifications_pending_mine');
      if (error) throw error;
      return (data ?? []) as PendenteItem[];
    },
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTS,
  });
}

export function useJustificativasCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['justif-pending-mine', user?.id, 'count'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_justifications_pending_mine');
      if (error) throw error;
      return (data ?? []).length;
    },
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTS,
  });
}

export function useJustificativasDoneMine() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['justif-done-mine', user?.id],
    queryFn: async (): Promise<DoneItem[]> => {
      const { data, error } = await supabase.rpc('get_justifications_done_mine');
      if (error) throw error;
      return (data ?? []) as DoneItem[];
    },
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTS,
  });
}

export function useJustificativasTeam(onlyPending = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['justif-team', user?.id, onlyPending],
    queryFn: async (): Promise<TeamItem[]> => {
      const { data, error } = await supabase.rpc('get_justifications_team_grouped', {
        p_only_pending: onlyPending,
      });
      if (error) throw error;
      return (data ?? []) as TeamItem[];
    },
    enabled: !!user?.id,
    ...COMMON_QUERY_OPTS,
  });
}

export function useSubmitJustificativa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ notificationId, text }: { notificationId: string; text: string }) => {
      const { data, error } = await supabase.rpc('submit_justification', {
        p_notification_id: notificationId,
        p_text: text,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Justificativa enviada');
    },
    onError: (e: any) => toast.error('Erro ao enviar', { description: e.message }),
  });
}

export function useRequestRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ justificationId, comment }: { justificationId: string; comment: string }) => {
      const { error } = await supabase.rpc('request_justification_revision', {
        p_justification_id: justificationId,
        p_comment: comment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Revisão solicitada');
    },
    onError: (e: any) => toast.error('Erro', { description: e.message }),
  });
}

export function useNudgeUser() {
  return useMutation({
    mutationFn: async ({ notificationId }: { notificationId: string }) => {
      const { error } = await supabase.rpc('nudge_user_for_justification', {
        p_notification_id: notificationId,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Cobrança enviada'),
    onError: (e: any) => toast.error('Erro ao cobrar', { description: e.message }),
  });
}

export function useArchiveJustification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase.rpc(
        archive ? 'archive_justification' : 'unarchive_justification',
        { p_id: id },
      );
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
    onError: (e: any) => toast.error('Erro', { description: e.message }),
  });
}
