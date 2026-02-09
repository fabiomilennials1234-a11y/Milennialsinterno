import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface ClientWithSales {
  id: string;
  name: string;
  razao_social: string | null;
  cnpj: string | null;
  cpf: string | null;
  sales_percentage: number;
  assigned_ads_manager: string | null;
  created_at: string;
  status: string | null;
  entry_date: string | null;
  total_sales: number;
  total_commission: number;
  ads_manager_name?: string;
  archived?: boolean;
  archived_at?: string | null;
  campaign_published_at?: string | null;
  onboarding_started_at?: string | null;
  distrato_step?: string | null;
  distrato_entered_at?: string | null;
  client_label?: 'otimo' | 'bom' | 'medio' | 'ruim' | null;
  contracted_products?: string[] | null;
  monthly_value?: number | null;
}

export interface ClientSale {
  id: string;
  client_id: string;
  sale_value: number;
  sale_date: string;
  registered_by: string;
  created_at: string;
}

// Fetch all clients with sales totals
export function useClientsWithSales() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['clients-with-sales'],
    queryFn: async (): Promise<ClientWithSales[]> => {
      // Fetch clients (include all, including archived, so they can be restored)
      // Include distrato_step and distrato_entered_at to match Financeiro churn calculation
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, razao_social, cnpj, cpf, sales_percentage, assigned_ads_manager, created_at, status, entry_date, archived, archived_at, campaign_published_at, onboarding_started_at, distrato_step, distrato_entered_at, client_label, contracted_products, monthly_value')
        .order('name', { ascending: true });

      if (clientsError) throw clientsError;

      // Fetch sales totals per client
      const { data: salesData, error: salesError } = await supabase
        .from('client_sales')
        .select('client_id, sale_value');

      if (salesError) throw salesError;

      // Fetch ads managers names
      const adsManagerIds = [...new Set(clients?.filter(c => c.assigned_ads_manager).map(c => c.assigned_ads_manager) || [])];
      
      let adsManagerMap: Record<string, string> = {};
      if (adsManagerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', adsManagerIds);
        
        if (profiles) {
          adsManagerMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Calculate totals per client
      const salesTotals = (salesData || []).reduce((acc, sale) => {
        if (!acc[sale.client_id]) {
          acc[sale.client_id] = 0;
        }
        acc[sale.client_id] += Number(sale.sale_value);
        return acc;
      }, {} as Record<string, number>);

      // Map clients with sales data
      return (clients || []).map(client => {
        const totalSales = salesTotals[client.id] || 0;
        const totalCommission = totalSales * (client.sales_percentage / 100);
        
        return {
          ...client,
          client_label: client.client_label as 'otimo' | 'bom' | 'medio' | 'ruim' | null,
          total_sales: totalSales,
          total_commission: totalCommission,
          ads_manager_name: client.assigned_ads_manager 
            ? adsManagerMap[client.assigned_ads_manager] 
            : undefined,
        };
      });
    },
    enabled: !!user,
  });

  // Real-time subscription for sales and client status changes
  useEffect(() => {
    if (!user) return;

    const salesChannel = supabase
      .channel('client-sales-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_sales',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
        }
      )
      .subscribe();

    // Also subscribe to clients table for distrato/status changes
    const clientsChannel = supabase
      .channel('client-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(clientsChannel);
    };
  }, [user, queryClient]);

  return query;
}

// Fetch sales for a specific client
export function useClientSales(clientId?: string) {
  return useQuery({
    queryKey: ['client-sales', clientId],
    queryFn: async (): Promise<ClientSale[]> => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_sales')
        .select('*')
        .eq('client_id', clientId)
        .order('sale_date', { ascending: false });

      if (error) throw error;
      return data as ClientSale[];
    },
    enabled: !!clientId,
  });
}

// Register a new sale
export function useRegisterSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ clientId, saleValue, saleDate }: { 
      clientId: string; 
      saleValue: number; 
      saleDate: string;
    }) => {
      const { data, error } = await supabase
        .from('client_sales')
        .insert({
          client_id: clientId,
          sale_value: saleValue,
          sale_date: saleDate,
          registered_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['client-sales'] });
      toast.success('Venda registrada com sucesso!', {
        description: 'Comissões distribuídas automaticamente.',
      });
    },
    onError: (error: Error) => {
      console.error('Error registering sale:', error);
      toast.error('Erro ao registrar venda', {
        description: error.message,
      });
    },
  });
}

// Fetch user's commissions
export function useUserCommissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-commissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, byClient: [] };

      const { data, error } = await supabase
        .from('commission_records')
        .select(`
          id,
          commission_value,
          user_role,
          created_at,
          client:clients(id, name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const total = (data || []).reduce((sum, record) => sum + Number(record.commission_value), 0);
      
      // Group by client
      const byClient = (data || []).reduce((acc, record) => {
        const clientId = (record.client as any)?.id;
        const clientName = (record.client as any)?.name || 'Cliente';
        
        if (!acc[clientId]) {
          acc[clientId] = {
            clientId,
            clientName,
            total: 0,
            records: [],
          };
        }
        acc[clientId].total += Number(record.commission_value);
        acc[clientId].records.push(record);
        return acc;
      }, {} as Record<string, { clientId: string; clientName: string; total: number; records: any[] }>);

      return {
        total,
        byClient: Object.values(byClient),
      };
    },
    enabled: !!user?.id,
  });
}
