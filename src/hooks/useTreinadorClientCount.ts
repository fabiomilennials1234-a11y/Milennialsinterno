import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Retorna a contagem de clientes atribuídos ao treinador comercial (assigned_comercial).
 * Se userId for passado, conta para aquele usuário específico.
 * Se não, conta para o usuário logado.
 */
export function useTreinadorClientCount(userId?: string) {
  const { user } = useAuth();
  const targetId = userId || user?.id;

  return useQuery({
    queryKey: ['treinador-client-count', targetId],
    queryFn: async () => {
      if (!targetId) return 0;

      const { count, error } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_comercial', targetId)
        .eq('archived', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!targetId,
    staleTime: 30000,
  });
}

/**
 * Retorna contagem de clientes para TODOS os treinadores comerciais.
 * Usado na sidebar do CEO/admin para mostrar [X/80] ao lado de cada treinador.
 */
export function useAllTreinadorClientCounts() {
  return useQuery({
    queryKey: ['all-treinador-client-counts'],
    queryFn: async () => {
      // Buscar todos os treinadores comerciais
      const { data: treinadores, error: tError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'consultor_comercial');

      if (tError) throw tError;
      if (!treinadores || treinadores.length === 0) return {};

      const treinadorIds = treinadores.map(t => t.user_id);

      // Buscar clientes atribuídos a esses treinadores
      const { data: clients, error: cError } = await supabase
        .from('clients')
        .select('assigned_comercial')
        .in('assigned_comercial', treinadorIds)
        .eq('archived', false);

      if (cError) throw cError;

      // Contar por treinador
      const counts: Record<string, number> = {};
      for (const id of treinadorIds) {
        counts[id] = 0;
      }
      for (const client of clients || []) {
        if (client.assigned_comercial && counts[client.assigned_comercial] !== undefined) {
          counts[client.assigned_comercial]++;
        }
      }

      return counts;
    },
    staleTime: 30000,
  });
}
