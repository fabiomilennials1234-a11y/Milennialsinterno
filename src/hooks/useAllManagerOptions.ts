import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ManagerOption {
  id: string;
  name: string;
}

interface AllManagerOptions {
  gestores_ads: ManagerOption[];
  sucesso_cliente: ManagerOption[];
  comercial: ManagerOption[];
  crm: ManagerOption[];
  outbound: ManagerOption[];
  mktplace: ManagerOption[];
}

const ROLE_QUERIES: { key: keyof AllManagerOptions; role: string }[] = [
  { key: 'gestores_ads', role: 'gestor_ads' },
  { key: 'sucesso_cliente', role: 'sucesso_cliente' },
  { key: 'comercial', role: 'consultor_comercial' },
  { key: 'crm', role: 'gestor_crm' },
  { key: 'outbound', role: 'outbound' },
  { key: 'mktplace', role: 'consultor_mktplace' },
];

export function useAllManagerOptions() {
  return useQuery({
    queryKey: ['all-manager-options'],
    queryFn: async (): Promise<AllManagerOptions> => {
      // Fetch all role assignments in one query
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ROLE_QUERIES.map(r => r.role));

      if (roleError) throw roleError;

      // Collect unique user IDs
      const allIds = [...new Set((roleData || []).map(r => r.user_id))];
      let profileMap: Record<string, string> = {};

      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', allIds);
        if (profiles) {
          profileMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Group by role
      const result: AllManagerOptions = {
        gestores_ads: [],
        sucesso_cliente: [],
        comercial: [],
        crm: [],
        outbound: [],
        mktplace: [],
      };

      for (const rq of ROLE_QUERIES) {
        result[rq.key] = (roleData || [])
          .filter(r => r.role === rq.role)
          .map(r => ({
            id: r.user_id,
            name: profileMap[r.user_id] || 'Sem nome',
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      return result;
    },
    staleTime: 60_000,
  });
}
