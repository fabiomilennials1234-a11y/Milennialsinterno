import type { SupabaseClient } from '@supabase/supabase-js';
import { GROWTH_TASK_PREFIX, detectGrowthTaskType } from '../useGrowthOnboarding';

export interface GrowthCompletionResult {
  growthAdvanced: boolean;
  growthTeamSelectionNeeded: string | null;
  growthOnboardingComplete: boolean;
}

const EMPTY_RESULT: GrowthCompletionResult = {
  growthAdvanced: false,
  growthTeamSelectionNeeded: null,
  growthOnboardingComplete: false,
};

function addBizDays(days: number): Date {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}

/**
 * Handle Growth task completion automation.
 * Pure function (no hooks) — receives supabase client as parameter.
 *
 * When a gestor_projetos Growth task moves to 'done', creates the
 * next task in the sequence and updates growth_onboarding_step.
 */
export async function handleGrowthTaskCompletion(
  supabase: SupabaseClient,
  taskId: string,
  userId: string | undefined,
): Promise<GrowthCompletionResult> {
  const { data: growthTask } = await supabase
    .from('department_tasks')
    .select('related_client_id, department, title, description')
    .eq('id', taskId)
    .single();

  if (growthTask?.department !== 'gestor_projetos' || !growthTask.related_client_id) {
    return EMPTY_RESULT;
  }

  const growthType = detectGrowthTaskType({
    description: growthTask.description,
    title: growthTask.title,
  });
  if (!growthType) return EMPTY_RESULT;

  const clientId = growthTask.related_client_id;
  const { data: client } = await supabase
    .from('clients')
    .select('name, razao_social, growth_onboarding_step, growth_flow_version')
    .eq('id', clientId)
    .single();

  const clientName = (client?.razao_social as string | null) || client?.name || 'Cliente';

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

  switch (growthType) {
    case 'welcome': {
      if (!hasActiveGrowthTask) {
        const dueDate = addBizDays(1);
        await supabase.from('department_tasks').insert({
          user_id: userId,
          title: `${GROWTH_TASK_PREFIX.schedule_call}${clientName}`,
          description: 'growth:schedule_call',
          task_type: 'daily',
          status: 'todo',
          priority: 'high',
          department: 'gestor_projetos',
          related_client_id: clientId,
          due_date: dueDate.toISOString(),
        } as any);
      }
      return { growthAdvanced: true, growthTeamSelectionNeeded: null, growthOnboardingComplete: false };
    }
    case 'schedule_call': {
      await supabase
        .from('clients')
        .update({ growth_onboarding_step: 'call_1_agendada' } as any)
        .eq('id', clientId);

      if (!hasActiveGrowthTask) {
        const dueDate = addBizDays(1);
        await supabase.from('department_tasks').insert({
          user_id: userId,
          title: `${GROWTH_TASK_PREFIX.do_call}${clientName}`,
          description: 'growth:do_call',
          task_type: 'daily',
          status: 'todo',
          priority: 'high',
          department: 'gestor_projetos',
          related_client_id: clientId,
          due_date: dueDate.toISOString(),
        } as any);
      }
      return { growthAdvanced: true, growthTeamSelectionNeeded: null, growthOnboardingComplete: false };
    }
    case 'do_call': {
      return { growthAdvanced: false, growthTeamSelectionNeeded: clientId, growthOnboardingComplete: false };
    }
    case 'alinhar_projeto':
    case 'align_project': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isV2 = (client as any)?.growth_flow_version === 2;
      if (isV2) {
        await supabase.rpc('growth_advance_gp_step', {
          p_client_id: clientId,
          p_new_step: 'acompanhamento_gestores',
        });
      } else {
        await supabase
          .from('clients')
          .update({ growth_onboarding_step: null } as any)
          .eq('id', clientId);
      }

      // Dismiss "Esperar Briefing" tag — briefing is done
      await supabase
        .from('client_tags')
        .update({ dismissed_at: new Date().toISOString() } as never)
        .eq('client_id', clientId)
        .eq('name', 'Esperar Briefing')
        .is('dismissed_at', null);

      return { growthAdvanced: false, growthTeamSelectionNeeded: null, growthOnboardingComplete: true };
    }
    default:
      return EMPTY_RESULT;
  }
}
