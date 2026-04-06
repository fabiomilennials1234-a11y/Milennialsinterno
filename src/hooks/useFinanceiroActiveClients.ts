import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export interface FinanceiroActiveClient {
  id: string;
  client_id: string;
  product_slug: string;
  product_name: string;
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
    finance_display_name: string | null;
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

  // Fetch all active client-products, adjusting for churned products
  const { data: activeClients = [], isLoading } = useQuery({
    queryKey: ['financeiro-active-clients'],
    queryFn: async (): Promise<FinanceiroActiveClient[]> => {
      const { data, error } = await supabase
        .from('financeiro_active_clients')
        .select(`
          *,
          client:clients(id, name, razao_social, expected_investment, archived, client_label, finance_display_name)
        `)
        .order('activated_at', { ascending: false });

      if (error) throw error;

      const records = (data || []).filter((record: any) =>
        record.client && !record.client.archived
      ) as FinanceiroActiveClient[];

      if (records.length === 0) return [];

      // Fetch active product churns (not archived) to filter out churned products
      const clientProductKeys = records.map(r => `${r.client_id}:${r.product_slug}`);
      const clientIds = [...new Set(records.map(r => r.client_id))];

      const { data: activeChurns } = await supabase
        .from('client_product_churns')
        .select('client_id, product_slug, monthly_value')
        .in('client_id', clientIds)
        .eq('archived', false);

      // Build set of churned client:product keys
      const churnedKeys = new Set<string>();
      if (activeChurns) {
        for (const churn of activeChurns) {
          churnedKeys.add(`${churn.client_id}:${churn.product_slug}`);
        }
      }

      // Filter out records where the product is currently being churned
      return records.filter(record => {
        const key = `${record.client_id}:${record.product_slug}`;
        return !churnedKeys.has(key) && Number(record.monthly_value) > 0;
      });
    },
  });

  // Fetch churns from this month to calculate monthly churn value
  const { data: monthlyChurns = [] } = useQuery({
    queryKey: ['financeiro-monthly-churns'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data, error } = await supabase
        .from('client_product_churns')
        .select('id, client_id, monthly_value')
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
    monthlyChurnValue: monthlyChurns.reduce((sum, churn) => sum + Number(churn.monthly_value || 0), 0),
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

  // Add client-product to active list
  const activateClient = useMutation({
    mutationFn: async ({ clientId, productSlug, productName, monthlyValue, contractExpiresAt }: {
      clientId: string;
      productSlug: string;
      productName: string;
      monthlyValue: number;
      contractExpiresAt?: string;
    }) => {
      // First check if already exists for this product
      const { data: existing } = await supabase
        .from('financeiro_active_clients')
        .select('id')
        .eq('client_id', clientId)
        .eq('product_slug', productSlug)
        .maybeSingle();

      if (existing) {
        // Update if exists
        const { data, error } = await supabase
          .from('financeiro_active_clients')
          .update({
            monthly_value: monthlyValue,
            contract_expires_at: contractExpiresAt || null,
          })
          .eq('client_id', clientId)
          .eq('product_slug', productSlug)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('financeiro_active_clients')
        .insert({
          client_id: clientId,
          product_slug: productSlug,
          product_name: productName,
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

  // Toggle invoice status (uses record ID) + sync with financeiro_contas_receber
  const toggleInvoiceStatus = useMutation({
    mutationFn: async ({ recordId, newStatus }: { recordId: string; newStatus: 'em_dia' | 'atrasada' }) => {
      // Update financeiro_active_clients
      const { error } = await supabase
        .from('financeiro_active_clients')
        .update({ invoice_status: newStatus })
        .eq('id', recordId);

      if (error) throw error;

      // Sync with financeiro_contas_receber for the current month
      const currentMonth = format(new Date(), 'yyyy-MM');
      const record = activeClients.find(c => c.id === recordId);
      if (record) {
        const contaReceberStatus = newStatus === 'atrasada' ? 'inadimplente' : 'em_dia';

        // Check if entry exists for this month
        const { data: existing } = await supabase
          .from('financeiro_contas_receber')
          .select('id, inadimplencia_count')
          .eq('client_id', record.client_id)
          .eq('produto_slug', record.product_slug)
          .eq('mes_referencia', currentMonth)
          .maybeSingle();

        if (existing) {
          // Update existing entry
          const updateData: Record<string, any> = {
            status: contaReceberStatus,
            updated_at: new Date().toISOString(),
          };
          if (newStatus === 'atrasada') {
            updateData.inadimplencia_count = (existing.inadimplencia_count || 0) > 0
              ? existing.inadimplencia_count
              : 1;
          } else {
            updateData.inadimplencia_count = 0;
          }
          await supabase
            .from('financeiro_contas_receber')
            .update(updateData)
            .eq('id', existing.id);
        } else {
          // Create new entry for this month
          await supabase
            .from('financeiro_contas_receber')
            .insert({
              client_id: record.client_id,
              produto_slug: record.product_slug,
              valor: record.monthly_value,
              status: contaReceberStatus,
              mes_referencia: currentMonth,
              is_recurring: true,
              inadimplencia_count: newStatus === 'atrasada' ? 1 : 0,
            });
        }
      }

      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-dashboard'] });
      toast.success(newStatus === 'atrasada' ? 'Fatura marcada como atrasada' : 'Fatura marcada como em dia');
    },
    onError: () => {
      toast.error('Erro ao atualizar status da fatura');
    },
  });

  // Update monthly value (uses record ID)
  const updateMonthlyValue = useMutation({
    mutationFn: async ({ recordId, monthlyValue }: { recordId: string; monthlyValue: number }) => {
      const { error } = await supabase
        .from('financeiro_active_clients')
        .update({ monthly_value: monthlyValue })
        .eq('id', recordId);

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

  // Update contract expiration date (for renewal, uses record ID)
  const updateContractExpiration = useMutation({
    mutationFn: async ({ recordId, contractExpiresAt }: { recordId: string; contractExpiresAt: string }) => {
      const { error } = await supabase
        .from('financeiro_active_clients')
        .update({ contract_expires_at: contractExpiresAt })
        .eq('id', recordId);

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

  // Move product to distrato (churn workflow)
  const moveToChurn = useMutation({
    mutationFn: async ({ recordId, clientId, productSlug, hasValidContract }: {
      recordId: string;
      clientId: string;
      productSlug: string;
      hasValidContract: boolean;
    }) => {
      // Remove this product from active clients
      const { error: deleteError } = await supabase
        .from('financeiro_active_clients')
        .delete()
        .eq('id', recordId);

      if (deleteError) throw deleteError;

      // Determine which workflow based on contract status
      const distratoStep = hasValidContract ? 'churn_solicitado' : 'sem_contrato_solicitado';

      // Move to distrato workflow (client-level, for kanban compatibility)
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
        toast.success('Produto movido para Churn com Contrato', {
          description: 'O contrato ainda está válido. Siga o fluxo completo de distrato.',
        });
      } else {
        toast.success('Produto movido para Churn sem Contrato', {
          description: 'Sem contrato válido. Fluxo simplificado de 2 etapas.',
        });
      }
    },
    onError: () => {
      toast.error('Erro ao mover produto para churn');
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
