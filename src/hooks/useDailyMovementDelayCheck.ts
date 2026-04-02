import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getMissedBusinessDays, isWeekend, getDateKeyBrazil } from '@/utils/businessDays';

const DELAY_TITLE_PREFIX = 'Atraso de movimentação diária';

/**
 * Runs on page load. Checks all tracked clients for missed business days
 * and creates department_tasks + task_delay_notifications for each missed day.
 * Follows the same pattern as useComercialAutomation.
 */
export function useDailyMovementDelayCheck() {
  const { user, isCEO } = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || processedRef.current) return;

    // Only run for relevant roles or CEO
    const relevantRoles = ['gestor_projetos', 'gestor_ads', 'consultor_comercial', 'sucesso_cliente', 'ceo'];
    if (!user.role || !relevantRoles.includes(user.role)) return;

    // Don't run on weekends
    if (isWeekend(new Date())) return;

    processedRef.current = true;
    runDelayCheck(user.id).catch(err => {
      console.error('[DailyMovementDelayCheck] Error:', err);
    });
  }, [user?.id, user?.role, isCEO]);
}

async function runDelayCheck(currentUserId: string) {
  const now = new Date();

  // Fetch all tracked clients from both sources
  const [comercialRes, adsRes] = await Promise.all([
    supabase
      .from('comercial_tracking')
      .select('id, client_id, last_moved_at, manager_id, manager_name, comercial_user_id')
      .order('last_moved_at', { ascending: true }),
    supabase
      .from('client_daily_tracking')
      .select('id, client_id, last_moved_at, ads_manager_id')
      .order('last_moved_at', { ascending: true }),
  ]);

  const comercialItems = comercialRes.data || [];
  const adsItems = adsRes.data || [];

  // Collect all client IDs for batch lookups
  const allClientIds = new Set<string>();
  comercialItems.forEach(t => allClientIds.add(t.client_id));
  adsItems.forEach(t => allClientIds.add(t.client_id));

  if (allClientIds.size === 0) return;

  // Fetch client info (name + group_id) and profiles
  const [clientsRes, profilesRes, rolesRes] = await Promise.all([
    supabase.from('clients').select('id, name, group_id').in('id', [...allClientIds]),
    supabase.from('profiles').select('user_id, name, group_id'),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c]));
  const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
  const rolesByUser = new Map<string, Set<string>>();
  (rolesRes.data || []).forEach(r => {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
    rolesByUser.get(r.user_id)!.add(r.role);
  });

  // Helper: find user with specific role in a group
  const findUserByRoleInGroup = (role: string, groupId: string | null): string | null => {
    if (!groupId) return null;
    for (const [userId, roles] of rolesByUser.entries()) {
      if (roles.has(role)) {
        const profile = profileMap.get(userId);
        if (profile?.group_id === groupId) return userId;
      }
    }
    return null;
  };

  // Helper: resolve 3 responsible actors for justification
  const resolveActors = (groupId: string | null, adsManagerId?: string): { role: string; userId: string; name: string }[] => {
    const actors: { role: string; userId: string; name: string }[] = [];

    const scId = findUserByRoleInGroup('sucesso_cliente', groupId);
    if (scId) actors.push({ role: 'sucesso_cliente', userId: scId, name: profileMap.get(scId)?.name || 'SC' });

    const gpId = findUserByRoleInGroup('gestor_projetos', groupId);
    if (gpId) actors.push({ role: 'gestor_projetos', userId: gpId, name: profileMap.get(gpId)?.name || 'GP' });

    const adsId = adsManagerId || findUserByRoleInGroup('gestor_ads', groupId);
    if (adsId) actors.push({ role: 'gestor_ads', userId: adsId, name: profileMap.get(adsId)?.name || 'ADS' });

    return actors;
  };

  // Process comercial tracking
  for (const tracking of comercialItems) {
    if (!tracking.last_moved_at) continue;
    const client = clientMap.get(tracking.client_id);
    if (!client) continue;

    const missedDays = getMissedBusinessDays(new Date(tracking.last_moved_at), now);
    for (const refDate of missedDays) {
      await createDelayTaskIfNotExists({
        clientId: client.id,
        clientName: client.name,
        groupId: client.group_id,
        referenceDate: refDate,
        sourceArea: 'treinador_comercial',
        responsibleUserId: tracking.comercial_user_id,
        actors: resolveActors(client.group_id),
      });
    }
  }

  // Process ADS tracking
  for (const tracking of adsItems) {
    if (!tracking.last_moved_at) continue;
    const client = clientMap.get(tracking.client_id);
    if (!client) continue;

    const missedDays = getMissedBusinessDays(new Date(tracking.last_moved_at), now);
    for (const refDate of missedDays) {
      await createDelayTaskIfNotExists({
        clientId: client.id,
        clientName: client.name,
        groupId: client.group_id,
        referenceDate: refDate,
        sourceArea: 'gestor_ads',
        responsibleUserId: tracking.ads_manager_id,
        actors: resolveActors(client.group_id, tracking.ads_manager_id),
      });
    }
  }
}

