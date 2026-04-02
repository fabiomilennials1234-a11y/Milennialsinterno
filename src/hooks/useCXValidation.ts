import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

export type CXValidationStatus = 'aguardando_validacao' | 'pendente_aprovacao' | 'validado';

export interface CXPendingClient {
  id: string;
  name: string;
  razao_social: string | null;
  niche: string | null;
  expected_investment: number | null;
  cx_validation_status: CXValidationStatus;
  created_at: string;
}

/**
 * Busca todos os clientes que precisam de validação CX.
 * Retorna clientes com status 'aguardando_validacao' ou 'pendente_aprovacao'.
 */
export function useCXPendingClients() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cx-pending-clients'],
    queryFn: async (): Promise<CXPendingClient[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, niche, expected_investment, cx_validation_status, created_at')
        .in('cx_validation_status', ['aguardando_validacao', 'pendente_aprovacao'])
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CXPendingClient[];
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('cx-validation-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: 'cx_validation_status=neq.validado',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cx-pending-clients'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

/**
 * Verifica se um cliente específico está aguardando validação CX.
 */
export function useCXValidationStatus() {
  const { data: pendingClients = [] } = useCXPendingClients();

  const isAwaitingValidation = (clientId: string): boolean => {
    return pendingClients.some(
      c => c.id === clientId && (c.cx_validation_status === 'aguardando_validacao' || c.cx_validation_status === 'pendente_aprovacao')
    );
  };

  return { isAwaitingValidation, pendingClients };
}

/**
 * Mutation para aprovar um cliente (CX validou com sucesso).
 * Usado tanto pelo popup "Sim" quanto pelo botão "Aprovar" na coluna de pendência.
 */
export function useApproveCXValidation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ clientId, notes }: { clientId: string; notes?: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const updateData: Record<string, any> = {
        cx_validation_status: 'validado',
        cx_validated_at: new Date().toISOString(),
        cx_validated_by: user.id,
      };
      if (notes) {
        updateData.cx_validation_notes = notes;
      }

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cx-pending-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['cs-clients'] });
      toast.success('Cliente validado pelo CX com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao validar cliente', { description: error.message });
    },
  });
}

/**
 * Mutation para rejeitar temporariamente (CX marcou "Não").
 * Move o cliente para status 'pendente_aprovacao'.
 */
export function useRejectCXValidation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ clientId, notes }: { clientId: string; notes?: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const updateData: Record<string, any> = {
        cx_validation_status: 'pendente_aprovacao',
      };
      if (notes) {
        updateData.cx_validation_notes = notes;
      }

      const { error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cx-pending-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['cs-clients'] });
      toast.info('Cliente movido para pendência de aprovação.');
    },
    onError: (error: Error) => {
      toast.error('Erro ao processar rejeição', { description: error.message });
    },
  });
}
