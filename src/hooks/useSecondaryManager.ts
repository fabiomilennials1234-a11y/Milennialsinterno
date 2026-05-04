import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SecondaryManagerRecord {
  id: string;
  client_id: string;
  secondary_manager_id: string;
  phase: 'onboarding' | 'acompanhamento';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useSecondaryManager(clientId: string | undefined) {
  return useQuery({
    queryKey: ['secondary-manager', clientId],
    queryFn: async (): Promise<SecondaryManagerRecord | null> => {
      const { data, error } = await supabase
        .from('client_secondary_managers')
        .select('*')
        .eq('client_id', clientId!)
        .maybeSingle();

      if (error) throw error;
      return data as SecondaryManagerRecord | null;
    },
    enabled: !!clientId,
  });
}

export function useSetSecondaryManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      clientId,
      secondaryManagerId,
      phase,
    }: {
      clientId: string;
      secondaryManagerId: string;
      phase: 'onboarding' | 'acompanhamento';
    }) => {
      const { data, error } = await supabase
        .from('client_secondary_managers')
        .upsert(
          {
            client_id: clientId,
            secondary_manager_id: secondaryManagerId,
            phase,
            created_by: user!.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'client_id' },
        )
        .select()
        .single();

      if (error) throw error;

      // When phase=onboarding, duplicate pending onboarding tasks for secondary
      if (phase === 'onboarding') {
        const { data: pendingTasks } = await supabase
          .from('onboarding_tasks')
          .select('*')
          .eq('client_id', clientId)
          .eq('status', 'pending')
          .neq('assigned_to', secondaryManagerId);

        if (pendingTasks && pendingTasks.length > 0) {
          const duplicates = pendingTasks.map(task => ({
            client_id: task.client_id,
            assigned_to: secondaryManagerId,
            task_type: task.task_type,
            title: task.title,
            description: task.description,
            status: 'pending',
            due_date: task.due_date,
            milestone: task.milestone,
          }));

          // Only insert tasks that don't already exist for secondary
          for (const dup of duplicates) {
            const { data: existing } = await supabase
              .from('onboarding_tasks')
              .select('id')
              .eq('client_id', dup.client_id)
              .eq('task_type', dup.task_type)
              .eq('assigned_to', secondaryManagerId)
              .maybeSingle();

            if (!existing) {
              await supabase.from('onboarding_tasks').insert(dup);
            }
          }
        }
      }

      return data;
    },
    onSuccess: (_, { clientId }) => {
      toast.success('Gestor secundário salvo');
      queryClient.invalidateQueries({ queryKey: ['secondary-manager', clientId] });
      queryClient.invalidateQueries({ queryKey: ['secondary-managers-bulk'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
    },
    onError: () => toast.error('Erro ao salvar gestor secundário'),
  });
}

export function useRemoveSecondaryManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('client_secondary_managers')
        .delete()
        .eq('client_id', clientId);

      if (error) throw error;
    },
    onSuccess: (_, clientId) => {
      toast.success('Gestor secundário removido');
      queryClient.invalidateQueries({ queryKey: ['secondary-manager', clientId] });
      queryClient.invalidateQueries({ queryKey: ['secondary-managers-bulk'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
    },
    onError: () => toast.error('Erro ao remover gestor secundário'),
  });
}

export function useSecondaryManagersBulk() {
  return useQuery({
    queryKey: ['secondary-managers-bulk'],
    queryFn: async (): Promise<(SecondaryManagerRecord & { manager_name: string })[]> => {
      const { data: records, error } = await supabase
        .from('client_secondary_managers')
        .select('*');

      if (error) throw error;
      if (!records || records.length === 0) return [];

      const managerIds = [...new Set(records.map(r => r.secondary_manager_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', managerIds);

      const nameMap = (profiles || []).reduce(
        (acc, p) => {
          acc[p.user_id] = p.name;
          return acc;
        },
        {} as Record<string, string>,
      );

      return records.map(r => ({
        ...(r as SecondaryManagerRecord),
        manager_name: nameMap[r.secondary_manager_id] || 'Sem nome',
      }));
    },
    staleTime: 30_000,
  });
}
