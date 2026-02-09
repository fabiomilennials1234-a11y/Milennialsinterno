import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SaleCommission {
  id: string;
  commission_value: number;
  user_id: string;
  user_role: string;
  created_at: string;
  client_id: string;
  sale_id: string;
  client?: { id: string; name: string };
  type: 'sale';
  status: 'pending' | 'paid';
  paid_at?: string | null;
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
  type: 'upsell';
  upsell?: {
    id: string;
    client_id: string;
    product_name: string;
    monthly_value: number;
    sold_by_name: string;
    client?: { id: string; name: string };
  };
}

export type Commission = SaleCommission | UpsellCommission;

export interface UserCommissionGroup {
  user_id: string;
  user_name: string;
  user_role: string;
  total: number;
  pending: number;
  paid: number;
  commissions: Commission[];
}

// Fetch all commissions from both sources
export function useAllCommissions() {
  return useQuery({
    queryKey: ['all-commissions'],
    queryFn: async () => {
      // Fetch upsell commissions
      const { data: upsellCommissions, error: upsellError } = await supabase
        .from('upsell_commissions')
        .select('*, upsell:upsells(id, client_id, product_name, monthly_value, sold_by_name, client:clients(id, name))')
        .order('created_at', { ascending: false });

      if (upsellError) throw upsellError;

      // Fetch sale commissions with user info
      const { data: saleCommissions, error: saleError } = await supabase
        .from('commission_records')
        .select(`
          id,
          commission_value,
          user_id,
          user_role,
          created_at,
          client_id,
          sale_id,
          client:clients(id, name)
        `)
        .order('created_at', { ascending: false });

      if (saleError) throw saleError;

      // Get user names for sale commissions
      const userIds = [...new Set((saleCommissions || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const userNameMap: Record<string, string> = {};
      (profiles || []).forEach(p => {
        userNameMap[p.user_id] = p.name || 'Usuário';
      });

      // Transform and combine commissions
      const allCommissions: Commission[] = [
        // Upsell commissions
        ...(upsellCommissions || []).map(c => ({
          ...c,
          type: 'upsell' as const,
          status: c.status as 'pending' | 'paid',
        })),
        // Sale commissions - marked as pending (no status field in table yet)
        ...(saleCommissions || []).map(c => ({
          ...c,
          type: 'sale' as const,
          status: 'pending' as const,
          user_name: userNameMap[c.user_id] || 'Usuário',
        })),
      ];

      // Group by user
      const userGroups: Record<string, UserCommissionGroup> = {};

      allCommissions.forEach(commission => {
        const userId = commission.user_id;
        const userName = commission.type === 'upsell' 
          ? (commission as UpsellCommission).user_name 
          : userNameMap[userId] || 'Usuário';
        const userRole = commission.type === 'sale' 
          ? (commission as SaleCommission).user_role 
          : 'sucesso_cliente';

        if (!userGroups[userId]) {
          userGroups[userId] = {
            user_id: userId,
            user_name: userName,
            user_role: userRole,
            total: 0,
            pending: 0,
            paid: 0,
            commissions: [],
          };
        }

        const value = Number(commission.commission_value);
        userGroups[userId].total += value;
        
        if (commission.status === 'paid') {
          userGroups[userId].paid += value;
        } else {
          userGroups[userId].pending += value;
        }

        userGroups[userId].commissions.push(commission);
      });

      // Sort groups by total descending
      const sortedGroups = Object.values(userGroups).sort((a, b) => b.total - a.total);

      // Calculate totals
      const totalCommissions = sortedGroups.reduce((sum, g) => sum + g.total, 0);
      const totalPending = sortedGroups.reduce((sum, g) => sum + g.pending, 0);
      const totalPaid = sortedGroups.reduce((sum, g) => sum + g.paid, 0);

      return {
        groups: sortedGroups,
        totals: {
          total: totalCommissions,
          pending: totalPending,
          paid: totalPaid,
        },
      };
    },
  });
}

// Mark upsell commission as paid
export function useMarkUpsellCommissionPaid() {
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
      queryClient.invalidateQueries({ queryKey: ['all-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['upsell-commissions'] });
      toast.success('Comissão marcada como paga!');
    },
    onError: () => {
      toast.error('Erro ao atualizar comissão');
    },
  });
}

// Get role label in Portuguese
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    gestor_ads: 'Gestor de Ads',
    sucesso_cliente: 'Sucesso do Cliente',
    consultor_comercial: 'Consultor Comercial',
    financeiro: 'Financeiro',
    gestor_projetos: 'Gestor de Projetos',
    ceo: 'CEO',
  };
  return labels[role] || role;
}
