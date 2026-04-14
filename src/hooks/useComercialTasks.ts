import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { fireCelebration } from '@/lib/confetti';
import { getCurrentDayPortuguese, PADDOCK_AUTO_TASK_TYPES } from './useComercialAutomation';
import { useActionJustification } from '@/contexts/JustificationContext';

// Paddock step progression maps (mirrored from useComercialAutomation)
const PADDOCK_TASK_TO_STEP: Record<string, string> = {
  [PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR1]: 'war1_marcada',
  [PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR1]: 'diagnostico_crm_criado',
  [PADDOCK_AUTO_TASK_TYPES.ENVIAR_DIAGNOSTICO_COMERCIAL]: 'diagnostico_crm_enviado',
  [PADDOCK_AUTO_TASK_TYPES.GERAR_TAREFA_CRM]: 'crm_solicitado',
  [PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR2]: 'war2_marcada',
  [PADDOCK_AUTO_TASK_TYPES.CONSCIENTIZAR_CRM]: 'war2_marcada',
  [PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR2]: 'gerar_novo_diagnostico',
  [PADDOCK_AUTO_TASK_TYPES.GERAR_NOVO_DIAGNOSTICO]: 'marcar_war3',
  [PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR3]: 'war3_marcada',
  [PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR3]: 'acompanhamento',
};

interface PaddockTaskTemplate {
  taskType: string;
  titleFn: (clientName: string) => string;
  deadlineDays: number;
}

const PADDOCK_STEP_TASKS: Record<string, PaddockTaskTemplate[]> = {
  war1_marcada: [{ taskType: PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR1, titleFn: (n) => `Realizar War #1 ${n}`, deadlineDays: 3 }],
  diagnostico_crm_criado: [{ taskType: PADDOCK_AUTO_TASK_TYPES.ENVIAR_DIAGNOSTICO_COMERCIAL, titleFn: (n) => `Enviar diagnóstico Comercial ${n}`, deadlineDays: 1 }],
  diagnostico_crm_enviado: [{ taskType: PADDOCK_AUTO_TASK_TYPES.GERAR_TAREFA_CRM, titleFn: (n) => `Gerar tarefa de implementação para Gestor de CRM ${n}`, deadlineDays: 1 }],
  crm_solicitado: [
    { taskType: PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR2, titleFn: (n) => `Marcar War #2 para daqui 7 dias ${n}`, deadlineDays: 7 },
    { taskType: PADDOCK_AUTO_TASK_TYPES.CONSCIENTIZAR_CRM, titleFn: (n) => `Conscientizar o tempo de espera da criação do CRM ${n}`, deadlineDays: 1 },
  ],
  war2_marcada: [{ taskType: PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR2, titleFn: (n) => `Realizar War #2 ${n}`, deadlineDays: 7 }],
  gerar_novo_diagnostico: [{ taskType: PADDOCK_AUTO_TASK_TYPES.GERAR_NOVO_DIAGNOSTICO, titleFn: (n) => `Gerar novo Diagnóstico comercial ${n}`, deadlineDays: 7 }],
  marcar_war3: [{ taskType: PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR3, titleFn: (n) => `Marcar War #3 ${n}`, deadlineDays: 7 }],
  war3_marcada: [{ taskType: PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR3, titleFn: (n) => `Realizar War #3 ${n}`, deadlineDays: 3 }],
};

const DUAL_TASK_STEP = 'crm_solicitado';
const DUAL_TASK_TYPES = [PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR2, PADDOCK_AUTO_TASK_TYPES.CONSCIENTIZAR_CRM];

