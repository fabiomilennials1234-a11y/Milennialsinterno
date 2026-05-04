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

      // When phase=onboarding, create initial "Marcar Call 1" task for secondary
      // Treats client as brand new for the secondary — independent of primary's progress
      if (phase === 'onboarding') {
        const { data: existingTask } = await supabase
          .from('onboarding_tasks')
          .select('id')
          .eq('client_id', clientId)
          .eq('task_type', 'marcar_call_1')
          .eq('assigned_to', secondaryManagerId)
          .maybeSingle();

        if (!existingTask) {
          const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', clientId)
            .single();

          const clientName = client?.name || 'Cliente';
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 1);

          await supabase.from('onboarding_tasks').insert({
            client_id: clientId,
            assigned_to: secondaryManagerId,
            task_type: 'marcar_call_1',
            title: `Marcar Call 1: ${clientName}`,
            description: 'Agendar a primeira call com o cliente para alinhamento inicial.',
            status: 'pending',
            due_date: dueDate.toISOString(),
            milestone: 1,
          });

          // Create corresponding ads_task (visible in Tarefas Diárias column)
          const { data: existingAdsTask } = await supabase
            .from('ads_tasks')
            .select('id')
            .eq('ads_manager_id', secondaryManagerId)
            .contains('tags', [`client_id:${clientId}`, 'onboarding_task_type:marcar_call_1'])
            .maybeSingle();

          if (!existingAdsTask) {
            await supabase.from('ads_tasks').insert({
              ads_manager_id: secondaryManagerId,
              title: `Marcar Call 1: ${clientName}`,
              description: `Agendar a primeira call com o cliente para alinhamento inicial. Cliente: ${clientName}.`,
              task_type: 'daily',
              status: 'todo',
              priority: 'high',
              due_date: dueDate.toISOString(),
              tags: [`client_id:${clientId}`, 'onboarding_task_type:marcar_call_1'],
            });
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
      queryClient.invalidateQueries({ queryKey: ['ads-tasks'] });
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
