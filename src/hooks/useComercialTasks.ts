import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { fireCelebration } from '@/lib/confetti';

export interface ComercialTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  task_type: 'daily' | 'weekly';
  status: 'todo' | 'doing' | 'done';
  priority?: string;
  due_date?: string;
  related_client_id?: string;
  is_auto_generated?: boolean;
  auto_task_type?: string;
  justification?: string;
  justification_at?: string;
  archived?: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
  };
}

// Fetch all tasks for the current comercial user
export function useComercialTasks(taskType?: 'daily' | 'weekly') {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['comercial-tasks', user?.id, taskType],
    queryFn: async (): Promise<ComercialTask[]> => {
      let queryBuilder = supabase
        .from('comercial_tasks')
        .select('*, client:clients(id, name)')
        .eq('user_id', user?.id)
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false });

      if (taskType) {
        queryBuilder = queryBuilder.eq('task_type', taskType);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data || []) as ComercialTask[];
    },
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('comercial-tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comercial_tasks',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

// Create a new task
export function useCreateComercialTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (task: Omit<ComercialTask, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
      const { data, error } = await supabase
        .from('comercial_tasks')
        .insert({
          ...task,
          user_id: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Tarefa criada!');
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
    },
    onError: () => {
      toast.error('Erro ao criar tarefa');
    },
  });
}

// Update task status (with automation for auto-generated tasks)
export function useUpdateComercialTaskStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: 'todo' | 'doing' | 'done' }) => {
      // First get the task to check if it's auto-generated
      const { data: task } = await supabase
        .from('comercial_tasks')
        .select('*, client:clients(id, name, assigned_ads_manager)')
        .eq('id', taskId)
        .single();

      // Update the task status
      const { error } = await supabase
        .from('comercial_tasks')
        .update({ status })
        .eq('id', taskId);

      if (error) throw error;

      // If moving to done and it's an auto-generated task, trigger automation
      if (status === 'done' && task?.is_auto_generated && task?.auto_task_type) {
        const clientId = task.related_client_id;
        const clientName = task.client?.name;
        
        if (task.auto_task_type === 'marcar_consultoria' && clientId) {
          // Move client to consultoria_marcada
          await supabase
            .from('clients')
            .update({ 
              comercial_status: 'consultoria_marcada',
              comercial_onboarding_started_at: new Date().toISOString(),
            })
            .eq('id', clientId);

          // Create next task "Realizar Consultoria Inicial"
          if (clientName && user?.id) {
            // Check if task already exists
            const { data: existing } = await supabase
              .from('comercial_tasks')
              .select('id')
              .eq('related_client_id', clientId)
              .eq('auto_task_type', 'realizar_consultoria')
              .maybeSingle();

            if (!existing) {
              await supabase
                .from('comercial_tasks')
                .insert({
                  user_id: user.id,
                  title: `Realizar Consultoria - ${clientName}`,
                  description: `Executar consultoria com o cliente ${clientName}`,
                  task_type: 'daily',
                  status: 'todo',
                  related_client_id: clientId,
                  is_auto_generated: true,
                  auto_task_type: 'realizar_consultoria',
                });
            }
          }
        } else if (task.auto_task_type === 'realizar_consultoria' && clientId) {
          // Get manager info from client
          const { data: clientData } = await supabase
            .from('clients')
            .select('assigned_ads_manager')
            .eq('id', clientId)
            .single();

          // Get manager name
          let managerName = 'Gestor';
          if (clientData?.assigned_ads_manager) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('user_id', clientData.assigned_ads_manager)
              .single();
            managerName = profile?.name || 'Gestor';
          }

          // Move client to em_acompanhamento
          await supabase
            .from('clients')
            .update({ comercial_status: 'em_acompanhamento' })
            .eq('id', clientId);

          // Add to tracking
          if (clientData?.assigned_ads_manager && user?.id) {
            const { data: existingTracking } = await supabase
              .from('comercial_tracking')
              .select('id')
              .eq('client_id', clientId)
              .eq('comercial_user_id', user.id)
              .maybeSingle();

            if (!existingTracking) {
              await supabase
                .from('comercial_tracking')
                .insert({
                  comercial_user_id: user.id,
                  client_id: clientId,
                  manager_id: clientData.assigned_ads_manager,
                  manager_name: managerName,
                  current_day: 'segunda',
                });
            }
          }
        }
      }

      return { taskId, status, isAutoGenerated: task?.is_auto_generated };
    },
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['comercial-tasks'] });
      
      const previousTasks = queryClient.getQueryData<ComercialTask[]>(['comercial-tasks', user?.id]);
      
      if (previousTasks) {
        queryClient.setQueryData<ComercialTask[]>(['comercial-tasks', user?.id], 
          previousTasks.map(task => 
            task.id === taskId ? { ...task, status } : task
          )
        );
      }
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['comercial-tasks', user?.id], context.previousTasks);
      }
      toast.error('Erro ao atualizar tarefa');
    },
    onSuccess: (result) => {
      if (result.status === 'done') {
        fireCelebration();
        toast.success('🎉 Tarefa concluída!');
      } else if (result.status === 'doing') {
        toast.success('Tarefa movida para "Fazendo"');
      } else {
        toast.success('Tarefa movida para "A fazer"');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-new-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients-status'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-tracking'] });
    },
  });
}

// Delete a task
export function useDeleteComercialTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('comercial_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tarefa excluída!');
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
    },
    onError: () => {
      toast.error('Erro ao excluir tarefa');
    },
  });
}

// Archive a task
export function useArchiveComercialTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('comercial_tasks')
        .update({ 
          archived: true, 
          archived_at: new Date().toISOString() 
        })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tarefa arquivada!');
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
    },
    onError: () => {
      toast.error('Erro ao arquivar tarefa');
    },
  });
}

// Get tasks by client
export function useComercialTasksByClient(clientId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['comercial-tasks-client', clientId],
    queryFn: async (): Promise<ComercialTask[]> => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('comercial_tasks')
        .select('*, client:clients(id, name)')
        .eq('related_client_id', clientId)
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ComercialTask[];
    },
    enabled: !!user && !!clientId,
  });
}
