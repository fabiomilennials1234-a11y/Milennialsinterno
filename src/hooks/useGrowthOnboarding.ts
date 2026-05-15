import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fireCelebration } from '@/lib/confetti';

// ── Growth onboarding task sequence ──────────────────────────────────────────
// Each step produces a named task. When that task is moved to 'done',
// the next task in the sequence is created automatically.
//
// Steps:
// 1. "Dar boas-vindas para [Nome]"          (created by RPC on client creation)
// 2. "Marcar Call #1 [Nome]"                (created when step 1 done)
// 3. "Realizar Call 1 + Escolher equipe [Nome]"  (created when step 2 done)
// 4. Pop-up "ESCOLHER EQUIPE GROWTH"        (triggered when step 3 done — Sub-task 4)
// 5. "Alinhar Projeto com Equipe + ..."     (created after team assignment via growth_assign_team)

const GROWTH_TASK_PREFIX = {
  welcome: 'Dar boas-vindas para ',
  schedule_call: 'Marcar Call #1 ',
  do_call: 'Realizar Call 1 + Escolher equipe ',
  align_project: 'Alinhar Projeto com Equipe + Adicionar no grupo ',
} as const;

type GrowthTaskType = keyof typeof GROWTH_TASK_PREFIX;

const GROWTH_TYPES = new Set<string>(['welcome', 'schedule_call', 'do_call', 'align_project']);

/**
 * Detect which growth task type a task matches.
 * Primary: check description discriminator (growth:{type}).
 * Fallback: check title prefix (backward compat for tasks created before backfill).
 */
function detectGrowthTaskType(task: { description?: string | null; title: string }): GrowthTaskType | null {
  // Primary: description discriminator
  if (task.description?.startsWith('growth:')) {
    const type = task.description.slice('growth:'.length);
    if (GROWTH_TYPES.has(type)) return type as GrowthTaskType;
  }
  // Fallback: title prefix matching
  if (task.title.startsWith(GROWTH_TASK_PREFIX.align_project)) return 'align_project';
  if (task.title.startsWith(GROWTH_TASK_PREFIX.do_call)) return 'do_call';
  if (task.title.startsWith(GROWTH_TASK_PREFIX.schedule_call)) return 'schedule_call';
  if (task.title.startsWith(GROWTH_TASK_PREFIX.welcome)) return 'welcome';
  return null;
}

/** Add 1 business day to a date (skip Sat/Sun) */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

export interface GrowthClient {
  id: string;
  name: string;
  razao_social: string | null;
  growth_onboarding_step: string | null;
  group_id: string | null;
  created_at: string;
}

/**
 * Fetch Growth clients in "Novos Clientes" phase.
 * These are clients with growth_onboarding_step IN ('novos_clientes', 'call_1_agendada')
 * that belong to the GP's group.
 */
export function useGrowthNovosClientes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['growth-novos-clientes', user?.group_id],
    queryFn: async (): Promise<GrowthClient[]> => {
      if (!user?.group_id) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, growth_onboarding_step, group_id, created_at')
        .eq('archived', false)
        .eq('group_id', user.group_id)
        .in('growth_onboarding_step', ['novos_clientes', 'call_1_agendada', 'equipe_designada'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as GrowthClient[];
    },
    enabled: !!user?.id && !!user?.group_id,
    staleTime: 30_000,
  });
}

/**
 * Fetch Growth clients in "Acompanhamento" phase.
 * These are clients with growth_onboarding_step IS NULL AND status != 'churned'
 * that belong to the GP's group and have contracted millennials-growth.
 */
export function useGrowthAcompanhamento() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['growth-acompanhamento', user?.group_id],
    queryFn: async (): Promise<GrowthClient[]> => {
      if (!user?.group_id) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, growth_onboarding_step, group_id, created_at')
        .eq('archived', false)
        .eq('group_id', user.group_id)
        .is('growth_onboarding_step', null)
        .contains('contracted_products', ['millennials-growth'])
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as GrowthClient[];
    },
    enabled: !!user?.id && !!user?.group_id,
    staleTime: 60_000,
  });
}

/**
 * Fetch department_tasks for Growth clients in the GP's group.
 * Returns tasks that are related to Growth onboarding (gestor_projetos department,
 * linked to growth clients via related_client_id).
 */
