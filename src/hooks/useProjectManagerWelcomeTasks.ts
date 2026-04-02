import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Title prefix used to identify welcome tasks
const WELCOME_TITLE_PREFIX = 'Dar boas-vindas para ';

export interface WelcomeTask {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  team: {
    gestorProjetos: string | null;
    treinadorComercial: string | null;
    gestorAds: string | null;
    sucessoCliente: string | null;
    consultorMarketplace: string | null;
    gestorCM: string | null;
  };
}

/**
 * Fetches pending welcome tasks for the current gestor_projetos user.
 * A welcome task is identified by its title prefix + department + status.
 */
export function usePendingWelcomeTasks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pm-welcome-tasks', user?.id],
    queryFn: async (): Promise<WelcomeTask[]> => {
      if (!user?.id) return [];

      // Fetch pending welcome tasks for this user
      const { data: tasks, error } = await supabase
        .from('department_tasks')
        .select('id, title, related_client_id')
        .eq('user_id', user.id)
        .eq('department', 'gestor_projetos')
        .eq('status', 'todo')
        .eq('archived', false)
        .ilike('title', `${WELCOME_TITLE_PREFIX}%`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!tasks || tasks.length === 0) return [];

      // Get client IDs
      const clientIds = tasks
        .map(t => t.related_client_id)
        .filter((id): id is string => !!id);

      if (clientIds.length === 0) return [];

      // Fetch client details + team assignments
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, assigned_ads_manager, assigned_comercial, group_id')
        .in('id', clientIds);

      const clientMap = new Map((clients || []).map(c => [c.id, c]));

      // Fetch all relevant profiles for team display
      const allUserIds = new Set<string>();
      (clients || []).forEach(c => {
        if (c.assigned_ads_manager) allUserIds.add(c.assigned_ads_manager);
        if (c.assigned_comercial) allUserIds.add(c.assigned_comercial);
      });
      allUserIds.add(user.id); // gestor_projetos themselves

      // Also find sucesso_cliente, gestor_crm users in same groups
      const groupIds = [...new Set((clients || []).map(c => c.group_id).filter(Boolean))] as string[];

      let teamProfiles: { user_id: string; name: string; group_id: string | null }[] = [];
      let teamRoles: { user_id: string; role: string }[] = [];

      if (groupIds.length > 0) {
        const [profilesRes, rolesRes] = await Promise.all([
          supabase.from('profiles').select('user_id, name, group_id').in('group_id', groupIds),
          supabase.from('user_roles').select('user_id, role'),
        ]);
        teamProfiles = profilesRes.data || [];
        teamRoles = rolesRes.data || [];
      }

      // Also fetch profiles for directly assigned users
      if (allUserIds.size > 0) {
        const { data: directProfiles } = await supabase
          .from('profiles')
          .select('user_id, name, group_id')
          .in('user_id', [...allUserIds]);
        (directProfiles || []).forEach(p => {
          if (!teamProfiles.find(tp => tp.user_id === p.user_id)) {
            teamProfiles.push(p);
          }
        });
      }

      const nameMap = new Map(teamProfiles.map(p => [p.user_id, p.name]));
      const roleMap = new Map<string, Set<string>>();
      teamRoles.forEach(r => {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, new Set());
        roleMap.get(r.user_id)!.add(r.role);
      });

      // Helper: find user by role in a group
      const findByRoleInGroup = (role: string, groupId: string | null): string | null => {
        if (!groupId) return null;
        for (const p of teamProfiles) {
          if (p.group_id === groupId && roleMap.get(p.user_id)?.has(role)) {
            return nameMap.get(p.user_id) || null;
          }
        }
        return null;
      };

      // Build results
      return tasks
        .filter(t => t.related_client_id && clientMap.has(t.related_client_id))
        .map(t => {
          const client = clientMap.get(t.related_client_id!)!;
          return {
            id: t.id,
            title: t.title,
            clientId: client.id,
            clientName: client.name,
            team: {
              gestorProjetos: nameMap.get(user.id) || null,
              treinadorComercial: client.assigned_comercial
                ? nameMap.get(client.assigned_comercial) || null
                : findByRoleInGroup('consultor_comercial', client.group_id),
              gestorAds: client.assigned_ads_manager
                ? nameMap.get(client.assigned_ads_manager) || null
                : null,
              sucessoCliente: findByRoleInGroup('sucesso_cliente', client.group_id),
              consultorMarketplace: findByRoleInGroup('outbound', client.group_id),
              gestorCM: findByRoleInGroup('gestor_crm', client.group_id),
            },
          };
        });
    },
    enabled: !!user && user.role === 'gestor_projetos',
    refetchOnWindowFocus: true,
  });
}

/**
 * Mutation to confirm a welcome task (mark as done).
 */
export function useConfirmWelcomeTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      welcomedClient,
      presentedTeam,
      addedEveryoneToGroup,
    }: {
      taskId: string;
      welcomedClient: boolean;
      presentedTeam: boolean;
      addedEveryoneToGroup: boolean;
    }) => {
      if (!welcomedClient || !presentedTeam || !addedEveryoneToGroup) {
        throw new Error('Todas as confirmações devem ser positivas');
      }

      const { error } = await supabase
        .from('department_tasks')
        .update({
          status: 'done',
          description: JSON.stringify({
            type: 'project_manager_welcome_confirmed',
            welcomedClient,
            presentedTeam,
            addedEveryoneToGroup,
            confirmedAt: new Date().toISOString(),
          }),
        })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-welcome-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Boas-vindas confirmadas com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao confirmar boas-vindas');
    },
  });
}

/**
 * Creates a welcome task for the gestor_projetos when a Millennials Growth client is registered.
 * Called from useClientRegistration after client creation.
 */
export async function createWelcomeTaskForProjectManager(
  clientId: string,
  clientName: string,
  groupId: string | null,
) {
  if (!groupId) {
    console.warn('[WelcomeTask] Cliente sem group_id, não é possível criar tarefa');
    return;
  }

  // Find gestor_projetos in the same group
  const { data: gpRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'gestor_projetos');

  if (!gpRoles || gpRoles.length === 0) return;

  const gpUserIds = gpRoles.map(r => r.user_id);

  const { data: gpProfiles } = await supabase
    .from('profiles')
    .select('user_id')
    .in('user_id', gpUserIds)
    .eq('group_id', groupId);

  if (!gpProfiles || gpProfiles.length === 0) {
    console.warn('[WelcomeTask] Nenhum Gestor de Projetos encontrado no grupo', groupId);
    return;
  }

  // Create task for each gestor_projetos in the group (usually just 1)
  for (const gp of gpProfiles) {
    // Check if task already exists (idempotency)
    const { data: existing } = await supabase
      .from('department_tasks')
      .select('id')
      .eq('user_id', gp.user_id)
      .eq('related_client_id', clientId)
      .eq('department', 'gestor_projetos')
      .ilike('title', `${WELCOME_TITLE_PREFIX}%`)
      .neq('status', 'done')
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from('department_tasks').insert({
      user_id: gp.user_id,
      title: `${WELCOME_TITLE_PREFIX}${clientName}`,
      description: JSON.stringify({ type: 'project_manager_welcome', trigger: 'client_created' }),
      task_type: 'daily',
      status: 'todo',
      priority: 'high',
      department: 'gestor_projetos',
      related_client_id: clientId,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) {
      console.error('[WelcomeTask] Erro ao criar tarefa de boas-vindas:', error);
    }
  }
}
