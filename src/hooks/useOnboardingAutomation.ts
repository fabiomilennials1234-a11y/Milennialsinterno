import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTargetAdsManager } from '@/contexts/AdsManagerContext';
import { toast } from 'sonner';
import { addDays, getDay } from 'date-fns';

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
    title: 'Certificar consultoria realizada',
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

// Tasks to create after "Realizar call 1" is completed (only 1 task)
const POST_CALL_1_TASKS = [
  {
    taskType: 'enviar_estrategia',
    titleTemplate: 'Enviar estratégia PRO + do(a) {clientName}',
    description: 'Desenvolver e enviar a estratégia de marketing personalizada para o cliente.',
    dueDays: 3,
    milestone: 2,
  },
];

// Tasks to create after "Enviar estratégia" is completed (4 parallel tasks)
// IMPORTANT: Only brifar_criativos advances the client, the others are auxiliary
const POST_ESTRATEGIA_TASKS = [
  {
    taskType: 'anexar_link_consultoria',
    titleTemplate: 'Anexar link da consultoria do(a) {clientName}',
    description: 'Anexar no grupo o link da consultoria comercial.',
    dueDays: 2,
    milestone: 3,
  },
  {
    taskType: 'certificar_consultoria',
    titleTemplate: 'Certificar acompanhamento comercial do(a) {clientName}',
    description: 'Certificar que a consultoria comercial já foi marcada, se não, enviar link da consultoria.',
    dueDays: 2,
    milestone: 3,
  },
  {
    taskType: 'enviar_link_drive',
    titleTemplate: 'Enviar e anexar no grupo o link do drive para {clientName}',
    description: 'Enviar e anexar no grupo o link do drive para subir fotos e identidade visual.',
    dueDays: 2,
    milestone: 3,
  },
  {
    taskType: 'brifar_criativos',
    titleTemplate: 'Brifar criativos do(a) {clientName}',
    description: 'Criar o briefing dos criativos para o cliente.',
    dueDays: 3,
    milestone: 3,
  },
];

// Tasks to create after "Brifar criativos" is completed (2 tasks)
const POST_BRIFAR_CRIATIVOS_TASKS = [
  {
    taskType: 'brifar_otimizacoes',
    titleTemplate: 'Brifar otimizações pendentes do(a) {clientName}',
    description: 'Elencar e brifar as otimizações pendentes para o cliente.',
    dueDays: 3,
    milestone: 4,
  },
  {
    taskType: 'avisar_prazo_criativos',
    titleTemplate: 'Avisar o(a) {clientName} o prazo de entrega dos criativos',
    description: 'Informar ao cliente a data prevista para entrega dos criativos.',
    dueDays: 1,
    milestone: 4,
  },
];

// Tasks to create after "Brifar otimizações" is completed (1 task)
const POST_BRIFAR_OTIMIZACOES_TASKS = [
  {
    taskType: 'configurar_conta_anuncios',
    titleTemplate: 'Configurar conta de anúncios do(a) {clientName}',
    description: 'Configurar a conta de anúncios para o cliente.',
    dueDays: 2,
    milestone: 5,
  },
];

// Tasks to create after "Configurar conta de anúncios" is completed (1 task)
const POST_CONFIGURAR_CONTA_TASKS = [
  {
    taskType: 'certificar_consultoria_realizada',
    titleTemplate: 'Certificar que a consultoria comercial do(a) {clientName} já foi realizada',
    description: 'Verificar se a consultoria comercial do cliente já foi realizada.',
    dueDays: 2,
    milestone: 5,
  },
];

