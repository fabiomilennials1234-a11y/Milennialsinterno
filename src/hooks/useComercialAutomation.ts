import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { useComercialNewClients, useComercialOnboardingClients, getHoursSinceEntry, getDaysSinceOnboardingStart } from './useComercialClients';
import {
  useCreateComercialDelayNotification,
  hasActiveJustificationForDelay,
} from './useComercialDelayNotifications';
import { resolveTaskOwner } from './utils/resolveTaskOwner';
import { TC_CYCLE_AUTO_TASK_TYPES, handleTCCycleTaskCompletion } from './useTCMonthlyCycle';

// Legacy auto task types (kept for backward compatibility with existing tasks)
export const AUTO_TASK_TYPES = {
  MARCAR_CONSULTORIA: 'marcar_consultoria',
  REALIZAR_CONSULTORIA: 'realizar_consultoria',
};

// ============================================================
// PADDOCK ONBOARDING: 4-step flow constants
// ============================================================

export const PADDOCK_AUTO_TASK_TYPES = {
  // Entry task (created automatically for new clients)
  MARCAR_ALINHAMENTO_INICIAL: 'marcar_alinhamento_inicial',
  // Step 1 → 2
  APRESENTAR_DIAGNOSTICO: 'apresentar_diagnostico',
  // Step 2 → 3
  ENVIAR_DIAGNOSTICO_COMERCIAL: 'enviar_diagnostico_comercial',
  // Step 3 → 4 (last task — completing transitions to acompanhamento)
  ENVIAR_DATA_TREINAMENTOS: 'enviar_data_treinamentos',
};

// Legacy task types kept for backward compatibility with existing tasks in DB
export const LEGACY_PADDOCK_TASK_TYPES = [
  'realizar_alinhamento_inicial',
  'confirmar_treinamentos',
  'marcar_war1',
  'realizar_war1',
  'gerar_tarefa_crm',
  'marcar_war2',
  'conscientizar_crm',
  'realizar_war2',
  'gerar_novo_diagnostico',
  'marcar_war3',
  'realizar_war3',
];

export const PADDOCK_STEPS = [
  'diagnostico_marcado',
  'diagnostico_apresentado',
  'diagnostico_enviado',
  'data_treinamentos_enviada',
] as const;

export type PaddockStep = typeof PADDOCK_STEPS[number];

export const PADDOCK_STEP_LABELS: Record<PaddockStep, string> = {
  diagnostico_marcado: '[ 1 ] Reunião de apresentação de diagnóstico marcada',
  diagnostico_apresentado: '[ 2 ] Diagnóstico apresentado',
  diagnostico_enviado: '[ 3 ] Diagnóstico comercial Enviado',
  data_treinamentos_enviada: '[ 4 ] Enviar para o cliente data dos treinamentos semanais',
};

// Maps: when a task of type X completes → move client to step Y
const TASK_TO_STEP: Record<string, PaddockStep | 'acompanhamento'> = {
  [PADDOCK_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_INICIAL]: 'diagnostico_marcado',
  [PADDOCK_AUTO_TASK_TYPES.APRESENTAR_DIAGNOSTICO]: 'diagnostico_apresentado',
  [PADDOCK_AUTO_TASK_TYPES.ENVIAR_DIAGNOSTICO_COMERCIAL]: 'diagnostico_enviado',
  [PADDOCK_AUTO_TASK_TYPES.ENVIAR_DATA_TREINAMENTOS]: 'data_treinamentos_enviada',
};

// Maps: when client enters step X → create task(s) of type(s) with name and deadline
interface TaskTemplate {
  taskType: string;
  titleFn: (clientName: string) => string;
  deadlineDays: number;
}

const STEP_TASKS: Record<string, TaskTemplate[]> = {
  diagnostico_marcado: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.APRESENTAR_DIAGNOSTICO,
    titleFn: (n) => `Apresentar diagnóstico ${n}`,
    deadlineDays: 1,
  }],
  diagnostico_apresentado: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.ENVIAR_DIAGNOSTICO_COMERCIAL,
    titleFn: (n) => `Enviar diagnóstico comercial ${n}`,
    deadlineDays: 1,
  }],
  diagnostico_enviado: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.ENVIAR_DATA_TREINAMENTOS,
    titleFn: (n) => `Enviar datas dos treinamentos semanais ${n}`,
    deadlineDays: 1,
  }],
  // data_treinamentos_enviada has no next task — it's the last step.
  // Reaching it triggers transition to acompanhamento.
};

