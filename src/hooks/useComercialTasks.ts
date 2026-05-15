import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { fireCelebration } from '@/lib/confetti';
import { getCurrentDayPortuguese, PADDOCK_AUTO_TASK_TYPES } from './useComercialAutomation';
import { TC_CYCLE_AUTO_TASK_TYPES, handleTCCycleTaskCompletion } from './useTCMonthlyCycle';
import { resolveTaskOwner } from './utils/resolveTaskOwner';

// Paddock step progression maps (mirrored from useComercialAutomation)
const PADDOCK_TASK_TO_STEP: Record<string, string> = {
  [PADDOCK_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_INICIAL]: 'diagnostico_marcado',
  [PADDOCK_AUTO_TASK_TYPES.APRESENTAR_DIAGNOSTICO]: 'diagnostico_apresentado',
  [PADDOCK_AUTO_TASK_TYPES.ENVIAR_DIAGNOSTICO_COMERCIAL]: 'diagnostico_enviado',
  [PADDOCK_AUTO_TASK_TYPES.ENVIAR_DATA_TREINAMENTOS]: 'data_treinamentos_enviada',
  [PADDOCK_AUTO_TASK_TYPES.CONFIRMAR_TREINAMENTOS]: 'acompanhamento',
};

interface PaddockTaskTemplate {
  taskType: string;
  titleFn: (clientName: string) => string;
  deadlineDays: number;
}

const PADDOCK_STEP_TASKS: Record<string, PaddockTaskTemplate[]> = {
  diagnostico_marcado: [{ taskType: PADDOCK_AUTO_TASK_TYPES.APRESENTAR_DIAGNOSTICO, titleFn: (n) => `Apresentar diagnóstico ${n}`, deadlineDays: 1 }],
  diagnostico_apresentado: [{ taskType: PADDOCK_AUTO_TASK_TYPES.ENVIAR_DIAGNOSTICO_COMERCIAL, titleFn: (n) => `Enviar diagnóstico comercial ${n}`, deadlineDays: 1 }],
  diagnostico_enviado: [{ taskType: PADDOCK_AUTO_TASK_TYPES.ENVIAR_DATA_TREINAMENTOS, titleFn: (n) => `Enviar datas dos treinamentos semanais ${n}`, deadlineDays: 1 }],
  data_treinamentos_enviada: [{ taskType: PADDOCK_AUTO_TASK_TYPES.CONFIRMAR_TREINAMENTOS, titleFn: (n) => `Confirmar envio de datas de treinamentos ${n}`, deadlineDays: 1 }],
};

async function createPaddockTaskFromTemplate(userId: string, clientId: string, template: PaddockTaskTemplate, clientName: string) {
  const { data: existingList } = await supabase
    .from('comercial_tasks')
    .select('id')
    .eq('related_client_id', clientId)
    .eq('auto_task_type', template.taskType)
    .limit(1);

  if (existingList && existingList.length > 0) return;

  const ownerId = await resolveTaskOwner(clientId, 'assigned_comercial', userId);

  await supabase.from('comercial_tasks').insert({
    user_id: ownerId,
    title: template.titleFn(clientName),
    description: `Tarefa automática do Onboarding Paddock para ${clientName}`,
    task_type: 'daily',
    status: 'todo',
    priority: 'high',
    related_client_id: clientId,
    is_auto_generated: true,
    auto_task_type: template.taskType,
    due_date: new Date(Date.now() + template.deadlineDays * 24 * 60 * 60 * 1000).toISOString(),
  });
}

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

