import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrmGestor {
  user_id: string;
  name: string;
}

/**
 * Lista os usuários com papel `gestor_crm` (id + nome), para o seletor de
 * gestor — tanto no olhinho (`CrmGerarTarefaSection`) quanto no modo board do
 * `CrmTarefaFormModal`.
 *
 * Extraído da query inline que vivia duplicada em `CrmGerarTarefaSection`
 * (uma única fonte da verdade para "quem pode ser gestor de CRM"). Cache 5 min:
 * a lista de papéis muda pouco.
 */
export function useCrmGestors() {
  return useQuery({
    queryKey: ['crm-gestors-list'],
    queryFn: async (): Promise<CrmGestor[]> => {
      const { data: roles, error: rolesErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_crm');
      if (rolesErr) throw rolesErr;
      if (!roles || roles.length === 0) return [];

      const ids = roles.map(r => r.user_id);
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', ids);
      if (profErr) throw profErr;
      return (profiles || []) as CrmGestor[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
