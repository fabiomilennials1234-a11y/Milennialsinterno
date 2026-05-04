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
import { useActionJustification } from '@/contexts/JustificationContext';
import { resolveTaskOwner } from './utils/resolveTaskOwner';

// Legacy auto task types (kept for backward compatibility with existing tasks)
export const AUTO_TASK_TYPES = {
  MARCAR_CONSULTORIA: 'marcar_consultoria',
  REALIZAR_CONSULTORIA: 'realizar_consultoria',
};

// ============================================================
// PADDOCK ONBOARDING: 9-step flow constants
// ============================================================

export const PADDOCK_AUTO_TASK_TYPES = {
  MARCAR_ALINHAMENTO_INICIAL: 'marcar_alinhamento_inicial',
  REALIZAR_ALINHAMENTO_INICIAL: 'realizar_alinhamento_inicial',
  MARCAR_WAR1: 'marcar_war1',
  REALIZAR_WAR1: 'realizar_war1',
  ENVIAR_DIAGNOSTICO_COMERCIAL: 'enviar_diagnostico_comercial',
  GERAR_TAREFA_CRM: 'gerar_tarefa_crm',
  MARCAR_WAR2: 'marcar_war2',
  CONSCIENTIZAR_CRM: 'conscientizar_crm',
  REALIZAR_WAR2: 'realizar_war2',
  GERAR_NOVO_DIAGNOSTICO: 'gerar_novo_diagnostico',
  MARCAR_WAR3: 'marcar_war3',
  REALIZAR_WAR3: 'realizar_war3',
};

export const PADDOCK_STEPS = [
  'alinhamento_inicial_marcado',
  'alinhamento_inicial_realizado',
  'war1_marcada',
  'diagnostico_crm_criado',
  'diagnostico_crm_enviado',
  'tarefa_gestor_crm_gerada',
  'crm_solicitado',
  'war2_marcada',
  'gerar_novo_diagnostico',
  'marcar_war3',
  'war3_marcada',
] as const;

export type PaddockStep = typeof PADDOCK_STEPS[number];

export const PADDOCK_STEP_LABELS: Record<PaddockStep, string> = {
  alinhamento_inicial_marcado: '[ 1 ] Alinhamento inicial cliente marcado',
  alinhamento_inicial_realizado: '[ 2 ] Alinhamento inicial realizado',
  war1_marcada: '[ 3 ] War #1 Marcada',
  diagnostico_crm_criado: '[ 4 ] Diagnóstico Comercial Gerado',
  diagnostico_crm_enviado: '[ 5 ] Diagnóstico comercial Enviado',
  tarefa_gestor_crm_gerada: '[ 6 ] Tarefa Gestor de CRM gerada',
  crm_solicitado: '[ 7 ] CRM solicitado',
  war2_marcada: '[ 8 ] War #2 Marcada',
  gerar_novo_diagnostico: '[ 9 ] Gerar novo Diagnóstico comercial',
  marcar_war3: '[ 10 ] Marcar War #3',
  war3_marcada: '[ 11 ] War #3 marcada',
};

// Maps: when a task of type X completes → move client to step Y
const TASK_TO_STEP: Record<string, PaddockStep | 'acompanhamento'> = {
  [PADDOCK_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_INICIAL]: 'alinhamento_inicial_marcado',
  [PADDOCK_AUTO_TASK_TYPES.REALIZAR_ALINHAMENTO_INICIAL]: 'alinhamento_inicial_realizado',
  [PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR1]: 'war1_marcada',
  [PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR1]: 'diagnostico_crm_criado',
  [PADDOCK_AUTO_TASK_TYPES.ENVIAR_DIAGNOSTICO_COMERCIAL]: 'diagnostico_crm_enviado',
  [PADDOCK_AUTO_TASK_TYPES.GERAR_TAREFA_CRM]: 'crm_solicitado',
  // dual tasks: both must complete before advancing from crm_solicitado → war2_marcada
  [PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR2]: 'war2_marcada',
  [PADDOCK_AUTO_TASK_TYPES.CONSCIENTIZAR_CRM]: 'war2_marcada',
  [PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR2]: 'gerar_novo_diagnostico',
  [PADDOCK_AUTO_TASK_TYPES.GERAR_NOVO_DIAGNOSTICO]: 'marcar_war3',
  [PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR3]: 'war3_marcada',
  [PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR3]: 'acompanhamento',
};

// Maps: when client enters step X → create task(s) of type(s) with name and deadline
interface TaskTemplate {
  taskType: string;
  titleFn: (clientName: string) => string;
  deadlineDays: number;
}

const STEP_TASKS: Record<string, TaskTemplate[]> = {
  alinhamento_inicial_marcado: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.REALIZAR_ALINHAMENTO_INICIAL,
    titleFn: (n) => `Realizar alinhamento comercial ${n}`,
    deadlineDays: 1,
  }],
  alinhamento_inicial_realizado: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR1,
    titleFn: (n) => `Marcar War #1 ${n}`,
    deadlineDays: 3,
  }],
  war1_marcada: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR1,
    titleFn: (n) => `Realizar War #1 ${n}`,
    deadlineDays: 3,
  }],
  diagnostico_crm_criado: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.ENVIAR_DIAGNOSTICO_COMERCIAL,
    titleFn: (n) => `Enviar diagnóstico Comercial ${n}`,
    deadlineDays: 1,
  }],
  diagnostico_crm_enviado: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.GERAR_TAREFA_CRM,
    titleFn: (n) => `Gerar tarefa de implementação para Gestor de CRM ${n}`,
    deadlineDays: 1,
  }],
  crm_solicitado: [
    {
      taskType: PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR2,
      titleFn: (n) => `Marcar War #2 para daqui 7 dias ${n}`,
      deadlineDays: 7,
    },
    {
      taskType: PADDOCK_AUTO_TASK_TYPES.CONSCIENTIZAR_CRM,
      titleFn: (n) => `Conscientizar o tempo de espera da criação do CRM ${n}`,
      deadlineDays: 1,
    },
  ],
  war2_marcada: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR2,
    titleFn: (n) => `Realizar War #2 ${n}`,
    deadlineDays: 7,
  }],
  gerar_novo_diagnostico: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.GERAR_NOVO_DIAGNOSTICO,
    titleFn: (n) => `Gerar novo Diagnóstico comercial ${n}`,
    deadlineDays: 7,
  }],
  marcar_war3: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR3,
    titleFn: (n) => `Marcar War #3 ${n}`,
    deadlineDays: 7,
  }],
  war3_marcada: [{
    taskType: PADDOCK_AUTO_TASK_TYPES.REALIZAR_WAR3,
    titleFn: (n) => `Realizar War #3 ${n}`,
    deadlineDays: 3,
  }],
};

