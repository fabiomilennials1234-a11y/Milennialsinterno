import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface OverdueClient {
  client_id: string;
  invoice_status: 'em_dia' | 'atrasada';
}

/**
 * Hook to fetch all clients with overdue invoices
 * This is used to display "Fatura Atrasada" badges across all departments
 */
export function useOverdueInvoices() {
  const queryClient = useQueryClient();

  const { data: overdueClientIds = [], isLoading } = useQuery({
    queryKey: ['overdue-invoices'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('financeiro_active_clients')
        .select('client_id')
        .eq('invoice_status', 'atrasada');

      if (error) throw error;
      
      return (data || []).map(item => item.client_id);
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('overdue-invoices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financeiro_active_clients',
        },
        () => {
          // Invalidate the query to refetch the data
          queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const isClientOverdue = (clientId: string): boolean => {
    return overdueClientIds.includes(clientId);
  };

  return {
    overdueClientIds,
    isClientOverdue,
    isLoading,
  };
}
