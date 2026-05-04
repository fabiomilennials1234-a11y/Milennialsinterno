import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SquadManager {
  user_id: string;
  name: string;
  squad_id: string | null;
}

// Fetch all gestor_ads from the same group (or all if CEO).
// Uses SECURITY DEFINER RPC to bypass user_roles RLS restriction
// (security wave 1 locked SELECT to own-row + admin).
export function useSquadManagers() {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['squad-managers', user?.id],
    queryFn: async (): Promise<SquadManager[]> => {
      // Get gestor_ads user_ids via RPC (bypasses user_roles RLS).
      const { data: rpcData, error: rpcError } = await supabase.rpc('list_users_by_role_for_page', {
        _role: 'gestor_ads',
        _page_slug: 'consultor-comercial',
      });

      if (rpcError) {
        // 42501 = insufficient_privilege (no page grant). Return empty
        // instead of crashing — section shows "Nenhum gestor" gracefully.
        if (rpcError.code === '42501') {
          console.warn('[useSquadManagers] RPC grant denied — returning empty', rpcError.message);
          return [];
        }
        throw rpcError;
      }

      if (!rpcData || rpcData.length === 0) return [];

      const userIds = rpcData.map(r => r.user_id);

      // Get profiles for squad_id/group_id filtering.
      // profiles RLS allows sucesso_cliente + consultor_comercial full read.
      let profilesQuery = supabase
        .from('profiles')
        .select('user_id, name, squad_id, group_id')
        .in('user_id', userIds);

      // If not CEO, filter by same group
      if (!isCEO) {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('group_id')
          .eq('user_id', user?.id)
          .single();

        if (currentProfile?.group_id) {
          profilesQuery = profilesQuery.eq('group_id', currentProfile.group_id);
        }
      }

      const { data: profiles, error: profilesError } = await profilesQuery;

      if (profilesError) throw profilesError;

      const managers: SquadManager[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        name: p.name || 'Gestor',
        squad_id: p.squad_id,
      }));

      return managers.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!user,
  });
}