// The dual-task step: crm_solicitado creates TWO tasks
// Both must be completed before advancing to war2_marcada
const DUAL_TASK_STEP = 'crm_solicitado';
const DUAL_TASK_TYPES = [PADDOCK_AUTO_TASK_TYPES.MARCAR_WAR2, PADDOCK_AUTO_TASK_TYPES.CONSCIENTIZAR_CRM];

// ============================================================
// Helper: create auto-task for a client (with robust duplicate check)
// ============================================================
async function createPaddockTask(
  userId: string,
  clientId: string,
  template: TaskTemplate,
  clientName: string,
) {
  // Robust duplicate check: look for ANY existing task (pending or not-done) with same type
  const { data: existingList } = await supabase
    .from('comercial_tasks')
    .select('id')
    .eq('related_client_id', clientId)
    .eq('auto_task_type', template.taskType)
    .neq('status', 'done')
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
  const { requireJustification } = useActionJustification();

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

      // If overdue auto task, require justification
      if (taskData?.is_auto_generated && taskData?.due_date) {
        const isOverdue = new Date(taskData.due_date) < new Date();
        if (isOverdue) {
          const justificationText = await requireJustification({
            title: 'Tarefa Atrasada',
            subtitle: 'Justificativa obrigatória',
            message: `A tarefa "${taskData.title}" está atrasada. Explique o motivo do atraso.`,
            taskId: taskData.id,
            taskTable: 'comercial_tasks',
            taskTitle: taskData.title,
            priority: 'urgent',
          });

          await supabase
            .from('comercial_tasks')
            .update({
              status: 'done',
              justification: justificationText,
              justification_at: new Date().toISOString(),
            })
            .eq('id', taskId);
        } else {
          await supabase
            .from('comercial_tasks')
            .update({ status: 'done' })
            .eq('id', taskId);
        }
      } else {
        await supabase
          .from('comercial_tasks')
          .update({ status: 'done' })
          .eq('id', taskId);
      }

      const userId = taskData?.user_id;
      const actualTaskType = taskType || taskData?.auto_task_type;

      // -------------------------------------------------------
      // PADDOCK 9-STEP AUTOMATION
      // -------------------------------------------------------
      const allPaddockTypes = Object.values(PADDOCK_AUTO_TASK_TYPES);

      if (actualTaskType && allPaddockTypes.includes(actualTaskType) && clientId) {
        // Get current client state
        const { data: client } = await supabase
          .from('clients')
          .select('comercial_status, paddock_onboarding_step, name, razao_social, assigned_ads_manager')
          .eq('id', clientId)
          .single();

        const cName = clientName || client?.razao_social || client?.name || 'Cliente';
        const currentStep = client?.paddock_onboarding_step;

        // Check for dual-task step (tarefa_gestor_crm_gerada → crm_solicitado)
        // Both MARCAR_WAR2 and CONSCIENTIZAR_CRM must be done
        if (currentStep === DUAL_TASK_STEP && DUAL_TASK_TYPES.includes(actualTaskType)) {
          const { count } = await supabase
            .from('comercial_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('related_client_id', clientId)
            .in('auto_task_type', DUAL_TASK_TYPES)
            .neq('status', 'done');

          // If there are still pending tasks, don't advance yet
          if (count && count > 0) {
            return { taskId, taskType: actualTaskType, clientId };
          }

          // Both done → advance to war2_marcada
          const nextStep = 'war2_marcada' as PaddockStep;
          await supabase
            .from('clients')
            .update({ paddock_onboarding_step: nextStep })
            .eq('id', clientId);

          // Create tasks for war2_marcada step
          const templates = STEP_TASKS[nextStep];
          if (templates && userId) {
            for (const template of templates) {
              await createPaddockTask(userId, clientId, template, cName);
            }
          }

          return { taskId, taskType: actualTaskType, clientId };
        }

        // Normal flow: determine next step from task type
        let nextStep: PaddockStep | 'acompanhamento' | undefined;

        if (actualTaskType === PADDOCK_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_INICIAL) {
          // Entry from novo → onboarding_paddock
          nextStep = 'alinhamento_inicial_marcado';
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
          // Standard progression via map
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

        // Handle acompanhamento transition
        if (nextStep === 'acompanhamento') {
          await supabase
            .from('clients')
            .update({
              comercial_status: 'em_acompanhamento',
              paddock_onboarding_step: null,
            })
            .eq('id', clientId);

          // Add to tracking
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
        if (nextStep && nextStep !== 'acompanhamento') {
          const templates = STEP_TASKS[nextStep];
          if (templates && userId) {
            for (const template of templates) {
              await createPaddockTask(userId, clientId, template, cName);
            }
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
            titleFn: (n) => `Marcar alinhamento inicial ${n}`,
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
