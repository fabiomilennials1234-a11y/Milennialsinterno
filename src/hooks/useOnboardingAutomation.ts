import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTargetAdsManager } from '@/contexts/AdsManagerContext';
import { useActionJustification } from '@/contexts/JustificationContext';
import { toast } from 'sonner';
import { addDays, getDay } from 'date-fns';

async function duplicateTaskForSecondaryManager(clientId: string, taskData: {
  task_type: string;
  title: string;
  description: string;
  status: string;
  due_date: string;
  milestone: number;
}) {
  const { data: secondary } = await supabase
    .from('client_secondary_managers')
    .select('secondary_manager_id')
    .eq('client_id', clientId)
    .eq('phase', 'onboarding')
    .maybeSingle();

  if (!secondary) return;

  const { data: existing } = await supabase
    .from('onboarding_tasks')
    .select('id')
    .eq('client_id', clientId)
    .eq('task_type', taskData.task_type)
    .eq('assigned_to', secondary.secondary_manager_id)
    .maybeSingle();

  if (existing) return;

  await supabase.from('onboarding_tasks').insert({
    ...taskData,
    client_id: clientId,
    assigned_to: secondary.secondary_manager_id,
  });
}

// Map day of week number to Portuguese day name
const DAY_OF_WEEK_MAP: Record<number, string> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado',
};

// IMPORTANT: Only tasks that ADVANCE the client in onboarding should have nextStep/nextMilestone
// Auxiliary tasks (like anexar_link_consultoria, certificar_consultoria) should NOT be in this list
// They are just parallel tasks that don't move the client to the next step
const ADVANCING_TASK_DEFINITIONS = {
  marcar_call_1: {
    title: 'Marcar call 1',
    description: 'Agendar a primeira call com o cliente para alinhamento inicial.',
    dueDays: 1,
    milestone: 1,
    nextStep: 'call_1_marcada',
    nextMilestone: 1,
    nextTask: 'realizar_call_1',
    createMultipleTasks: false,
  },
  realizar_call_1: {
    title: 'Realizar call 1',
    description: 'Realizar a Call 1 com o cliente. Alinhar expectativas e colher briefing.',
    dueDays: 2,
    milestone: 1,
    nextStep: 'criar_estrategia',
    nextMilestone: 2,
    nextTask: null,
    createMultipleTasks: true,
    tasksGroup: 'post_call_1',
  },
  enviar_estrategia: {
    title: 'Enviar estratégia',
    description: 'Enviar a estratégia desenvolvida para o cliente.',
    dueDays: 3,
    milestone: 2,
    nextStep: 'brifar_criativos',
    nextMilestone: 3,
    nextTask: null,
    createMultipleTasks: true,
    tasksGroup: 'post_estrategia',
  },
  // ONLY brifar_criativos advances to Marco 4 - the other Marco 3 tasks are auxiliary
  brifar_criativos: {
    title: 'Brifar criativos',
    description: 'Criar o briefing dos criativos para o cliente.',
    dueDays: 3,
    milestone: 3,
    nextStep: 'elencar_otimizacoes',
    nextMilestone: 4,
    nextTask: null,
    createMultipleTasks: true,
    tasksGroup: 'post_brifar_criativos',
  },
  brifar_otimizacoes: {
    title: 'Brifar otimizações pendentes',
    description: 'Elencar e brifar as otimizações pendentes para o cliente.',
    dueDays: 3,
    milestone: 4,
    nextStep: 'configurar_conta_anuncios',
    nextMilestone: 5,
    nextTask: null,
    createMultipleTasks: true,
    tasksGroup: 'post_brifar_otimizacoes',
  },
  configurar_conta_anuncios: {
    title: 'Configurar conta de anúncios',
    description: 'Configurar a conta de anúncios para o cliente.',
    dueDays: 2,
    milestone: 5,
    nextStep: 'certificar_consultoria',
    nextMilestone: 5,
    nextTask: null,
    createMultipleTasks: true,
    tasksGroup: 'post_configurar_conta',
  },
  certificar_consultoria_realizada: {
    title: 'Confirmar se toda a produção está pronta',
    description: 'Verificar se a consultoria comercial do cliente já foi realizada.',
    dueDays: 2,
    milestone: 5,
    nextStep: 'esperando_criativos',
    nextMilestone: 5,
    nextTask: null,
    createMultipleTasks: true,
    tasksGroup: 'post_certificar_consultoria',
  },
  publicar_campanha: {
    title: 'Publicar Campanha',
    description: 'Publicar a campanha de anúncios do cliente.',
    dueDays: 3,
    milestone: 5,
    nextStep: 'acompanhamento',
    nextMilestone: 6,
    nextTask: null,
    createMultipleTasks: false,
    isOnboardingComplete: true,
  },
};

// POST_*_TASKS arrays removed — DB triggers now handle all task creation
// via advance_onboarding_on_task_completion + create_ads_task_for_onboarding_task.
// See migration 20260122175056 and 20260218110000 for the trigger definitions.

