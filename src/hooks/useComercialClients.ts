import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface ComercialClient {
  id: string;
  name: string;
  razao_social?: string;
  niche?: string;
  status?: string;
  comercial_status: string;
  client_label?: 'otimo' | 'bom' | 'medio' | 'ruim' | null;
  comercial_entered_at?: string;
  comercial_onboarding_started_at?: string;
  assigned_comercial?: string;
  assigned_ads_manager?: string;
  group_id?: string;
  squad_id?: string;
  created_at: string;
  updated_at: string;
}

// Fetch clients assigned to the current comercial user
export function useComercialAssignedClients() {
  const { user, isCEO } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['comercial-clients', user?.id],
    queryFn: async (): Promise<ComercialClient[]> => {
      let queryBuilder = supabase
        .from('clients')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });

      // CEO can see all clients, others see only assigned
      if (!isCEO) {
        queryBuilder = queryBuilder.eq('assigned_comercial', user?.id);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data || []) as ComercialClient[];
    },
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('comercial-clients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

// Fetch clients by comercial status
export function useComercialClientsByStatus(status: string) {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['comercial-clients-status', status, user?.id],
    queryFn: async (): Promise<ComercialClient[]> => {
      let queryBuilder = supabase
        .from('clients')
        .select('*')
        .eq('comercial_status', status)
        .eq('archived', false)
        .order('comercial_entered_at', { ascending: true });

      if (!isCEO) {
        queryBuilder = queryBuilder.eq('assigned_comercial', user?.id);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data || []) as ComercialClient[];
    },
    enabled: !!user,
  });
}

// Fetch new clients (status = 'novo') for 24h tracking
export function useComercialNewClients() {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['comercial-new-clients', user?.id],
    queryFn: async (): Promise<ComercialClient[]> => {
      let queryBuilder = supabase
        .from('clients')
        .select('*')
        .eq('comercial_status', 'novo')
        .eq('archived', false)
        .order('comercial_entered_at', { ascending: true });

      if (!isCEO) {
        queryBuilder = queryBuilder.eq('assigned_comercial', user?.id);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data || []) as ComercialClient[];
    },
    enabled: !!user,
  });
}

// Fetch clients in onboarding (consultoria_marcada or consultoria_realizada)
export function useComercialOnboardingClients() {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['comercial-onboarding-clients', user?.id],
    queryFn: async (): Promise<ComercialClient[]> => {
      let queryBuilder = supabase
        .from('clients')
        .select('*')
        .in('comercial_status', ['consultoria_marcada', 'consultoria_realizada'])
        .eq('archived', false)
        .order('comercial_onboarding_started_at', { ascending: true });

      if (!isCEO) {
        queryBuilder = queryBuilder.eq('assigned_comercial', user?.id);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data || []) as ComercialClient[];
    },
    enabled: !!user,
  });
}

// Fetch clients in acompanhamento
export function useComercialAcompanhamentoClients() {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['comercial-acompanhamento-clients', user?.id],
    queryFn: async (): Promise<ComercialClient[]> => {
      let queryBuilder = supabase
        .from('clients')
        .select('*')
        .eq('comercial_status', 'em_acompanhamento')
        .eq('archived', false)
        .order('updated_at', { ascending: false });

      if (!isCEO) {
        queryBuilder = queryBuilder.eq('assigned_comercial', user?.id);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data || []) as ComercialClient[];
    },
    enabled: !!user,
  });
}

// Update client comercial status
export function useUpdateComercialStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      status,
      onboardingStarted = false 
    }: { 
      clientId: string; 
      status: string;
      onboardingStarted?: boolean;
    }) => {
      const updates: Record<string, any> = { comercial_status: status };
      
      if (status === 'consultoria_marcada' && onboardingStarted) {
        updates.comercial_onboarding_started_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-new-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-onboarding-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-acompanhamento-clients'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status do cliente');
    },
  });
}

// Calculate hours since client entered comercial
export function getHoursSinceEntry(enteredAt?: string): number {
  if (!enteredAt) return 0;
  const entryDate = new Date(enteredAt);
  const now = new Date();
  const diffMs = now.getTime() - entryDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

// Calculate days since onboarding started
export function getDaysSinceOnboardingStart(startedAt?: string): number {
  if (!startedAt) return 0;
  const startDate = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Check if client is delayed (24h for new, 5 days for onboarding)
export function isClientDelayed(client: ComercialClient): boolean {
  if (client.comercial_status === 'novo') {
    return getHoursSinceEntry(client.comercial_entered_at) >= 24;
  }
  if (['consultoria_marcada', 'consultoria_realizada'].includes(client.comercial_status)) {
    return getDaysSinceOnboardingStart(client.comercial_onboarding_started_at) >= 5;
  }
  return false;
}

// Fetch all clients including churned and archived for the Churn section
export function useComercialChurnClients() {
  const { user, isCEO } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['comercial-churn-clients', user?.id],
    queryFn: async (): Promise<ComercialClient[]> => {
      let queryBuilder = supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false });

      // CEO can see all clients, others see only assigned
      if (!isCEO) {
        queryBuilder = queryBuilder.eq('assigned_comercial', user?.id);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data || []) as ComercialClient[];
    },
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('comercial-churn-clients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['comercial-churn-clients'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}
