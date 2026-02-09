import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { useComercialNewClients, useComercialOnboardingClients, getHoursSinceEntry, getDaysSinceOnboardingStart } from './useComercialClients';
import { useCreateComercialDelayNotification } from './useComercialDelayNotifications';

// Auto task types
export const AUTO_TASK_TYPES = {
  MARCAR_CONSULTORIA: 'marcar_consultoria',
  REALIZAR_CONSULTORIA: 'realizar_consultoria',
};

// Create automatic task when client enters "novo" status
export function useCreateMarcarConsultoriaTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ clientId, clientName }: { clientId: string; clientName: string }) => {
      // Check if task already exists
      const { data: existing } = await supabase
        .from('comercial_tasks')
        .select('id')
        .eq('related_client_id', clientId)
        .eq('auto_task_type', AUTO_TASK_TYPES.MARCAR_CONSULTORIA)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from('comercial_tasks')
        .insert({
          user_id: user?.id,
          title: `Marcar Consultoria Comercial - ${clientName}`,
          description: `Agendar consultoria comercial com o cliente ${clientName}`,
          task_type: 'daily',
          status: 'todo',
          related_client_id: clientId,
          is_auto_generated: true,
          auto_task_type: AUTO_TASK_TYPES.MARCAR_CONSULTORIA,
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
    },
  });
}

// Create automatic task when client moves to "consultoria_marcada"
export function useCreateRealizarConsultoriaTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ clientId, clientName }: { clientId: string; clientName: string }) => {
      // Check if task already exists
      const { data: existing } = await supabase
        .from('comercial_tasks')
        .select('id')
        .eq('related_client_id', clientId)
        .eq('auto_task_type', AUTO_TASK_TYPES.REALIZAR_CONSULTORIA)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from('comercial_tasks')
        .insert({
          user_id: user?.id,
          title: `Realizar Consultoria - ${clientName}`,
          description: `Executar consultoria comercial com o cliente ${clientName}`,
          task_type: 'daily',
          status: 'todo',
          related_client_id: clientId,
          is_auto_generated: true,
          auto_task_type: AUTO_TASK_TYPES.REALIZAR_CONSULTORIA,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
    },
  });
}

// Complete task and trigger next step
export function useCompleteComercialTaskWithAutomation() {
  const queryClient = useQueryClient();
  const createRealizarTask = useCreateRealizarConsultoriaTask();

  return useMutation({
    mutationFn: async ({ 
      taskId, 
      taskType,
      clientId,
      clientName,
      managerId,
      managerName,
    }: { 
      taskId: string;
      taskType?: string;
      clientId?: string;
      clientName?: string;
      managerId?: string;
      managerName?: string;
    }) => {
      // Mark task as done
      const { error: taskError } = await supabase
        .from('comercial_tasks')
        .update({ status: 'done' })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Handle automation based on task type
      if (taskType === AUTO_TASK_TYPES.MARCAR_CONSULTORIA && clientId) {
        // Move client to consultoria_marcada
        await supabase
          .from('clients')
          .update({ 
            comercial_status: 'consultoria_marcada',
            comercial_onboarding_started_at: new Date().toISOString(),
          })
          .eq('id', clientId);

        // Create next task "Realizar Consultoria"
        if (clientName) {
          await createRealizarTask.mutateAsync({ clientId, clientName });
        }
      } else if (taskType === AUTO_TASK_TYPES.REALIZAR_CONSULTORIA && clientId) {
        // Move client directly to em_acompanhamento
        await supabase
          .from('clients')
          .update({ comercial_status: 'em_acompanhamento' })
          .eq('id', clientId);

        // Add client to tracking if manager info is provided
        if (managerId && managerName) {
          const { data: user } = await supabase.auth.getUser();
          if (user?.user?.id) {
            // Check if already exists
            const { data: existing } = await supabase
              .from('comercial_tracking')
              .select('id')
              .eq('client_id', clientId)
              .eq('comercial_user_id', user.user.id)
              .maybeSingle();

            if (!existing) {
              await supabase
                .from('comercial_tracking')
                .insert({
                  comercial_user_id: user.user.id,
                  client_id: clientId,
                  manager_id: managerId,
                  manager_name: managerName,
                  current_day: 'segunda',
                });
            }
          }
        }
      }

      return { taskId, taskType, clientId };
    },
    onSuccess: () => {
      toast.success('🎉 Tarefa concluída!');
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-new-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-onboarding-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-acompanhamento-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients-status'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-tracking'] });
    },
    onError: () => {
      toast.error('Erro ao completar tarefa');
    },
  });
}

// Hook to check and create delay notifications
export function useCheckComercialDelays() {
  const { user } = useAuth();
  const { data: newClients = [] } = useComercialNewClients();
  const { data: onboardingClients = [] } = useComercialOnboardingClients();
  const createNotification = useCreateComercialDelayNotification();

  useEffect(() => {
    if (!user) return;

    const checkDelays = async () => {
      // Get user profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      const userName = profile?.name || 'Usuário';

      // Check new clients (24h limit)
      for (const client of newClients) {
        const hours = getHoursSinceEntry(client.comercial_entered_at);
        if (hours >= 24) {
          createNotification.mutate({
            user_id: user.id,
            user_name: userName,
            notification_type: 'novo_cliente_24h',
            client_id: client.id,
            client_name: client.name,
          });
        }
      }

      // Check onboarding clients (5 day limit)
      for (const client of onboardingClients) {
        const days = getDaysSinceOnboardingStart(client.comercial_onboarding_started_at);
        if (days >= 5) {
          createNotification.mutate({
            user_id: user.id,
            user_name: userName,
            notification_type: 'onboarding_5d',
            client_id: client.id,
            client_name: client.name,
          });
        }
      }
    };

    checkDelays();
    
    // Check every 5 minutes
    const interval = setInterval(checkDelays, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user, newClients, onboardingClients]);
}

// Hook to auto-create tasks for new clients (with duplicate prevention)
export function useAutoCreateTasksForNewClients() {
  const { user } = useAuth();
  const { data: newClients = [] } = useComercialNewClients();
  const createTask = useCreateMarcarConsultoriaTask();
  const processedClientsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (!user || newClients.length === 0 || isProcessingRef.current) return;

    const createTasks = async () => {
      isProcessingRef.current = true;
      
      for (const client of newClients) {
        // Skip if already processed in this session
        if (processedClientsRef.current.has(client.id)) continue;
        
        try {
          await createTask.mutateAsync({ 
            clientId: client.id, 
            clientName: client.name 
          });
          // Mark as processed only after successful creation
          processedClientsRef.current.add(client.id);
        } catch (error) {
          // Task might already exist, mark as processed anyway
          processedClientsRef.current.add(client.id);
        }
      }
      
      isProcessingRef.current = false;
    };

    createTasks();
  }, [user?.id, newClients.length]);
}
