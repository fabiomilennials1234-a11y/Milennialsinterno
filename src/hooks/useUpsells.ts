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
  const { user } = useAuth();

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

      // Upsell de sub-produto Torque CRM (v8/automation/copilot):
      // adiciona o sub em clients.torque_crm_products (idempotente).
      // Não mexe em contracted_products — o trigger process_upsell já cuida
      // desse campo automaticamente.
      if (upsell.product_slug.startsWith('torque-crm-')) {
        const sub = upsell.product_slug.replace('torque-crm-', '');
        if (['v8', 'automation', 'copilot'].includes(sub)) {
          const { data: clientRow } = await supabase
            .from('clients')
            .select('torque_crm_products' as any)
            .eq('id', upsell.client_id)
            .single();
          const current = ((clientRow as any)?.torque_crm_products as string[] | null) || [];
          if (!current.includes(sub)) {
            await supabase
              .from('clients')
              .update({ torque_crm_products: [...current, sub] } as any)
              .eq('id', upsell.client_id);
          }
          // Garante que torque-crm principal também esteja em contracted_products
          // caso o cliente tenha sido cadastrado sem ele (caso raro).
          const { data: cp } = await supabase
            .from('clients')
            .select('contracted_products')
            .eq('id', upsell.client_id)
            .single();
          const prods = (cp?.contracted_products as string[] | null) || [];
          if (!prods.includes('torque-crm')) {
            await supabase
              .from('clients')
              .update({ contracted_products: [...prods, 'torque-crm'] })
              .eq('id', upsell.client_id);
          }
        }
      }

      // The process_upsell trigger creates financeiro_client_onboarding,
      // financeiro_active_clients, and financeiro_tasks.
      // We also need to create a department_task for the financeiro daily board.
      if (user?.id) {
        const { data: client } = await supabase
          .from('clients')
          .select('name, razao_social')
          .eq('id', upsell.client_id)
          .single();

        const clientName = client?.razao_social || client?.name || 'Cliente';

        await supabase
          .from('department_tasks')
          .insert({
            user_id: user.id,
            title: `${clientName} — ${upsell.product_name} → Cadastrar no Asaas + Enviar 1ª Cobrança`,
            description: upsell.product_slug,
            task_type: 'daily',
            status: 'todo',
            priority: 'high',
            department: 'financeiro',
            related_client_id: upsell.client_id,
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          } as any);

        // Up-sell de Gestão de MKT Place → criar tarefa automática para o consultor
        if (upsell.product_slug === 'gestor-mktplace') {
          // Buscar o consultor MKT Place atribuído ao cliente
          const { data: clientMkt } = await supabase
            .from('clients')
            .select('assigned_mktplace')
            .eq('id', upsell.client_id)
            .single();

          const consultorId = clientMkt?.assigned_mktplace || user.id;

          // Verificar se já existe tarefa igual para evitar duplicação
          const { data: existingTask } = await supabase
            .from('department_tasks')
            .select('id')
            .eq('related_client_id', upsell.client_id)
            .eq('department', 'consultor_mktplace')
            .like('title', '%Marcar apresentação de estratégia Gestão de Mkt Place%')
            .eq('status', 'todo')
            .maybeSingle();

          if (!existingTask) {
            await supabase
              .from('department_tasks')
              .insert({
                user_id: consultorId,
                title: `Marcar apresentação de estratégia Gestão de Mkt Place (${clientName})`,
                description: 'gestor-mktplace',
                task_type: 'daily',
                status: 'todo',
                priority: 'high',
                department: 'consultor_mktplace',
                related_client_id: upsell.client_id,
                due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              } as any);
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsells'] });
      queryClient.invalidateQueries({ queryKey: ['upsell-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
      queryClient.invalidateQueries({ queryKey: ['client-product-values'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('UP Sell registrado com sucesso!');
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