async function createPaddockTaskFromTemplate(userId: string, clientId: string, template: PaddockTaskTemplate, clientName: string) {
  const { data: existingList } = await supabase
    .from('comercial_tasks')
    .select('id')
    .eq('related_client_id', clientId)
    .eq('auto_task_type', template.taskType)
    .neq('status', 'done')
    .limit(1);

  if (existingList && existingList.length > 0) return;

  await supabase.from('comercial_tasks').insert({
    user_id: userId,
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

      // CEO sees all tasks, others see only their own
      if (user?.role === 'consultor_comercial') {
        queryBuilder = queryBuilder.eq('user_id', user?.id);
      }

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
  const { requireJustification } = useActionJustification();

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: 'todo' | 'doing' | 'done' }) => {
      // First get the task to check if it's auto-generated
      const { data: task } = await supabase
        .from('comercial_tasks')
        .select('*, client:clients(id, name, assigned_ads_manager)')
        .eq('id', taskId)
        .single();

      // If completing an auto-generated overdue task, require justification
      if (status === 'done' && task?.is_auto_generated && task?.due_date) {
        const isOverdue = new Date(task.due_date) < new Date();
        if (isOverdue) {
          const justificationText = await requireJustification({
            title: 'Tarefa Atrasada',
            subtitle: 'Justificativa obrigatória',
            message: `A tarefa "${task.title}" está atrasada. Explique o motivo do atraso.`,
            taskId: task.id,
            taskTable: 'comercial_tasks',
            taskTitle: task.title,
            priority: 'urgent',
          });

          // Save justification to the task
          await supabase
            .from('comercial_tasks')
            .update({
              status,
              justification: justificationText,
              justification_at: new Date().toISOString(),
            })
            .eq('id', taskId);

          // Continue with automation below (skip normal update)
        } else {
          const { error } = await supabase
            .from('comercial_tasks')
            .update({ status })
            .eq('id', taskId);
          if (error) throw error;
        }
      } else {
        // Update the task status
        const { error } = await supabase
          .from('comercial_tasks')
          .update({ status })
          .eq('id', taskId);
        if (error) throw error;
      }

      // If moving to done and it's an auto-generated task, trigger automation
      if (status === 'done' && task?.is_auto_generated && task?.auto_task_type) {
        const clientId = task.related_client_id;
        const clientName = task.client?.name || 'Cliente';
        const allPaddockTypes = Object.values(PADDOCK_AUTO_TASK_TYPES);

        // -------------------------------------------------------
        // PADDOCK 9-STEP AUTOMATION
        // -------------------------------------------------------
        if (allPaddockTypes.includes(task.auto_task_type) && clientId && user?.id) {
          const { data: client } = await supabase
            .from('clients')
            .select('comercial_status, paddock_onboarding_step, name, razao_social, assigned_ads_manager')
            .eq('id', clientId)
            .single();

          const cName = client?.razao_social || client?.name || clientName;
          const currentStep = client?.paddock_onboarding_step;

          // Dual-task check: tarefa_gestor_crm_gerada creates 2 tasks, both must be done
          if (currentStep === DUAL_TASK_STEP && DUAL_TASK_TYPES.includes(task.auto_task_type)) {
            const { count } = await supabase
              .from('comercial_tasks')
              .select('id', { count: 'exact', head: true })
              .eq('related_client_id', clientId)
              .in('auto_task_type', DUAL_TASK_TYPES)
              .neq('status', 'done');

            if (count && count > 0) {
              // Other task still pending, don't advance yet
              return { taskId, status, isAutoGenerated: true };
            }

            // Both done → advance to war2_marcada
            const nextStep = 'war2_marcada';
            await supabase
              .from('clients')
              .update({ paddock_onboarding_step: nextStep })
              .eq('id', clientId);

            const templates = PADDOCK_STEP_TASKS[nextStep];
            if (templates) {
              for (const tmpl of templates) {
                await createPaddockTaskFromTemplate(user.id, clientId, tmpl, cName);
              }
            }
            return { taskId, status, isAutoGenerated: true };
          }

          // Standard paddock progression
          let nextStep: string | undefined;

          if (task.auto_task_type === PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR1) {
            nextStep = 'war1_marcada';
            await supabase
              .from('clients')
              .update({
                comercial_status: 'onboarding_paddock',
                paddock_onboarding_step: nextStep,
                comercial_onboarding_started_at: new Date().toISOString(),
              })
              .eq('id', clientId);
          } else {
            // Standard progression via map
            nextStep = PADDOCK_TASK_TO_STEP[task.auto_task_type];
            if (nextStep && nextStep !== 'acompanhamento') {
              await supabase
                .from('clients')
                .update({ paddock_onboarding_step: nextStep })
                .eq('id', clientId);
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
                .eq('id', mId)
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
            // Create next task(s) for the new step
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
              .neq('status', 'done')
              .limit(1);

            if (!existingConfirm || existingConfirm.length === 0) {
              await supabase.from('comercial_tasks').insert({
                user_id: user.id,
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
