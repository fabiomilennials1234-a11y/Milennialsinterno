import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useComercialTracking } from './useComercialTracking';
import { resolveTaskOwner } from './utils/resolveTaskOwner';

// ============================================================
// TC (Treinador Comercial) Monthly 30-day Cycle
// ============================================================
// At day 7 of the 30-day cycle, auto-creates "Marcar alinhamento mensal"
// task in TC kanban + cross-kanban task in GP kanban.
// Task chain: marcar → gerar diagnostica → realizar alinhamento → reset cycle.

export const TC_CYCLE_AUTO_TASK_TYPES = {
  MARCAR_ALINHAMENTO_MENSAL: 'tc_marcar_alinhamento_mensal',
  GERAR_DIAGNOSTICA: 'tc_gerar_diagnostica_comercial',
  REALIZAR_ALINHAMENTO: 'tc_realizar_alinhamento_mensal',
};

const TC_CYCLE_DAYS = 30;
const TC_TRIGGER_DAY = 7;

/**
 * Returns days elapsed since tc_cycle_started_at.
 */
export function getTCCycleDaysSince(cycleStartedAt: string | null): number {
  if (!cycleStartedAt) return 0;
  const ref = new Date(cycleStartedAt);
  const now = new Date();
  return Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns days remaining in the 30-day TC cycle.
 */
export function getTCCycleDaysRemaining(cycleStartedAt: string | null): number {
  const daysSince = getTCCycleDaysSince(cycleStartedAt);
  return Math.max(0, TC_CYCLE_DAYS - daysSince);
}

/**
 * Finds gestor_projetos users in the same organization group as the client.
 * Resolves client → squad → group, then finds GPs in that group.
 */
async function findGPsForClient(clientId: string): Promise<{ userId: string; name: string }[]> {
  // Get client's squad_id
  const { data: client } = await supabase
    .from('clients')
    .select('squad_id')
    .eq('id', clientId)
    .maybeSingle();

  if (!client?.squad_id) return [];

  // Get squad's group_id
  const { data: squad } = await supabase
    .from('squads')
    .select('group_id')
    .eq('id', client.squad_id)
    .maybeSingle();

  if (!squad?.group_id) return [];

  // Find gestor_projetos in the same group
  const { data: gpRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'gestor_projetos');

  if (!gpRoles || gpRoles.length === 0) return [];

  const gpUserIds = gpRoles.map(r => r.user_id);

  const { data: gpProfiles } = await supabase
    .from('profiles')
    .select('user_id, name')
    .in('user_id', gpUserIds)
    .eq('group_id', squad.group_id);

  if (!gpProfiles || gpProfiles.length === 0) return [];

  return gpProfiles.map(p => ({ userId: p.user_id, name: p.name }));
}

/**
 * Creates the first task of the TC monthly cycle for a client,
 * plus the cross-kanban GP task.
 */
async function createTCCycleStartTask(
  tcUserId: string,
  clientId: string,
  clientName: string,
) {
  // Idempotency: check if task already exists (any status including done for this cycle)
  // We check non-done to allow cycle restart after completion
  const { data: existing } = await supabase
    .from('comercial_tasks')
    .select('id')
    .eq('related_client_id', clientId)
    .eq('auto_task_type', TC_CYCLE_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_MENSAL)
    .in('status', ['todo', 'doing'])
    .limit(1);

  if (existing && existing.length > 0) return;

  // Resolve TC owner
  const ownerId = await resolveTaskOwner(clientId, 'assigned_comercial', tcUserId);

  // Get TC name for cross-kanban title
  const { data: tcProfile } = await supabase
    .from('profiles')
    .select('name')
    .eq('user_id', ownerId)
    .maybeSingle();
  const tcName = tcProfile?.name || 'Treinador Comercial';

  // Find GPs for cross-kanban
  const gps = await findGPsForClient(clientId);
  const gpName = gps.length > 0 ? gps[0].name : 'Gestor de Projetos';

  // Create TC task
  await supabase.from('comercial_tasks').insert({
    user_id: ownerId,
    title: `Marcar alinhamento mensal ${clientName} junto ao gestor de projetos ${gpName}`,
    description: `Tarefa automática do ciclo mensal de 30 dias para ${clientName}`,
    task_type: 'daily',
    status: 'todo',
    priority: 'high',
    related_client_id: clientId,
    is_auto_generated: true,
    auto_task_type: TC_CYCLE_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_MENSAL,
    due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // Cross-kanban: create GP task(s)
  for (const gp of gps) {
    // Idempotency check for GP task
    const { data: existingGP } = await supabase
      .from('department_tasks')
      .select('id')
      .eq('user_id', gp.userId)
      .eq('related_client_id', clientId)
      .eq('department', 'gestor_projetos')
      .ilike('title', 'Marcar reunião de alinhamento comercial com%')
      .in('status', ['todo', 'doing'])
      .limit(1);

    if (existingGP && existingGP.length > 0) continue;

    await supabase.from('department_tasks').insert({
      user_id: gp.userId,
      title: `Marcar reunião de alinhamento comercial com ${clientName}`,
      description: JSON.stringify({ type: 'tc_cross_kanban_alignment', trigger: 'tc_monthly_cycle' }),
      task_type: 'daily',
      status: 'todo',
      priority: 'high',
      department: 'gestor_projetos',
      related_client_id: clientId,
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
}

/**
 * Handles TC cycle task chain progression.
 * Called when a TC cycle task is completed.
 */
export async function handleTCCycleTaskCompletion(
  completedTaskType: string,
  clientId: string,
  clientName: string,
  userId: string,
) {
  const ownerId = await resolveTaskOwner(clientId, 'assigned_comercial', userId);

  switch (completedTaskType) {
    case TC_CYCLE_AUTO_TASK_TYPES.MARCAR_ALINHAMENTO_MENSAL: {
      // Create next: "Gerar Diagnóstica comercial [Client]"
      const { data: existing } = await supabase
        .from('comercial_tasks')
        .select('id')
        .eq('related_client_id', clientId)
        .eq('auto_task_type', TC_CYCLE_AUTO_TASK_TYPES.GERAR_DIAGNOSTICA)
        .in('status', ['todo', 'doing'])
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from('comercial_tasks').insert({
          user_id: ownerId,
          title: `Gerar Diagnóstica comercial ${clientName}`,
          description: `Tarefa automática do ciclo mensal para ${clientName}`,
          task_type: 'daily',
          status: 'todo',
          priority: 'high',
          related_client_id: clientId,
          is_auto_generated: true,
          auto_task_type: TC_CYCLE_AUTO_TASK_TYPES.GERAR_DIAGNOSTICA,
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
      break;
    }

    case TC_CYCLE_AUTO_TASK_TYPES.GERAR_DIAGNOSTICA: {
      // Create next: "Realizar alinhamento mensal [Client]"
      const { data: existing } = await supabase
        .from('comercial_tasks')
        .select('id')
        .eq('related_client_id', clientId)
        .eq('auto_task_type', TC_CYCLE_AUTO_TASK_TYPES.REALIZAR_ALINHAMENTO)
        .in('status', ['todo', 'doing'])
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from('comercial_tasks').insert({
          user_id: ownerId,
          title: `Realizar alinhamento mensal ${clientName}`,
          description: `Tarefa automática do ciclo mensal para ${clientName}`,
          task_type: 'daily',
          status: 'todo',
          priority: 'high',
          related_client_id: clientId,
          is_auto_generated: true,
          auto_task_type: TC_CYCLE_AUTO_TASK_TYPES.REALIZAR_ALINHAMENTO,
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
      break;
    }

    case TC_CYCLE_AUTO_TASK_TYPES.REALIZAR_ALINHAMENTO: {
      // Cycle complete — reset tc_cycle_started_at
      const { error } = await supabase
        .from('comercial_tracking')
        .update({ tc_cycle_started_at: new Date().toISOString() })
        .eq('client_id', clientId)
        .eq('comercial_user_id', userId);

      if (error) {
        console.error('[TCCycle] Failed to reset cycle:', error.message);
      }
      break;
    }
  }
}

/**
 * Hook: auto-creates TC cycle start tasks on page load.
 * Runs for consultor_comercial and CEO roles.
 * Checks all tracking entries where daysSince(tc_cycle_started_at) >= 7.
 */
export function useTCMonthlyCycle() {
  const { user } = useAuth();
  const { data: allTracking = [] } = useComercialTracking();
  const processedRef = useRef(false);

  // Stable ID list to avoid re-running on every tracking data change
  const trackingIds = allTracking.map(t => t.id).sort().join(',');

  useEffect(() => {
    if (!user?.id || processedRef.current) return;
    if (!['consultor_comercial', 'ceo'].includes(user.role || '')) return;
    if (allTracking.length === 0) return;

    processedRef.current = true;

    const checkAndCreateTasks = async () => {
      for (const tracking of allTracking) {
        const daysSince = getTCCycleDaysSince(tracking.tc_cycle_started_at || tracking.created_at);

        if (daysSince < TC_TRIGGER_DAY) continue;

        const clientName = tracking.client?.name || 'Cliente';

        try {
          await createTCCycleStartTask(user.id, tracking.client_id, clientName);
        } catch (err) {
          console.error('[TCCycle] Failed to create cycle task for client:', tracking.client_id, err);
        }
      }
    };

    checkAndCreateTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, trackingIds]);
}