async function createDelayTaskIfNotExists(params: {
  clientId: string;
  clientName: string;
  groupId: string | null;
  referenceDate: string;
  sourceArea: 'treinador_comercial' | 'gestor_ads';
  responsibleUserId: string;
  actors: { role: string; userId: string; name: string }[];
}) {
  const taskTitle = `${DELAY_TITLE_PREFIX} - ${params.clientName} - ${params.referenceDate}`;
  const sourceLabel = params.sourceArea === 'treinador_comercial' ? 'Treinador Comercial' : 'Gestor de ADS';

  // Idempotency: check if task already exists
  const { data: existing } = await supabase
    .from('department_tasks')
    .select('id')
    .eq('related_client_id', params.clientId)
    .eq('department', 'gestor_projetos')
    .ilike('title', `${DELAY_TITLE_PREFIX} - % - ${params.referenceDate}`)
    .maybeSingle();

  if (existing) return;

  // Find gestor_projetos to assign the task to
  let assigneeId = params.responsibleUserId;
  // Try to find GP in the group for task assignment
  const { data: gpRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'gestor_projetos');

  if (gpRoles && gpRoles.length > 0 && params.groupId) {
    const gpIds = gpRoles.map(r => r.user_id);
    const { data: gpProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .in('user_id', gpIds)
      .eq('group_id', params.groupId)
      .limit(1)
      .maybeSingle();
    if (gpProfile) assigneeId = gpProfile.user_id;
  }

  // Create department task
  const { data: task, error: taskError } = await supabase
    .from('department_tasks')
    .insert({
      user_id: assigneeId,
      title: taskTitle,
      description: JSON.stringify({
        type: 'late_daily_movement',
        clientId: params.clientId,
        referenceDate: params.referenceDate,
        sourceArea: params.sourceArea,
        sourceLabel,
      }),
      task_type: 'daily',
      status: 'todo',
      priority: 'high',
      department: 'gestor_projetos',
      related_client_id: params.clientId,
      due_date: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (taskError) {
    console.error('[DailyMovementDelayCheck] Error creating task:', taskError);
    return;
  }

  // Create task_delay_notifications for each responsible actor
  for (const actor of params.actors) {
    const notifTitle = `${DELAY_TITLE_PREFIX} - ${params.clientName} (${sourceLabel})`;
    await supabase
      .from('task_delay_notifications')
      .insert({
        task_id: task.id,
        task_table: 'department_tasks',
        task_owner_id: actor.userId,
        task_owner_name: actor.name,
        task_owner_role: actor.role,
        task_title: notifTitle,
        task_due_date: `${params.referenceDate}T23:59:59Z`,
      })
      .then(({ error }) => {
        if (error && !error.message.includes('duplicate')) {
          console.error('[DailyMovementDelayCheck] Notification error:', error);
        }
      });
  }

  // Create system_notifications for 17h reminder pattern
  for (const actor of params.actors) {
    const todayKey = getDateKeyBrazil();
    await supabase
      .from('system_notifications')
      .insert({
        recipient_id: actor.userId,
        recipient_role: actor.role,
        notification_type: 'daily_movement_delay',
        title: 'Atraso de movimentação diária',
        message: `O cliente ${params.clientName} não foi movimentado no dia ${params.referenceDate} (${sourceLabel}). Justificativa obrigatória.`,
        client_id: params.clientId,
        task_id: task.id,
        priority: 'high',
        metadata: {
          referenceDate: params.referenceDate,
          sourceArea: params.sourceArea,
          notificationDate: todayKey,
        },
      })
      .then(({ error }) => {
        if (error) {
          console.error('[DailyMovementDelayCheck] System notification error:', error);
        }
      });
  }
}
