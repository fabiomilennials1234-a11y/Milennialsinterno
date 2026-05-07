import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ApprovePayload {
  clientId: string;
  assignments: {
    assigned_ads_manager?: string | null;
    assigned_sucesso_cliente?: string | null;
    assigned_comercial?: string | null;
    assigned_crm?: string | null;
    assigned_outbound_manager?: string | null;
    assigned_mktplace?: string | null;
  };
  contracted_products?: string[];
  monthly_value?: number;
}

interface RejectPayload {
  clientId: string;
  reason?: string;
}

export function useApproveClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ApprovePayload) => {
      const { data, error } = await supabase.rpc('approve_client', {
        p_client_id: payload.clientId,
        p_assignments: payload.assignments,
        p_contracted_products: payload.contracted_products || null,
        p_monthly_value: payload.monthly_value || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-area-data'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      toast.success('Cliente aprovado', {
        description: 'O cliente foi validado e está pronto para operação.',
      });
    },
    onError: (error: Error) => {
      console.error('Error approving client:', error);
      toast.error('Erro ao aprovar cliente', {
        description: error.message,
      });
    },
  });
}

export function useRejectClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RejectPayload) => {
      const { data, error } = await supabase.rpc('reject_client', {
        p_client_id: payload.clientId,
        p_rejection_reason: payload.reason || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-area-data'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      toast.success('Cliente reprovado', {
        description: 'O cliente foi marcado como reprovado.',
      });
    },
    onError: (error: Error) => {
      console.error('Error rejecting client:', error);
      toast.error('Erro ao reprovar cliente', {
        description: error.message,
      });
    },
  });
}
