import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrmManagerBoard {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  owner_name: string;
  squad_id: string | null;
}

/**
 * Fetch all individual CRM manager boards (one per gestor_crm user).
 * If boards don't exist yet, returns user info so we can create links.
 */
export function useCrmManagerBoards() {
  return useQuery({
    queryKey: ['crm-manager-boards'],
    queryFn: async (): Promise<CrmManagerBoard[]> => {
      // Buscar todos os gestores de CRM
      const { data: crmRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_crm');

      if (rolesError) throw rolesError;
      if (!crmRoles || crmRoles.length === 0) return [];

      const userIds = crmRoles.map(r => r.user_id);

      // Buscar perfis para nomes e squad_id
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, squad_id')
        .in('user_id', userIds);

      if (!profiles || profiles.length === 0) return [];

      return profiles.map(p => ({
        id: p.user_id,
        name: `CRM (${p.name})`,
        slug: `crm-${p.user_id}`,
        owner_user_id: p.user_id,
        owner_name: p.name,
        squad_id: p.squad_id,
      }));
    },
  });
}
