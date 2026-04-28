import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActiveClientMinimal {
  id: string;
  name: string;
  razao_social: string | null;
}

/**
 * Lista TODOS os clientes ativos do sistema (archived = false), com projeção
 * mínima (id, name, razao_social), ordenada por nome.
 *
 * Fonte: RPC SECURITY DEFINER `list_active_clients_minimal` — necessária porque
 * a policy SELECT de `clients` para `consultor_comercial` é escopada por
 * `assigned_comercial = auth.uid()`. A RPC abre uma porta auditável e mínima,
 * sem expor colunas sensíveis (financeiro, assignments, status interno, etc).
 *
 * Uso indicado: comboboxes operacionais onde o usuário precisa selecionar
 * qualquer cliente ativo (ex: CRM "Gerar Tarefa").
 *
 * Cache: 5 min (lista muda pouco). Invalidar manualmente caso clientes sejam
 * criados/arquivados durante a sessão e a UI precisar refletir imediatamente.
 */
export function useAllActiveClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['active-clients-minimal'],
    queryFn: async (): Promise<ActiveClientMinimal[]> => {
      // Cast: RPC recém-criada, types regen rodam após deploy do migration.
      const { data, error } = await (supabase.rpc as unknown as (
        fn: 'list_active_clients_minimal',
      ) => Promise<{ data: ActiveClientMinimal[] | null; error: Error | null }>)(
        'list_active_clients_minimal',
      );
      if (error) throw error;
      return (data ?? []).map(c => ({
        id: c.id,
        name: c.name,
        razao_social: c.razao_social,
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