// Fetch all tasks for the current comercial user (CEO sees all)
export function useComercialTasks(taskType?: 'daily' | 'weekly') {
  const { user, isCEO } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['comercial-tasks', user?.id, taskType],
    queryFn: async (): Promise<ComercialTask[]> => {
      let queryBuilder = supabase
        .from('comercial_tasks')
        .select('*, client:clients(id, name)')
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false });

      // RLS já filtra (policy comercial_tasks_select_visao_total) — sem
      // filtro client-side. Antes excluía o consultor de tasks autogeradas
      // criadas com user_id=ceo durante operações em massa.

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
        const clientName = task.client?.name || 'Cliente';
        const allPaddockTypes = Object.values(PADDOCK_AUTO_TASK_TYPES);

        // -------------------------------------------------------
        // PADDOCK 4-STEP AUTOMATION
        // -------------------------------------------------------
        if (allPaddockTypes.includes(task.auto_task_type) && clientId && user?.id) {
          const { data: client } = await supabase
            .from('clients')
            .select('comercial_status, paddock_onboarding_step, name, razao_social, assigned_ads_manager')
            .eq('id', clientId)
            .single();

          const cName = client?.razao_social || client?.name || clientName;

          let nextStep: string | undefined;

          if (task.auto_task_type === PADDOCK_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_INICIAL) {
            nextStep = 'diagnostico_marcado';
            const { error: clientErr } = await supabase
              .from('clients')
              .update({
                comercial_status: 'onboarding_paddock',
                paddock_onboarding_step: nextStep,
                comercial_onboarding_started_at: new Date().toISOString(),
              })
              .eq('id', clientId);
            if (clientErr) {
              console.error('[Paddock] Failed to advance client status:', clientErr.message);
            }
          } else {
            nextStep = PADDOCK_TASK_TO_STEP[task.auto_task_type];
            if (nextStep && nextStep !== 'acompanhamento') {
              const { error: stepErr } = await supabase
                .from('clients')
                .update({ paddock_onboarding_step: nextStep })
                .eq('id', clientId);
              if (stepErr) {
                console.error('[Paddock] Failed to advance paddock step:', stepErr.message);
              }
            }
          }

          // Handle transition to acompanhamento
          if (nextStep === 'acompanhamento') {
            await supabase
              .from('clients')
              .update({
                comercial_status: 'em_acompanhamento',
                paddock_onboarding_step: null,
              })
              .eq('id', clientId);

            const mId = client?.assigned_ads_manager;
            if (mId) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('name')
                .eq('user_id', mId)
                .single();

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
                    manager_id: mId,
                    manager_name: profile?.name || 'Gestor',
                    current_day: getCurrentDayPortuguese(),
                  });
              }
            }
          } else if (nextStep) {
            const templates = PADDOCK_STEP_TASKS[nextStep];
            if (templates) {
              for (const tmpl of templates) {
                await createPaddockTaskFromTemplate(user.id, clientId, tmpl, cName);
              }
            }
          }

        // -------------------------------------------------------
        // LEGACY AUTOMATION (backward compat)
        // -------------------------------------------------------
        } else if (task.auto_task_type === 'marcar_consultoria' && clientId) {
          await supabase
            .from('clients')
            .update({
              comercial_status: 'consultoria_marcada',
              comercial_onboarding_started_at: new Date().toISOString(),
            })
            .eq('id', clientId);

          if (clientName && user?.id) {
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
                  due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                });
            }
          }
        } else if (task.auto_task_type === 'realizar_consultoria' && clientId) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('assigned_ads_manager')
            .eq('id', clientId)
            .single();

          let managerName = 'Gestor';
          if (clientData?.assigned_ads_manager) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('user_id', clientData.assigned_ads_manager)
              .single();
            managerName = profile?.name || 'Gestor';
          }

          await supabase
            .from('clients')
            .update({ comercial_status: 'em_acompanhamento' })
            .eq('id', clientId);

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
                  current_day: getCurrentDayPortuguese(),
                });
            }
          }

          if (clientData?.assigned_ads_manager) {
            await supabase.from('system_notifications').insert({
              recipient_id: clientData.assigned_ads_manager,
              recipient_role: 'gestor_ads',
              notification_type: 'comercial_consultoria_completed',
              title: 'Consultoria Comercial Concluída',
              message: `A consultoria comercial do cliente "${clientName}" foi concluída. O cliente está pronto para acompanhamento.`,
              client_id: clientId,
              priority: 'high',
              metadata: { comercial_user_id: user?.id, client_name: clientName },
            } as any);
          }
        // -------------------------------------------------------
        // TORQUE CRM SUB-PRODUCT BRIEFING → CONFIRMAÇÃO
        // -------------------------------------------------------
        // Ao concluir "Briefar configuração [Produto] [Cliente]", cria a tarefa
        // de confirmação com prazo de 7 dias. A tag em description identifica
        // qual sub-produto Torque CRM (v8/automation/copilot).
        } else if (task.auto_task_type === 'briefar_torque_config' && clientId && user?.id) {
          const desc = (task as any).description as string | null;
          if (desc && desc.startsWith('torque-briefing:')) {
            const productSlug = desc.replace('torque-briefing:', '');
            const productLabel = task.title?.match(/Briefar configuração (.+) [^ ]+$/)?.[1] || productSlug;
            const confirmTag = `torque-confirm:${productSlug}`;
            // Idempotência: não duplica
            const { data: existingConfirm } = await supabase
              .from('comercial_tasks')
              .select('id')
              .eq('related_client_id', clientId)
              .eq('description', confirmTag)
              .limit(1);

            if (!existingConfirm || existingConfirm.length === 0) {
              const ownerId = await resolveTaskOwner(clientId, 'assigned_comercial', user.id);
              await supabase.from('comercial_tasks').insert({
                user_id: ownerId,
                title: `Confirmar implementação ${productLabel} ${clientName}`,
                description: confirmTag,
                task_type: 'daily',
                status: 'todo',
                priority: 'high',
                related_client_id: clientId,
                is_auto_generated: true,
                auto_task_type: 'confirmar_torque_impl',
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              } as any);
            }
          }
        // -------------------------------------------------------
        // TC MONTHLY 30-DAY CYCLE AUTOMATION
        // -------------------------------------------------------
        } else if (
          Object.values(TC_CYCLE_AUTO_TASK_TYPES).includes(task.auto_task_type) &&
          clientId &&
          user?.id
        ) {
          await handleTCCycleTaskCompletion(
            task.auto_task_type,
            clientId,
            clientName,
            user.id,
          );
        }
      }

      return { taskId, status, isAutoGenerated: task?.is_auto_generated };
    },
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['comercial-tasks'] });

      // Capture snapshots of ALL comercial-tasks query variants (daily/weekly/undefined)
      const snapshots: Array<{ queryKey: readonly unknown[]; data: ComercialTask[] }> = [];

      queryClient.getQueriesData<ComercialTask[]>({ queryKey: ['comercial-tasks', user?.id] })
        .forEach(([queryKey, data]) => {
          if (data) {
            snapshots.push({ queryKey, data });
            queryClient.setQueryData<ComercialTask[]>(queryKey,
              data.map(task => task.id === taskId ? { ...task, status } : task)
            );
          }
        });

      return { snapshots };
    },
    onError: (err, variables, context) => {
      if (context?.snapshots) {
        for (const { queryKey, data } of context.snapshots) {
          queryClient.setQueryData(queryKey, data);
        }
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
      queryClient.invalidateQueries({ queryKey: ['comercial-onboarding-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-paddock-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients-status'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks-client'] });
      queryClient.invalidateQueries({ queryKey: ['paddock-pending-tasks'] });
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
