import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamProfessional {
  user_id: string;
  name: string;
  client_count: number;
}

const MANAGER_LIMITS: Record<string, number> = {
  gestor_ads: 25,
  consultor_comercial: 80,
  consultor_mktplace: 80,
  gestor_crm: 80,
  sucesso_cliente: 50,
};

export { MANAGER_LIMITS as GROWTH_TEAM_LIMITS };

/**
 * Roles that are org-wide (not scoped to a group).
 * These professionals have group_id = NULL in profiles and must be listed
 * regardless of the client's group.
 */
const ORG_WIDE_ROLES = new Set(['gestor_ads', 'consultor_comercial', 'gestor_crm', 'consultor_mktplace']);

/**
 * Fetch professionals of a given role along with their active client count.
 *
 * For group-scoped roles (e.g. sucesso_cliente): filters by the client's group_id.
 * For org-wide roles (gestor_ads, consultor_comercial, gestor_crm, consultor_mktplace): lists ALL professionals
 * with that role, ignoring group_id.
 *
 * Used by GrowthTeamSelectionModal to populate selects with portfolio info.
 */
export function useGroupProfessionalsByRole(role: string, groupId: string | null) {
  const isOrgWide = ORG_WIDE_ROLES.has(role);

  return useQuery<TeamProfessional[]>({
    queryKey: ['group-professionals', role, groupId],
    queryFn: async () => {
      // Group-scoped roles need a groupId; org-wide roles don't.
      if (!isOrgWide && !groupId) return [];

      // 1. Get user_ids with this role
      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', role as never);
      if (roleErr) throw roleErr;

      const roleIds = (roleRows || []).map(r => r.user_id);
      if (roleIds.length === 0) return [];

      // 2. Filter profiles — by group_id for group-scoped, all for org-wide
      let profileQuery = supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', roleIds);

      if (!isOrgWide && groupId) {
        profileQuery = profileQuery.eq('group_id', groupId);
      }

      const { data: profiles, error: profErr } = await profileQuery;
      if (profErr) throw profErr;

      const filtered = (profiles || []).filter(p => !!p.name);
      if (filtered.length === 0) return [];

      const userIds = filtered.map(p => p.user_id);

      // 3. Count active clients per professional
      const countField = ROLE_TO_CLIENT_FIELD[role];
      if (!countField) {
        return filtered.map(p => ({ user_id: p.user_id, name: p.name, client_count: 0 }));
      }

      const { data: clients, error: clErr } = await supabase
        .from('clients')
        .select(countField)
        .in(countField, userIds)
        .eq('archived', false)
        .neq('status', 'churned');
      if (clErr) throw clErr;

      const counts: Record<string, number> = {};
      for (const id of userIds) counts[id] = 0;
      for (const c of clients || []) {
        const assignee = (c as Record<string, string>)[countField];
        if (assignee && counts[assignee] !== undefined) {
          counts[assignee]++;
        }
      }

      return filtered
        .map(p => ({
          user_id: p.user_id,
          name: p.name,
          client_count: counts[p.user_id] || 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
    enabled: isOrgWide || !!groupId,
    staleTime: 30_000,
  });
}

const ROLE_TO_CLIENT_FIELD: Record<string, string> = {
  gestor_ads: 'assigned_ads_manager',
  consultor_comercial: 'assigned_comercial',
  consultor_mktplace: 'assigned_mktplace',
  gestor_crm: 'assigned_crm',
  sucesso_cliente: 'assigned_sucesso_cliente',
};