// Create the initial onboarding task for a new client
export function useCreateInitialOnboardingTask() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const queryClient = useQueryClient();
  
  // Use targetUserId if available (when CEO is viewing a manager's board)
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async ({ clientId, clientName }: { clientId: string; clientName: string }) => {
      // Check if task already exists for this client
      const { data: existingTask } = await supabase
        .from('onboarding_tasks')
        .select('id')
        .eq('client_id', clientId)
        .eq('task_type', 'marcar_call_1')
        .maybeSingle();

      if (existingTask) {
        return null;
      }

      // Get the client's assigned_ads_manager to ensure correct assignment
      const { data: client } = await supabase
        .from('clients')
        .select('assigned_ads_manager')
        .eq('id', clientId)
        .single();
      
      // Use client's assigned_ads_manager first, then effectiveUserId, then logged-in user
      const assignedTo = client?.assigned_ads_manager || effectiveUserId || user?.id;
      

      const taskDef = ADVANCING_TASK_DEFINITIONS.marcar_call_1;
      const dueDate = addDays(new Date(), taskDef.dueDays);

      const { data, error } = await supabase
        .from('onboarding_tasks')
        .insert({
          client_id: clientId,
          assigned_to: assignedTo,
          task_type: 'marcar_call_1',
          title: `Marcar Call 1: ${clientName}`,
          description: `${taskDef.description} Cliente: ${clientName}.`,
          status: 'pending',
          due_date: dueDate.toISOString(),
          milestone: taskDef.milestone,
        })
        .select()
        .single();

      if (error) {
        console.error('[useCreateInitialOnboardingTask] Error:', error);
        throw error;
      }

      await duplicateTaskForSecondaryManager(clientId, {
        task_type: 'marcar_call_1',
        title: `Marcar Call 1: ${clientName}`,
        description: `${taskDef.description} Cliente: ${clientName}.`,
        status: 'pending',
        due_date: dueDate.toISOString(),
        milestone: taskDef.milestone,
      });

      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
        toast.success('📋 Tarefa "Marcar call 1" criada automaticamente!');
      }
    },
    onError: (error) => {
      console.error('[useCreateInitialOnboardingTask] Error creating initial task:', error);
      toast.error('Erro ao criar tarefa de onboarding');
    },
  });
}