// Tasks to create after "Certificar consultoria" is completed (1 task)
const POST_CERTIFICAR_CONSULTORIA_TASKS = [
  {
    taskType: 'publicar_campanha',
    titleTemplate: 'Publicar Campanha do(a) {clientName}',
    description: 'Publicar a campanha de anúncios do cliente.',
    dueDays: 3,
    milestone: 5,
  },
];

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
        console.log('[useCreateInitialOnboardingTask] Task already exists for client', clientId);
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
      
      console.log('[useCreateInitialOnboardingTask] Creating task for client:', clientId, 'assigned_to:', assignedTo);

      const taskDef = ADVANCING_TASK_DEFINITIONS.marcar_call_1;
      const dueDate = addDays(new Date(), taskDef.dueDays);

      const { data, error } = await supabase
        .from('onboarding_tasks')
        .insert({
          client_id: clientId,
          assigned_to: assignedTo,
          task_type: 'marcar_call_1',
          title: taskDef.title,
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
      
      console.log('[useCreateInitialOnboardingTask] Task created:', data);
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

// Complete onboarding task and trigger automation
export function useCompleteOnboardingTaskWithAutomation() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const queryClient = useQueryClient();
  
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
      // 1. Mark current task as done
      const { error: updateError } = await supabase
        .from('onboarding_tasks')
        .update({ 
          status: 'done',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // 2. Check if this is an ADVANCING task (one that moves the client forward)
      const taskDef = ADVANCING_TASK_DEFINITIONS[taskType as keyof typeof ADVANCING_TASK_DEFINITIONS];
      
      // If not an advancing task, just complete it without moving the client
      if (!taskDef) {
        console.log('Task completed without automation (auxiliary task):', taskType);
        return { taskCompleted: true, clientMoved: false, tasksCreated: 0, isAuxiliaryTask: true };
      }

      // 3. Move client to next step and milestone in onboarding
      const { data: existingOnboarding } = await supabase
        .from('client_onboarding')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      const milestoneStartedField = `milestone_${taskDef.nextMilestone}_started_at`;

      if (existingOnboarding) {
        const updateData: any = {
          current_step: taskDef.nextStep,
          current_milestone: taskDef.nextMilestone,
          updated_at: new Date().toISOString(),
        };
        
        // Set milestone start date if moving to a new milestone
        if (taskDef.nextMilestone !== existingOnboarding.current_milestone) {
          updateData[milestoneStartedField] = new Date().toISOString();
        }

        await supabase
          .from('client_onboarding')
          .update(updateData)
          .eq('client_id', clientId);
      } else {
        // Create onboarding record if it doesn't exist
        await supabase
          .from('client_onboarding')
          .insert({
            client_id: clientId,
            current_milestone: taskDef.nextMilestone,
            current_step: taskDef.nextStep,
            milestone_1_started_at: new Date().toISOString(),
          });
      }

      // 4. Handle client status updates
      const { data: client } = await supabase
        .from('clients')
        .select('status, assigned_ads_manager')
        .eq('id', clientId)
        .single();

      // Check if this task completes onboarding
      const isOnboardingComplete = (taskDef as any).isOnboardingComplete === true;

      if (isOnboardingComplete) {
        // Onboarding complete - move to acompanhamento
        const currentDayOfWeek = getDay(new Date());
        const currentDayName = DAY_OF_WEEK_MAP[currentDayOfWeek];

        // Update client status to active
        await supabase
          .from('clients')
          .update({ 
            status: 'active',
            campaign_published_at: new Date().toISOString(),
          })
          .eq('id', clientId);

        // Mark onboarding as completed
        await supabase
          .from('client_onboarding')
          .update({
            completed_at: new Date().toISOString(),
            current_step: 'acompanhamento',
            updated_at: new Date().toISOString(),
          })
          .eq('client_id', clientId);

        // Create daily tracking record with current day of week
        // Use client's assigned_ads_manager or effectiveUserId
        const trackingManagerId = client?.assigned_ads_manager || effectiveUserId;
        await supabase
          .from('client_daily_tracking')
          .upsert({
            client_id: clientId,
            ads_manager_id: trackingManagerId,
            current_day: currentDayName,
            last_moved_at: new Date().toISOString(),
            is_delayed: false,
          });

        return { 
          taskCompleted: true, 
          clientMoved: true, 
          tasksCreated: 0,
          nextStep: 'acompanhamento',
          nextMilestone: 6,
          onboardingCompleted: true,
          dayOfWeek: currentDayName,
        };
      } else if (client?.status === 'new_client') {
        await supabase
          .from('clients')
          .update({ 
            status: 'onboarding',
            onboarding_started_at: new Date().toISOString(),
          })
          .eq('id', clientId);
      }

      // 5. Create tasks based on task definition
      let tasksCreated = 0;
      
      // Determine which task list to use based on task type
      if (taskDef.createMultipleTasks) {
        let tasksToCreate: typeof POST_CALL_1_TASKS = [];
        
        if (taskType === 'realizar_call_1') {
          tasksToCreate = POST_CALL_1_TASKS;
        } else if (taskType === 'enviar_estrategia') {
          tasksToCreate = POST_ESTRATEGIA_TASKS;
        } else if (taskType === 'brifar_criativos') {
          tasksToCreate = POST_BRIFAR_CRIATIVOS_TASKS;
        } else if (taskType === 'brifar_otimizacoes') {
          tasksToCreate = POST_BRIFAR_OTIMIZACOES_TASKS;
        } else if (taskType === 'configurar_conta_anuncios') {
          tasksToCreate = POST_CONFIGURAR_CONTA_TASKS;
        } else if (taskType === 'certificar_consultoria_realizada') {
          tasksToCreate = POST_CERTIFICAR_CONSULTORIA_TASKS;
        }
        
        for (const taskTemplate of tasksToCreate) {
          // Check if task already exists
          const { data: existingTask } = await supabase
            .from('onboarding_tasks')
            .select('id')
            .eq('client_id', clientId)
            .eq('task_type', taskTemplate.taskType)
            .maybeSingle();

          if (!existingTask) {
            const dueDate = addDays(new Date(), taskTemplate.dueDays);
            const title = taskTemplate.titleTemplate.replace('{clientName}', clientName);
            // Use client's assigned_ads_manager or effectiveUserId
            const assignedTo = client?.assigned_ads_manager || effectiveUserId;

            await supabase
              .from('onboarding_tasks')
              .insert({
                client_id: clientId,
                assigned_to: assignedTo,
                task_type: taskTemplate.taskType,
                title: title,
                description: taskTemplate.description,
                status: 'pending',
                due_date: dueDate.toISOString(),
                milestone: taskTemplate.milestone,
              });

            tasksCreated++;
          }
        }
      } else if (taskDef.nextTask) {
        // Single next task creation
        const nextTaskDef = ADVANCING_TASK_DEFINITIONS[taskDef.nextTask as keyof typeof ADVANCING_TASK_DEFINITIONS];
        
        if (nextTaskDef) {
          const { data: existingNextTask } = await supabase
            .from('onboarding_tasks')
            .select('id')
            .eq('client_id', clientId)
            .eq('task_type', taskDef.nextTask)
            .maybeSingle();

          if (!existingNextTask) {
            const dueDate = addDays(new Date(), nextTaskDef.dueDays);
            // Use client's assigned_ads_manager or effectiveUserId
            const assignedTo = client?.assigned_ads_manager || effectiveUserId;

            await supabase
              .from('onboarding_tasks')
              .insert({
                client_id: clientId,
                assigned_to: assignedTo,
                task_type: taskDef.nextTask,
                title: nextTaskDef.title,
                description: `${nextTaskDef.description} Cliente: ${clientName}.`,
                status: 'pending',
                due_date: dueDate.toISOString(),
                milestone: nextTaskDef.milestone,
              });

            tasksCreated++;
          }
        }
      }

      return { 
        taskCompleted: true, 
        clientMoved: true, 
        tasksCreated,
        nextStep: taskDef.nextStep,
        nextMilestone: taskDef.nextMilestone,
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
      // Fire confetti for completion
      if (result.taskCompleted && !result.isAuxiliaryTask) {
        // Confetti will be triggered
      }
      
      if (result.taskCompleted) {
        if ((result as any).isAuxiliaryTask) {
          toast.success('✅ Tarefa concluída!');
        } else if ((result as any).onboardingCompleted) {
          const dayName = (result as any).dayOfWeek || 'hoje';
          toast.success(`🎉 Onboarding concluído! Cliente movido para Acompanhamento - ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}.`);
        } else if (result.tasksCreated > 1) {
          toast.success(`🎉 Tarefa concluída! Cliente movido para Marco ${result.nextMilestone} e ${result.tasksCreated} novas tarefas criadas.`);
        } else if (result.tasksCreated === 1) {
          toast.success(`🎉 Tarefa concluída! Cliente movido e nova tarefa criada.`);
        } else {
          toast.success('🎉 Tarefa concluída! Cliente avançou no onboarding.');
        }
      }
    },
    onSettled: () => {
      // Sync with server after mutation settles
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['client-tracking'] });
    },
  });
}

// Hook to automatically create initial task for new clients
export function useAutoCreateTaskForNewClients(clients: any[]) {
  const createInitialTask = useCreateInitialOnboardingTask();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !clients.length) return;

    // Find new clients that don't have the initial task yet
    const newClients = clients.filter(c => c.status === 'new_client');
    
    newClients.forEach(async (client) => {
      // Check if task already exists
      const { data: existingTask } = await supabase
        .from('onboarding_tasks')
        .select('id')
        .eq('client_id', client.id)
        .eq('task_type', 'marcar_call_1')
        .or('archived.is.null,archived.eq.false')
        .maybeSingle();

      if (!existingTask) {
        createInitialTask.mutate({ 
          clientId: client.id, 
          clientName: client.name 
        });
      }
    });
  }, [clients, user]);
}
