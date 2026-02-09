import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SquadManager {
  user_id: string;
  name: string;
  squad_id: string | null;
}

// Fetch all gestor_ads from the same group (or all if CEO)
export function useSquadManagers() {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['squad-managers', user?.id],
    queryFn: async (): Promise<SquadManager[]> => {
      // Get current user's group
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('group_id, squad_id')
        .eq('user_id', user?.id)
        .single();

      // First get all gestor_ads user_ids
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_ads');

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);

      // Then get their profiles
      let profilesQuery = supabase
        .from('profiles')
        .select('user_id, name, squad_id, group_id')
        .in('user_id', userIds);

      // If not CEO, filter by same group
      if (!isCEO && currentProfile?.group_id) {
        profilesQuery = profilesQuery.eq('group_id', currentProfile.group_id);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;

      if (profilesError) throw profilesError;

      const managers: SquadManager[] = (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        name: p.name || 'Gestor',
        squad_id: p.squad_id,
      }));

      return managers.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!user,
  });
}