// ---------------------------------------------------------------------------
// Complete onboarding task — DB triggers handle ALL automation
//
// Architecture (post-race-condition fix):
//   Frontend ONLY marks the task as done + collects justification (UI concern).
//   DB triggers do everything else atomically:
//     - advance_onboarding_on_task_completion  → creates next onboarding_task,
//       updates client_onboarding, creates auxiliary tasks, handles publicar_campanha
//     - advance_client_onboarding_stage        → moves kanban cards, updates milestone
//     - create_ads_task_for_onboarding_task     → creates visible ads_task for new onboarding_task
//     - handle_publicar_campanha_complete       → creates client_daily_tracking record
//
// This eliminates the race condition where frontend and triggers competed
// to create next tasks, sometimes resulting in missing ads_tasks.
// ---------------------------------------------------------------------------
export function useCompleteOnboardingTaskWithAutomation() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const queryClient = useQueryClient();
  const { requireJustification } = useActionJustification();

  // Use targetUserId if available (when CEO is viewing a manager's board)
  const effectiveUserId = targetUserId || user?.id;

  // Define the interface for onboarding tasks
  interface OnboardingTaskData {
    id: string;
    status: string;
    [key: string]: any;
  }

  return useMutation({
    mutationFn: async ({
      taskId,
      taskType,
      clientId,
      clientName
    }: {
      taskId: string;
      taskType: string;
      clientId: string;
      clientName: string;
    }) => {
      // Check if this is an ADVANCING task (one that moves the client forward)
      const taskDef = ADVANCING_TASK_DEFINITIONS[taskType as keyof typeof ADVANCING_TASK_DEFINITIONS];
      const isAdvancing = !!taskDef;

      // J8: Require justification BEFORE marking done (UI blocking modal)
      // Only for advancing tasks completed by the primary manager
      if (isAdvancing) {
        const { data: clientForCheck } = await supabase
          .from('clients')
          .select('assigned_ads_manager')
          .eq('id', clientId)
          .single();

        const isSecondaryCompletion = clientForCheck?.assigned_ads_manager !== effectiveUserId;

        if (!isSecondaryCompletion) {
          await requireJustification({
            title: 'Justificativa: Milestone Concluído',
            subtitle: `Marco ${taskDef.milestone} — ${clientName}`,
            message: `Registre o que foi entregue neste milestone (ex: "site ao ar", "criativos aprovados", "conta configurada").`,
            taskId: taskId,
            taskTable: 'onboarding_milestone_done',
            taskTitle: `Milestone ${taskDef.milestone} concluído: ${clientName} (${taskType})`,
          });

          // J10: Detect milestone skip (if jumping more than 1 milestone)
          const { data: currentOnboarding } = await supabase
            .from('client_onboarding')
            .select('current_milestone')
            .eq('client_id', clientId)
            .maybeSingle();

          if (currentOnboarding && taskDef.nextMilestone > (currentOnboarding.current_milestone || 0) + 1) {
            await requireJustification({
              title: 'Justificativa: Pular Milestone',
              subtitle: `Pulando do Marco ${currentOnboarding.current_milestone} para o Marco ${taskDef.nextMilestone}`,
              message: `Você está avançando o cliente "${clientName}" mais de um milestone de uma vez. Explique o motivo.`,
              taskId: `skip_${taskId}`,
              taskTable: 'onboarding_milestone_skip',
              taskTitle: `Milestone skip: ${clientName} (Marco ${currentOnboarding.current_milestone} → ${taskDef.nextMilestone})`,
            });
          }
        }
      }

      // Mark task as done — DB triggers handle ALL automation from here:
      //   advance_onboarding_on_task_completion → next task + client_onboarding + client status
      //   advance_client_onboarding_stage → kanban cards
      //   create_ads_task_for_onboarding_task → ads_task for the new onboarding_task
      const { error: updateError } = await supabase
        .from('onboarding_tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      if (!isAdvancing) {
        return { taskCompleted: true, clientMoved: false, tasksCreated: 0, isAuxiliaryTask: true };
      }

      const isOnboardingComplete = (taskDef as any).isOnboardingComplete === true;

      return {
        taskCompleted: true,
        clientMoved: true,
        tasksCreated: 0, // DB triggers create tasks now
        nextStep: taskDef.nextStep,
        nextMilestone: taskDef.nextMilestone,
        onboardingCompleted: isOnboardingComplete,
        dayOfWeek: isOnboardingComplete ? DAY_OF_WEEK_MAP[getDay(new Date())] : undefined,
      };
    },
    // Optimistic update - immediately show task as done
    onMutate: async ({ taskId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['onboarding-tasks'] });

      // Snapshot the previous value - use effectiveUserId for proper cache key
      const previousTasks = queryClient.getQueryData<OnboardingTaskData[]>(['onboarding-tasks', effectiveUserId]);

      // Optimistically update to the new value
      if (previousTasks) {
        queryClient.setQueryData<OnboardingTaskData[]>(['onboarding-tasks', effectiveUserId],
          previousTasks.map(task =>
            task.id === taskId ? { ...task, status: 'done' } : task
          )
        );
      }

      return { previousTasks };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['onboarding-tasks', effectiveUserId], context.previousTasks);
      }
      console.error('Error completing task with automation:', error);
      toast.error('Erro ao concluir tarefa');
    },
    onSuccess: (result) => {
      if (result.taskCompleted) {
        if ((result as any).isAuxiliaryTask) {
          toast.success('Tarefa concluída!');
        } else if ((result as any).onboardingCompleted) {
          const dayName = (result as any).dayOfWeek || 'hoje';
          toast.success(`Onboarding concluído! Cliente movido para Acompanhamento - ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}.`);
        } else {
          toast.success(`Tarefa concluída! Cliente avançou para Marco ${result.nextMilestone}.`);
        }
      }
    },
    onSettled: () => {
      // Sync with server after mutation settles — DB triggers may have changed multiple tables
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['client-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['ads-tasks'] });
    },
  });
}

// Fallback hook: ensures client_onboarding record exists when the kanban is viewed.
// The primary creation happens in create_client_with_automations RPC + DB triggers.
// This hook ONLY backfills client_onboarding records for clients created before
// triggers existed. It does NOT create onboarding_tasks — DB triggers handle that
// (create_initial_onboarding_task on INSERT, handle_ads_manager_assignment on UPDATE).
export function useAutoCreateTaskForNewClients(clients: any[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !clients.length) return;

    const newClients = clients.filter(c => c.status === 'new_client');
    if (newClients.length === 0) return;

    let cancelled = false;

    (async () => {
      for (const client of newClients) {
        if (cancelled) break;

        // Ensure client_onboarding record exists (lightweight backfill)
        const { data: existingOnboarding } = await supabase
          .from('client_onboarding')
          .select('id')
          .eq('client_id', client.id)
          .maybeSingle();

        if (!existingOnboarding && !cancelled) {
          const { error } = await supabase
            .from('client_onboarding')
            .insert({
              client_id: client.id,
              current_milestone: 1,
              current_step: 'marcar_call_1',
              milestone_1_started_at: new Date().toISOString(),
            });

          if (error) {
            console.error('[useAutoCreateTaskForNewClients] Erro ao criar onboarding:', error);
          }
        }
      }

      if (!cancelled) {
        queryClient.invalidateQueries({ queryKey: ['client-onboarding'] });
      }
    })();

    return () => { cancelled = true; };
  }, [clients, user, queryClient]);
}