// ============================================================
// Helper: create auto-task for a client (with robust duplicate check)
// ============================================================
async function createPaddockTask(
  userId: string,
  clientId: string,
  template: TaskTemplate,
  clientName: string,
) {
  // Check for ANY existing task (including done) to prevent duplicates.
  const { data: existingList } = await supabase
    .from('comercial_tasks')
    .select('id')
    .eq('related_client_id', clientId)
    .eq('auto_task_type', template.taskType)
    .limit(1);

  if (existingList && existingList.length > 0) return existingList[0];

  const ownerId = await resolveTaskOwner(clientId, 'assigned_comercial', userId);

  const { data, error } = await supabase
    .from('comercial_tasks')
    .insert({
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
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Retorna o dia útil atual em português.
// Sábado e domingo → 'segunda' (próximo dia útil).
// ============================================================
export function getCurrentDayPortuguese(): string {
  const day = new Date().getDay();
  const map: Record<number, string> = {
    0: 'segunda',
    1: 'segunda',
    2: 'terca',
    3: 'quarta',
    4: 'quinta',
    5: 'sexta',
    6: 'segunda',
  };
  return map[day];
}

// ============================================================
// Complete task and trigger Paddock step machine
// ============================================================
export function useCompleteComercialTaskWithAutomation() {
  const queryClient = useQueryClient();

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
      // Fetch task to check due_date
      const { data: taskData } = await supabase
        .from('comercial_tasks')
        .select('id, title, due_date, is_auto_generated, auto_task_type, user_id')
        .eq('id', taskId)
        .single();

      // Mark task as done
      await supabase
        .from('comercial_tasks')
        .update({ status: 'done' })
        .eq('id', taskId);

      const userId = taskData?.user_id;
      const actualTaskType = taskType || taskData?.auto_task_type;

      // -------------------------------------------------------
      // PADDOCK 4-STEP AUTOMATION
      // -------------------------------------------------------
      const allPaddockTypes = Object.values(PADDOCK_AUTO_TASK_TYPES);

      if (actualTaskType && allPaddockTypes.includes(actualTaskType) && clientId) {
        const { data: client } = await supabase
          .from('clients')
          .select('comercial_status, paddock_onboarding_step, name, razao_social, assigned_ads_manager')
          .eq('id', clientId)
          .single();

        const cName = clientName || client?.razao_social || client?.name || 'Cliente';

        let nextStep: PaddockStep | 'acompanhamento' | undefined;

        if (actualTaskType === PADDOCK_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_INICIAL) {
          // Entry from novo → onboarding_paddock
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
          nextStep = TASK_TO_STEP[actualTaskType];
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

        // Last step has no next tasks → transition to acompanhamento
        const isLastStep = nextStep === PADDOCK_STEPS[PADDOCK_STEPS.length - 1];
        const templates = nextStep && nextStep !== 'acompanhamento' ? STEP_TASKS[nextStep] : undefined;

        if (isLastStep && !templates) {
          await supabase
            .from('clients')
            .update({
              comercial_status: 'em_acompanhamento',
              paddock_onboarding_step: null,
            })
            .eq('id', clientId);

          const mId = managerId || client?.assigned_ads_manager;
          if (mId && userId) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('user_id', mId)
              .single();

            const { data: existing } = await supabase
              .from('comercial_tracking')
              .select('id')
              .eq('client_id', clientId)
              .eq('comercial_user_id', userId)
              .maybeSingle();

            if (!existing) {
              await supabase
                .from('comercial_tracking')
                .insert({
                  comercial_user_id: userId,
                  client_id: clientId,
                  manager_id: mId,
                  manager_name: managerName || profile?.name || 'Gestor',
                  current_day: getCurrentDayPortuguese(),
                });
            }
          }

          return { taskId, taskType: actualTaskType, clientId };
        }

        // Create next tasks for the new step
        if (templates && userId) {
          for (const template of templates) {
            await createPaddockTask(userId, clientId, template, cName);
          }
        }

        return { taskId, taskType: actualTaskType, clientId };
      }

      // -------------------------------------------------------
      // LEGACY AUTOMATION (backward compat for existing clients)
      // -------------------------------------------------------
      if (actualTaskType === AUTO_TASK_TYPES.MARCAR_CONSULTORIA && clientId) {
        await supabase
          .from('clients')
          .update({
            comercial_status: 'consultoria_marcada',
            comercial_onboarding_started_at: new Date().toISOString(),
          })
          .eq('id', clientId);

        if (clientName && userId) {
          // Create legacy realizar_consultoria task
          const { data: existing } = await supabase
            .from('comercial_tasks')
            .select('id')
            .eq('related_client_id', clientId)
            .eq('auto_task_type', AUTO_TASK_TYPES.REALIZAR_CONSULTORIA)
            .maybeSingle();

          if (!existing) {
            await supabase
              .from('comercial_tasks')
              .insert({
                user_id: userId,
                title: `Realizar Consultoria - ${clientName}`,
                description: `Executar consultoria comercial com o cliente ${clientName}`,
                task_type: 'daily',
                status: 'todo',
                related_client_id: clientId,
                is_auto_generated: true,
                auto_task_type: AUTO_TASK_TYPES.REALIZAR_CONSULTORIA,
                due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              });
          }
        }
      } else if (actualTaskType === AUTO_TASK_TYPES.REALIZAR_CONSULTORIA && clientId) {
        await supabase
          .from('clients')
          .update({ comercial_status: 'em_acompanhamento' })
          .eq('id', clientId);

        if (managerId && managerName) {
          const { data: authUser } = await supabase.auth.getUser();
          if (authUser?.user?.id) {
            const { data: existing } = await supabase
              .from('comercial_tracking')
              .select('id')
              .eq('client_id', clientId)
              .eq('comercial_user_id', authUser.user.id)
              .maybeSingle();

            if (!existing) {
              await supabase
                .from('comercial_tracking')
                .insert({
                  comercial_user_id: authUser.user.id,
                  client_id: clientId,
                  manager_id: managerId,
                  manager_name: managerName,
                  current_day: getCurrentDayPortuguese(),
                });
            }
          }
        }
      }

      // -------------------------------------------------------
      // TC MONTHLY 30-DAY CYCLE AUTOMATION
      // -------------------------------------------------------
      const allTCCycleTypes = Object.values(TC_CYCLE_AUTO_TASK_TYPES);
      if (actualTaskType && allTCCycleTypes.includes(actualTaskType) && clientId && userId) {
        await handleTCCycleTaskCompletion(actualTaskType, clientId, clientName || 'Cliente', userId);
      }

      return { taskId, taskType: actualTaskType, clientId };
    },
    onSuccess: () => {
      toast.success('Tarefa concluída!');
      queryClient.invalidateQueries({ queryKey: ['comercial-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-new-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-onboarding-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-paddock-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-acompanhamento-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients-status'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-tracking'] });
    },
    onError: () => {
      toast.error('Erro ao completar tarefa');
    },
  });
}

// ============================================================
// Hook to check and create delay notifications
// ============================================================
export function useCheckComercialDelays() {
  const { user } = useAuth();
  const { data: newClients = [] } = useComercialNewClients();
  const { data: onboardingClients = [] } = useComercialOnboardingClients();
  const createNotification = useCreateComercialDelayNotification();

  useEffect(() => {
    if (!user) return;

    const checkDelays = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const userName = profile?.name || 'Usuário';

      for (const client of newClients) {
        const hours = getHoursSinceEntry(client.comercial_entered_at);
        if (hours < 24) continue;

        const alreadyJustified = await hasActiveJustificationForDelay({
          user_id: user.id,
          notification_type: 'novo_cliente_24h',
          client_id: client.id,
        });
        if (alreadyJustified) continue;

        createNotification.mutate({
          user_id: user.id,
          user_name: userName,
          notification_type: 'novo_cliente_24h',
          client_id: client.id,
          client_name: client.name,
        });
      }

      for (const client of onboardingClients) {
        const days = getDaysSinceOnboardingStart(client.comercial_onboarding_started_at);
        if (days < 5) continue;

        const alreadyJustified = await hasActiveJustificationForDelay({
          user_id: user.id,
          notification_type: 'onboarding_5d',
          client_id: client.id,
        });
        if (alreadyJustified) continue;

        createNotification.mutate({
          user_id: user.id,
          user_name: userName,
          notification_type: 'onboarding_5d',
          client_id: client.id,
          client_name: client.name,
        });
      }
    };

    checkDelays();
    const interval = setInterval(checkDelays, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, newClients, onboardingClients]);
}

// ============================================================
// Hook to auto-create "Marcar alinhamento inicial" for new clients
// ============================================================
export function useAutoCreateTasksForNewClients() {
  const { user } = useAuth();
  const { data: newClients = [] } = useComercialNewClients();
  const processedClientsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);

  // Stable list of client IDs to avoid infinite re-runs
  const clientIds = newClients.map(c => c.id).sort().join(',');

  useEffect(() => {
    if (!user || newClients.length === 0 || isProcessingRef.current) return;

    const createTasks = async () => {
      isProcessingRef.current = true;

      for (const client of newClients) {
        if (processedClientsRef.current.has(client.id)) continue;

        try {
          // Check if task already exists in DB (ANY status, including done).
          // Previously used .neq('status', 'done') which allowed re-creation
          // after completion — causing an infinite loop when RLS blocked the
          // client status update from 'novo' to 'onboarding_paddock'.
          const { data: existingList } = await supabase
            .from('comercial_tasks')
            .select('id')
            .eq('related_client_id', client.id)
            .eq('auto_task_type', PADDOCK_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_INICIAL)
            .limit(1);

          if (existingList && existingList.length > 0) {
            processedClientsRef.current.add(client.id);
            continue;
          }

          const template: TaskTemplate = {
            taskType: PADDOCK_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_INICIAL,
            titleFn: (n) => `Marcar reunião de diagnóstico ${n}`,
            deadlineDays: 1,
          };
          await createPaddockTask(user.id, client.id, template, client.razao_social || client.name);
          processedClientsRef.current.add(client.id);
        } catch {
          processedClientsRef.current.add(client.id);
        }
      }

      isProcessingRef.current = false;
    };

    createTasks();
  }, [user?.id, clientIds]);
}
