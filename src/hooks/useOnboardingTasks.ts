import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTargetAdsManager } from '@/contexts/AdsManagerContext';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { fireCelebration } from '@/lib/confetti';

export interface OnboardingTask {
  id: string;
  client_id: string;
  assigned_to: string;
  task_type: string;
  title: string;
  description: string | null;
  status: 'pending' | 'doing' | 'done';
  due_date: string | null;
  completed_at: string | null;
  milestone: number;
  created_at: string;
  updated_at: string;
  archived?: boolean | null;
  archived_at?: string | null;
  client?: {
    id: string;
    name: string;
    created_at: string;
  };
}

// Fetch all onboarding tasks for the current user (or target user)
export function useOnboardingTasks() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const queryClient = useQueryClient();
  
  const effectiveUserId = targetUserId || user?.id;

  const query = useQuery({
    queryKey: ['onboarding-tasks', effectiveUserId],
    queryFn: async (): Promise<OnboardingTask[]> => {
      let queryBuilder = supabase
        .from('onboarding_tasks')
        .select('*, client:clients(id, name, created_at)')
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false });
      
      if (effectiveUserId) {
        queryBuilder = queryBuilder.eq('assigned_to', effectiveUserId);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return (data || []) as OnboardingTask[];
    },
    enabled: !!effectiveUserId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('onboarding-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'onboarding_tasks',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
          // Also invalidate cards to reflect column changes
          queryClient.invalidateQueries({ queryKey: ['cards'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

// Fetch pending onboarding tasks for a specific client
export function useClientOnboardingTasks(clientId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-onboarding-tasks', clientId],
    queryFn: async (): Promise<OnboardingTask[]> => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('onboarding_tasks')
        .select('*, client:clients(id, name, created_at)')
        .eq('client_id', clientId)
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as OnboardingTask[];
    },
    enabled: !!user && !!clientId,
  });
}

// Update onboarding task status
export function useUpdateOnboardingTaskStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: 'pending' | 'doing' | 'done' }) => {
      const { error } = await supabase
        .from('onboarding_tasks')
        .update({ status })
        .eq('id', taskId);

      if (error) throw error;
      return { taskId, status };
    },
    // Optimistic update - update UI immediately before server response
    onMutate: async ({ taskId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['onboarding-tasks'] });
      
      // Snapshot the previous value - use effectiveUserId for proper cache key
      const previousTasks = queryClient.getQueryData<OnboardingTask[]>(['onboarding-tasks', effectiveUserId]);
      
      // Optimistically update to the new value
      if (previousTasks) {
        queryClient.setQueryData<OnboardingTask[]>(['onboarding-tasks', effectiveUserId], 
          previousTasks.map(task => 
            task.id === taskId ? { ...task, status } : task
          )
        );
      }
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['onboarding-tasks', effectiveUserId], context.previousTasks);
      }
      toast.error('Erro ao atualizar tarefa');
    },
    onSuccess: (result) => {
      const { status } = result;
      if (status === 'done') {
        // Fire confetti celebration! 🎉
        fireCelebration();
        toast.success('🎉 Tarefa concluída! Cliente avançou no onboarding.');
      } else if (status === 'doing') {
        toast.success('Tarefa movida para "Fazendo"');
      } else {
        toast.success('Tarefa movida para "A fazer"');
      }
    },
    onSettled: () => {
      // Sync with server after mutation settles - include effectiveUserId
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
  });
}

// Complete an onboarding task (legacy - for backwards compatibility)
export function useCompleteOnboardingTask() {
  const updateStatus = useUpdateOnboardingTaskStatus();

  return {
    ...updateStatus,
    mutate: (taskId: string) => updateStatus.mutate({ taskId, status: 'done' }),
    mutateAsync: (taskId: string) => updateStatus.mutateAsync({ taskId, status: 'done' }),
  };
}

// Get the current pending task for a client
export function useCurrentClientTask(clientId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['current-client-task', clientId],
    queryFn: async (): Promise<OnboardingTask | null> => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from('onboarding_tasks')
        .select('*, client:clients(id, name, created_at)')
        .eq('client_id', clientId)
        .or('archived.is.null,archived.eq.false')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as OnboardingTask | null;
    },
    enabled: !!user && !!clientId,
  });
}

// Calculate days since client creation
export function getDaysSinceCreation(createdAt: string): number {
  const creationDate = new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - creationDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Task type to human-readable step name
export const TASK_TYPE_LABELS: Record<string, string> = {
  'marcar_call_1': 'Marcar Call 1',
  'realizar_call_1': 'Realizar Call 1',
  'criar_estrategia': 'Criar Estratégia',
  'apresentar_estrategia': 'Apresentar Estratégia',
  'brifar_criativos': 'Brifar Criativos',
  'aguardar_criativos': 'Aguardar Criativos',
  'publicar_campanha': 'Publicar Campanha',
};

// Onboarding step to column name mapping
export const STEP_TO_COLUMN: Record<string, string> = {
  'marcar_call_1': 'Novo Cliente',
  'call_1_marcada': 'Call 1 Marcada',
  'realizar_call_1': 'Call 1 Marcada',
  'call_1_realizada': 'Call 1 Realizada',
  'criar_estrategia': 'Call 1 Realizada',
  'estrategia_criada': 'Estratégia Criada',
  'apresentar_estrategia': 'Estratégia Criada',
  'estrategia_apresentada': 'Estratégia Apresentada',
  'brifar_criativos': 'Estratégia Apresentada',
  'criativos_brifados': 'Criativos Brifados',
  'aguardar_criativos': 'Criativos Brifados',
  'criativos_prontos': 'Criativos Prontos',
  'publicar_campanha': 'Criativos Prontos',
  'campanha_publicada': 'Campanha Publicada',
};

// Archive an onboarding task
export function useArchiveOnboardingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('onboarding_tasks')
        .update({ 
          archived: true, 
          archived_at: new Date().toISOString() 
        })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tarefa arquivada!');
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding-tasks'] });
    },
    onError: () => {
      toast.error('Erro ao arquivar tarefa');
    },
  });
}

// Unarchive an onboarding task
export function useUnarchiveOnboardingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('onboarding_tasks')
        .update({ 
          archived: false, 
          archived_at: null 
        })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tarefa desarquivada!');
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding-tasks'] });
    },
    onError: () => {
      toast.error('Erro ao desarquivar tarefa');
    },
  });
}

// Fetch archived onboarding tasks - filtered by target manager
export function useArchivedOnboardingTasks() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const effectiveUserId = targetUserId || user?.id;

  return useQuery({
    queryKey: ['archived-onboarding-tasks', effectiveUserId],
    queryFn: async (): Promise<OnboardingTask[]> => {
      if (!effectiveUserId) return [];
      
      const { data, error } = await supabase
        .from('onboarding_tasks')
        .select('*, client:clients(id, name, created_at)')
        .eq('archived', true)
        .eq('assigned_to', effectiveUserId)
        .order('archived_at', { ascending: false });

      if (error) throw error;
      return (data || []) as OnboardingTask[];
    },
    enabled: !!effectiveUserId,
  });
}

// Delete an onboarding task permanently
export function useDeleteOnboardingTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('onboarding_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tarefa excluída!');
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding-tasks'] });
    },
    onError: () => {
      toast.error('Erro ao excluir tarefa');
    },
  });
}

// Check if user can archive/unarchive tasks
export function useCanArchiveTasks() {
  const { user, isCEO } = useAuth();
  // Only CEO and gestor_projetos can archive/unarchive
  return isCEO || user?.role === 'gestor_projetos';
}
