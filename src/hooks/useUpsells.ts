import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Upsell {
  id: string;
  client_id: string;
  product_slug: string;
  product_name: string;
  monthly_value: number;
  sold_by: string;
  sold_by_name: string;
  status: 'pending' | 'contracted' | 'cancelled';
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
  };
}

export interface UpsellCommission {
  id: string;
  upsell_id: string;
  user_id: string;
  user_name: string;
  commission_value: number;
  commission_percentage: number;
  status: 'pending' | 'paid';
  paid_at: string | null;
  created_at: string;
  upsell?: Upsell;
}

// Fetch all upsells
export function useUpsells() {
  return useQuery({
    queryKey: ['upsells'],
    queryFn: async (): Promise<Upsell[]> => {
      const { data, error } = await supabase
        .from('upsells')
        .select('*, client:clients(id, name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Upsell[];
    },
  });
}

// Fetch upsell commissions
export function useUpsellCommissions() {
  return useQuery({
    queryKey: ['upsell-commissions'],
    queryFn: async (): Promise<UpsellCommission[]> => {
      const { data, error } = await supabase
        .from('upsell_commissions')
        .select('*, upsell:upsells(id, client_id, product_name, monthly_value, sold_by_name, client:clients(id, name))')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as UpsellCommission[];
    },
  });
}

// Fetch commissions for current month
export function useCurrentMonthCommissions() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  return useQuery({
    queryKey: ['upsell-commissions', 'current-month'],
    queryFn: async (): Promise<UpsellCommission[]> => {
      const { data, error } = await supabase
        .from('upsell_commissions')
        .select('*, upsell:upsells(id, client_id, product_name, monthly_value, sold_by_name, client:clients(id, name))')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as UpsellCommission[];
    },
  });
}

// Create upsell
export function useCreateUpsell() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (upsell: {
      client_id: string;
      product_slug: string;
      product_name: string;
      monthly_value: number;
      sold_by: string;
      sold_by_name: string;
    }) => {
      const { data, error } = await supabase
        .from('upsells')
        .insert(upsell)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsells'] });
      queryClient.invalidateQueries({ queryKey: ['upsell-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['client-product-values'] });
      toast.success('UP Sell registrado com sucesso!', {
        description: 'Comissão de 7% gerada automaticamente.',
      });
    },
    onError: (error: Error) => {
      console.error('Error creating upsell:', error);
      toast.error('Erro ao registrar UP Sell', {
        description: error.message,
      });
    },
  });
}

// Update upsell status
export function useUpdateUpsellStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      upsellId,
      status,
    }: {
      upsellId: string;
      status: 'pending' | 'contracted' | 'cancelled';
    }) => {
      const { error } = await supabase
        .from('upsells')
        .update({ status })
        .eq('id', upsellId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsells'] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

// Mark commission as paid
export function useMarkCommissionPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commissionId: string) => {
      const { error } = await supabase
        .from('upsell_commissions')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', commissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-commissions'] });
      toast.success('Comissão marcada como paga!');
    },
    onError: () => {
      toast.error('Erro ao atualizar comissão');
    },
  });
}

// Calculate commission totals by user
export function calculateCommissionsByUser(commissions: UpsellCommission[]) {
  const byUser: Record<string, { user_name: string; total: number; pending: number; paid: number; count: number }> = {};

  commissions.forEach((c) => {
    if (!byUser[c.user_id]) {
      byUser[c.user_id] = {
        user_name: c.user_name,
        total: 0,
        pending: 0,
        paid: 0,
        count: 0,
      };
    }
    byUser[c.user_id].total += Number(c.commission_value);
    byUser[c.user_id].count += 1;
    if (c.status === 'pending') {
      byUser[c.user_id].pending += Number(c.commission_value);
    } else {
      byUser[c.user_id].paid += Number(c.commission_value);
    }
  });

  return Object.entries(byUser).map(([user_id, data]) => ({
    user_id,
    ...data,
  }));
}
