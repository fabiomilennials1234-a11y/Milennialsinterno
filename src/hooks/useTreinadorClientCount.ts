import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
        .eq('archived', false)
        .neq('status', 'churned');

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

      // Buscar clientes ativos atribuídos a esses treinadores (excluir churn)
      const { data: clients, error: cError } = await supabase
        .from('clients')
        .select('assigned_comercial')
        .in('assigned_comercial', treinadorIds)
        .eq('archived', false)
        .neq('status', 'churned');

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

/**
 * Retorna contagem de clientes para TODOS os gestores de ads.
 * Usado na sidebar para mostrar [X/25] ao lado de cada gestor.
 */
export function useAllGestorClientCounts() {
  return useQuery({
    queryKey: ['all-gestor-client-counts'],
    queryFn: async () => {
      const { data: gestores, error: gError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_ads');

      if (gError) throw gError;
      if (!gestores || gestores.length === 0) return {};

      const gestorIds = gestores.map(g => g.user_id);

      // Buscar clientes ativos atribuídos a esses gestores (excluir churn)
      const { data: clients, error: cError } = await supabase
        .from('clients')
        .select('assigned_ads_manager')
        .in('assigned_ads_manager', gestorIds)
        .eq('archived', false)
        .neq('status', 'churned');

      if (cError) throw cError;

      const counts: Record<string, number> = {};
      for (const id of gestorIds) {
        counts[id] = 0;
      }
      for (const client of clients || []) {
        if (client.assigned_ads_manager && counts[client.assigned_ads_manager] !== undefined) {
          counts[client.assigned_ads_manager]++;
        }
      }

      return counts;
    },
    staleTime: 30000,
  });
}

/**
 * Retorna contagem de clientes para TODOS os gestores de CRM.
 * Usado na sidebar para mostrar [X/80] ao lado de cada gestor de CRM.
 */
export function useAllCrmClientCounts() {
  return useQuery({
    queryKey: ['all-crm-client-counts'],
    queryFn: async () => {
      const { data: gestores, error: gError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_crm');

      if (gError) throw gError;
      if (!gestores || gestores.length === 0) return {};

      const gestorIds = gestores.map(g => g.user_id);

      const { data: clients, error: cError } = await supabase
        .from('clients')
        .select('assigned_crm')
        .in('assigned_crm', gestorIds)
        .eq('archived', false)
        .neq('status', 'churned');

      if (cError) throw cError;

      const counts: Record<string, number> = {};
      for (const id of gestorIds) {
        counts[id] = 0;
      }
      for (const client of clients || []) {
        if (client.assigned_crm && counts[client.assigned_crm] !== undefined) {
          counts[client.assigned_crm]++;
        }
      }

      return counts;
    },
    staleTime: 30000,
  });
}

/**
 * Retorna contagem de clientes para TODOS os gestores de Outbound.
 * Usado na sidebar para mostrar [X/80] ao lado de cada outbound.
 */
export function useAllOutboundClientCounts() {
  return useQuery({
    queryKey: ['all-outbound-client-counts'],
    queryFn: async () => {
      const { data: gestores, error: gError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'outbound');

      if (gError) throw gError;
      if (!gestores || gestores.length === 0) return {};

      const gestorIds = gestores.map(g => g.user_id);

      const { data: clients, error: cError } = await supabase
        .from('clients')
        .select('assigned_outbound_manager')
        .in('assigned_outbound_manager', gestorIds)
        .eq('archived', false)
        .neq('status', 'churned');

      if (cError) throw cError;

      const counts: Record<string, number> = {};
      for (const id of gestorIds) {
        counts[id] = 0;
      }
      for (const client of clients || []) {
        if (client.assigned_outbound_manager && counts[client.assigned_outbound_manager] !== undefined) {
          counts[client.assigned_outbound_manager]++;
        }
      }

      return counts;
    },
    staleTime: 30000,
  });
}

/**
 * Busca todos os gestores de ads e treinadores comerciais (para dropdowns).
 */
export function useManagerOptions() {
  return useQuery({
    queryKey: ['manager-options'],
    queryFn: async () => {
      const { data: gestorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_ads');

      const gestorIds = gestorRoles?.map(r => r.user_id) || [];

      const { data: treinadorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'consultor_comercial');

      const treinadorIds = treinadorRoles?.map(r => r.user_id) || [];

      const allIds = [...new Set([...gestorIds, ...treinadorIds])];
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

      return {
        gestores: gestorIds.map(id => ({ id, name: profileMap[id] || 'Sem nome' })),
        treinadores: treinadorIds.map(id => ({ id, name: profileMap[id] || 'Sem nome' })),
      };
    },
    staleTime: 60000,
  });
}

/**
 * Mutation para alterar gestor ou treinador de um cliente.
 */
export function useUpdateClientAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, field, value }: {
      clientId: string;
      field: 'assigned_ads_manager' | 'assigned_comercial';
      value: string | null;
    }) => {
      // 1. Atualizar o campo na tabela clients
      const { error } = await supabase
        .from('clients')
        .update({ [field]: value } as any)
        .eq('id', clientId);
      if (error) throw error;

      // 2. Se mudou o gestor de ads, atualizar também o client_daily_tracking
      if (field === 'assigned_ads_manager' && value) {
        await supabase
          .from('client_daily_tracking')
          .update({ ads_manager_id: value } as any)
          .eq('client_id', clientId);
      }
    },
    onSuccess: (_, { field }) => {
      // Invalidar tudo relacionado a clientes para garantir atualização completa
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['all-gestor-client-counts'] });
      queryClient.invalidateQueries({ queryKey: ['all-treinador-client-counts'] });
      // Invalidar TODOS os kanbans de gestores (sem filtro de userId)
      queryClient.invalidateQueries({ predicate: (query) =>
        query.queryKey[0] === 'assigned-clients' ||
        query.queryKey[0] === 'client-tracking'
      });
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['sucesso-clients'] });
      const label = field === 'assigned_ads_manager' ? 'Gestor' : 'Treinador comercial';
      toast.success(`${label} atualizado`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}
