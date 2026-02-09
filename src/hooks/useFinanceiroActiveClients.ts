import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FinanceiroActiveClient {
  id: string;
  client_id: string;
  monthly_value: number;
  invoice_status: 'em_dia' | 'atrasada';
  contract_expires_at: string | null;
  activated_at: string;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    razao_social: string | null;
    expected_investment: number | null;
    archived: boolean;
    client_label: 'otimo' | 'bom' | 'medio' | 'ruim' | null;
  };
}

export interface ActiveClientsStats {
  totalClients: number;
  totalToReceive: number;
  totalOverdue: number;
  overdueCount: number;
  monthlyChurnValue: number;
  monthlyChurnCount: number;
}

// Clients with contracts expiring in the next 30 days
const EXPIRATION_WARNING_DAYS = 30;

export function useFinanceiroActiveClients() {
  const queryClient = useQueryClient();

  // Fetch all active clients
  const { data: activeClients = [], isLoading } = useQuery({
    queryKey: ['financeiro-active-clients'],
    queryFn: async (): Promise<FinanceiroActiveClient[]> => {
      const { data, error } = await supabase
        .from('financeiro_active_clients')
        .select(`
          *,
          client:clients(id, name, razao_social, expected_investment, archived, client_label)
        `)
        .order('activated_at', { ascending: false });

      if (error) throw error;
      
      // Filter out archived clients
      return (data || []).filter((record: any) => record.client && !record.client.archived) as FinanceiroActiveClient[];
    },
  });

  // Fetch churns from this month to calculate monthly churn value
  const { data: monthlyChurns = [] } = useQuery({
    queryKey: ['financeiro-monthly-churns'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, expected_investment')
        .not('distrato_step', 'is', null)
        .gte('distrato_entered_at', startOfMonth);

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate stats
  const stats: ActiveClientsStats = {
    totalClients: activeClients.length,
    totalToReceive: activeClients.reduce((sum, client) => sum + Number(client.monthly_value), 0),
    totalOverdue: activeClients
      .filter(client => client.invoice_status === 'atrasada')
      .reduce((sum, client) => sum + Number(client.monthly_value), 0),
    overdueCount: activeClients.filter(client => client.invoice_status === 'atrasada').length,
    monthlyChurnValue: monthlyChurns.reduce((sum, client) => sum + Number(client.expected_investment || 0), 0),
    monthlyChurnCount: monthlyChurns.length,
  };

  // Get clients with contracts expiring soon
  const expiringContracts = activeClients.filter(client => {
    if (!client.contract_expires_at) return false;
    const expiresAt = new Date(client.contract_expires_at);
    const today = new Date();
    const daysUntilExpiration = Math.ceil((expiresAt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration <= EXPIRATION_WARNING_DAYS && daysUntilExpiration >= 0;
  });

  // Add client to active list
  const activateClient = useMutation({
    mutationFn: async ({ clientId, monthlyValue, contractExpiresAt }: { clientId: string; monthlyValue: number; contractExpiresAt?: string }) => {
      // First check if already exists
      const { data: existing } = await supabase
        .from('financeiro_active_clients')
        .select('id')
        .eq('client_id', clientId)
        .single();

      if (existing) {
        // Update if exists
        const { data, error } = await supabase
          .from('financeiro_active_clients')
          .update({
            monthly_value: monthlyValue,
            contract_expires_at: contractExpiresAt || null,
          })
          .eq('client_id', clientId)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('financeiro_active_clients')
        .insert({
          client_id: clientId,
          monthly_value: monthlyValue,
          invoice_status: 'em_dia',
          contract_expires_at: contractExpiresAt || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
    },
    onError: (error) => {
      console.error('Error activating client:', error);
    },
  });

  // Toggle invoice status
  const toggleInvoiceStatus = useMutation({
    mutationFn: async ({ clientId, newStatus }: { clientId: string; newStatus: 'em_dia' | 'atrasada' }) => {
      const { error } = await supabase
        .from('financeiro_active_clients')
        .update({ invoice_status: newStatus })
        .eq('client_id', clientId);

      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      toast.success(newStatus === 'atrasada' ? 'Fatura marcada como atrasada' : 'Fatura marcada como em dia');
    },
    onError: () => {
      toast.error('Erro ao atualizar status da fatura');
    },
  });

  // Update monthly value
  const updateMonthlyValue = useMutation({
    mutationFn: async ({ clientId, monthlyValue }: { clientId: string; monthlyValue: number }) => {
      const { error } = await supabase
        .from('financeiro_active_clients')
        .update({ monthly_value: monthlyValue })
        .eq('client_id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      toast.success('Valor atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar valor');
    },
  });

  // Update contract expiration date (for renewal)
  const updateContractExpiration = useMutation({
    mutationFn: async ({ clientId, contractExpiresAt }: { clientId: string; contractExpiresAt: string }) => {
      const { error } = await supabase
        .from('financeiro_active_clients')
        .update({ contract_expires_at: contractExpiresAt })
        .eq('client_id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      toast.success('Contrato renovado!');
    },
    onError: () => {
      toast.error('Erro ao renovar contrato');
    },
  });

  // Move client to distrato (churn workflow)
  // If contract is signed and valid -> churn_solicitado (needs full distrato process with 4 steps)
  // If contract is expired or not signed -> sem_contrato_solicitado (simplified 2-step process)
  const moveToChurn = useMutation({
    mutationFn: async ({ clientId, hasValidContract }: { clientId: string; hasValidContract: boolean }) => {
      // Remove from active clients
      const { error: deleteError } = await supabase
        .from('financeiro_active_clients')
        .delete()
        .eq('client_id', clientId);

      if (deleteError) throw deleteError;

      // Determine which workflow based on contract status
      // COM contrato -> fluxo de 4 etapas (churn_solicitado)
      // SEM contrato -> fluxo de 2 etapas (sem_contrato_solicitado)
      const distratoStep = hasValidContract ? 'churn_solicitado' : 'sem_contrato_solicitado';

      // Move to distrato workflow
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          distrato_step: distratoStep,
          distrato_entered_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (updateError) throw updateError;
      
      return { hasValidContract };
    },
    onSuccess: ({ hasValidContract }) => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-distrato-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      
      if (hasValidContract) {
        toast.success('Cliente movido para Churn com Contrato', {
          description: 'O contrato ainda está válido. Siga o fluxo completo de distrato.',
        });
      } else {
        toast.success('Cliente movido para Churn sem Contrato', {
          description: 'Sem contrato válido. Fluxo simplificado de 2 etapas.',
        });
      }
    },
    onError: () => {
      toast.error('Erro ao mover cliente para churn');
    },
  });

  return {
    activeClients,
    expiringContracts,
    isLoading,
    stats,
    activateClient,
    toggleInvoiceStatus,
    updateMonthlyValue,
    updateContractExpiration,
    moveToChurn,
  };
}