export function useGrowthTasks(clientIds: string[]) {
  const sortedIds = [...clientIds].sort();
  const key = sortedIds.join(',');

  return useQuery({
    queryKey: ['growth-gp-tasks', key],
    queryFn: async () => {
      if (sortedIds.length === 0) return new Map<string, any[]>();

      const { data, error } = await supabase
        .from('department_tasks')
        .select('id, title, description, status, due_date, related_client_id, created_at')
        .eq('department', 'gestor_projetos')
        .eq('archived', false)
        .in('related_client_id', sortedIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const map = new Map<string, any[]>();
      for (const id of sortedIds) map.set(id, []);
      for (const task of data || []) {
        if (task.related_client_id) {
          const list = map.get(task.related_client_id);
          if (list) list.push(task);
        }
      }
      return map;
    },
    enabled: sortedIds.length > 0,
    staleTime: 15_000,
  });
}

interface CompleteGrowthTaskParams {
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  clientId: string;
  clientName: string;
}

/**
 * When a Growth GP task is moved to 'done', create the next task
 * in the sequence and update growth_onboarding_step as needed.
 *
 * Returns an object indicating what happened so the caller can
 * trigger UI side-effects (pop-up for team selection, etc).
 */
export function useCompleteGrowthTask() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, taskTitle, taskDescription, clientId, clientName }: CompleteGrowthTaskParams) => {
      if (!user?.id) throw new Error('auth required');

      const taskType = detectGrowthTaskType({ description: taskDescription, title: taskTitle });
      if (!taskType) {
        // Not a growth task — just complete normally
        return { action: 'normal' as const };
      }

      // Mark the task as done
      const { error: updateError } = await supabase
        .from('department_tasks')
        .update({ status: 'done' } as any)
        .eq('id', taskId);

      if (updateError) throw updateError;

      const displayName = clientName;
      const ownerId = user.id;

      // Guard: check if a non-done growth task already exists for this client
      // Uses description discriminator for precise matching
      const { data: existingGrowthTasks } = await supabase
        .from('department_tasks')
        .select('id')
        .eq('related_client_id', clientId)
        .eq('department', 'gestor_projetos')
        .ilike('description', 'growth:%')
        .in('status', ['todo', 'doing'])
        .eq('archived', false)
        .neq('id', taskId)
        .limit(1);

      const hasActiveGrowthTask = existingGrowthTasks && existingGrowthTasks.length > 0;

      switch (taskType) {
        case 'welcome': {
          if (!hasActiveGrowthTask) {
            const dueDate = addBusinessDays(new Date(), 1);
            await supabase.from('department_tasks').insert({
              user_id: ownerId,
              title: `${GROWTH_TASK_PREFIX.schedule_call}${displayName}`,
              description: 'growth:schedule_call',
              task_type: 'daily',
              status: 'todo',
              priority: 'high',
              department: 'gestor_projetos',
              related_client_id: clientId,
              due_date: dueDate.toISOString(),
            } as any);
          }
          return { action: 'next_task' as const, nextTask: 'schedule_call' };
        }

        case 'schedule_call': {
          await supabase
            .from('clients')
            .update({ growth_onboarding_step: 'call_1_agendada' } as any)
            .eq('id', clientId);

          if (!hasActiveGrowthTask) {
            const dueDate = addBusinessDays(new Date(), 1);
            await supabase.from('department_tasks').insert({
              user_id: ownerId,
              title: `${GROWTH_TASK_PREFIX.do_call}${displayName}`,
              description: 'growth:do_call',
              task_type: 'daily',
              status: 'todo',
              priority: 'high',
              department: 'gestor_projetos',
              related_client_id: clientId,
              due_date: dueDate.toISOString(),
            } as any);
          }
          return { action: 'next_task' as const, nextTask: 'do_call' };
        }

        case 'do_call': {
          // Step 3 done -> Trigger team selection pop-up (Sub-task 4)
          // Don't advance step yet — growth_assign_team RPC does that
          return { action: 'team_selection_needed' as const, clientId };
        }

        case 'align_project': {
          // Step 5 done -> Growth onboarding complete
          // growth_onboarding_step = NULL (trigger handles "Esperar Briefing" dismissal)
          await supabase
            .from('clients')
            .update({ growth_onboarding_step: null } as any)
            .eq('id', clientId);
          return { action: 'onboarding_complete' as const };
        }

        default:
          return { action: 'normal' as const };
      }
    },
    onSuccess: (result) => {
      fireCelebration();
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['growth-novos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['growth-gp-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['growth-acompanhamento'] });
      queryClient.invalidateQueries({ queryKey: ['client-tags'] });
      queryClient.invalidateQueries({ queryKey: ['client-tags-batch'] });

      switch (result?.action) {
        case 'next_task':
          toast.success('Tarefa concluida — proxima tarefa criada!');
          break;
        case 'team_selection_needed':
          // Caller handles the pop-up
          break;
        case 'onboarding_complete':
          toast.success('Onboarding Growth concluido!');
          break;
      }
    },
    onError: (error: any) => {
      toast.error('Erro ao concluir tarefa', { description: error.message });
    },
  });
}

export { GROWTH_TASK_PREFIX, detectGrowthTaskType };
