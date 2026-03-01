import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export interface ContaReceberEntry {
  id: string;
  client_id: string;
  produto_slug: string;
  product_name: string;
  valor: number;
  status: 'em_dia' | 'pago' | 'pendente' | 'inadimplente';
  is_recurring: boolean;
  inadimplencia_count: number;
  mes_referencia: string;
}

export interface ClientGroup {
  client_id: string;
  client_name: string;
  razao_social: string | null;
  payment_due_day: number | null;
  entries: ContaReceberEntry[];
  total: number;
}

interface UpdateValueParams {
  id: string;
  clientId: string;
  productSlug: string;
  originalValue: number;
  newValue: number;
  scope: 'single_month' | 'all_following';
  justification: string;
  mesReferencia: string;
}

interface AddEntryParams {
  clientId: string;
  productSlug: string;
  productName: string;
  valor: number;
  isRecurring: boolean;
}

// Product slug to display name mapping
const PRODUCT_NAMES: Record<string, string> = {
  'millennials-growth': 'Millennials Growth',
  'millennials-outbound': 'Millennials Outbound',
  'on-demand': 'On Demand',
  'catalog-terceirizacao': 'Catálogo Terceirização',
  'zydon': 'Zydon',
  'septem': 'Septem',
  'vendedor-pastinha-comunidade': 'Vendedor Pastinha Comunidade',
  'b2b-club': 'B2B Club',
  'forja': 'Forja',
  'millennials-paddock': 'Millennials Paddock',
  'vendedor-pastinha-educacional': 'Vendedor Pastinha Educacional',
  'torque-crm': 'Torque CRM',
  'millennials-hunting': 'Millennials Hunting',
  'organic': 'Organic',
  'catalog-saas': 'Catálogo SaaS',
  'b2b-summit': 'B2B Summit',
  'consolidated': 'Valor Consolidado (Legado)',
};

export function getProductDisplayName(slug: string): string {
  return PRODUCT_NAMES[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function useContasReceber(selectedMonth: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentMonth = format(new Date(), 'yyyy-MM');

  // Fetch all clients for the add dropdown
  const { data: allClients = [] } = useQuery({
    queryKey: ['all-clients-for-receber'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, payment_due_day, contracted_products')
        .eq('archived', false)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled,
  });

  // Fetch active client products (for add dropdown product options)
  const { data: activeProducts = [] } = useQuery({
    queryKey: ['active-products-for-receber'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_active_clients')
        .select('client_id, product_slug, product_name, monthly_value');
      if (error) throw error;
      return data || [];
    },
    enabled,
  });

  // Fetch contas a receber for the selected month
  const { data: rawEntries = [], isLoading, refetch } = useQuery({
    queryKey: ['financeiro-contas-receber', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_contas_receber')
        .select(`
          id,
          client_id,
          valor,
          status,
          produto_slug,
          is_recurring,
          inadimplencia_count,
          mes_referencia,
          client:clients(id, name, razao_social, payment_due_day, contracted_products)
        `)
        .eq('mes_referencia', selectedMonth);

      if (error) throw error;
      return data || [];
    },
    enabled,
  });

  // Group entries by client
  const clientGroups: ClientGroup[] = useMemo(() => {
    const groupMap = new Map<string, ClientGroup>();

    for (const item of rawEntries) {
      const clientId = item.client_id || '';
      if (!groupMap.has(clientId)) {
        groupMap.set(clientId, {
          client_id: clientId,
          client_name: (item.client as any)?.name || 'Cliente',
          razao_social: (item.client as any)?.razao_social || null,
          payment_due_day: (item.client as any)?.payment_due_day || null,
          entries: [],
          total: 0,
        });
      }

      const group = groupMap.get(clientId)!;
      const entry: ContaReceberEntry = {
        id: item.id,
        client_id: clientId,
        produto_slug: item.produto_slug,
        product_name: getProductDisplayName(item.produto_slug),
        valor: Number(item.valor),
        status: item.status as ContaReceberEntry['status'],
        is_recurring: item.is_recurring,
        inadimplencia_count: item.inadimplencia_count,
        mes_referencia: item.mes_referencia,
      };
      group.entries.push(entry);
      group.total += entry.valor;
    }

    return Array.from(groupMap.values()).sort((a, b) =>
      a.client_name.localeCompare(b.client_name)
    );
  }, [rawEntries]);

  // Flat list of all entries (for totals calculation)
  const allEntries = useMemo(() => clientGroups.flatMap(g => g.entries), [clientGroups]);

  // Summary stats
  const stats = useMemo(() => {
    const totalReceber = allEntries.reduce((sum, e) => sum + e.valor, 0);
    const totalPago = allEntries.filter(e => e.status === 'pago').reduce((sum, e) => sum + e.valor, 0);
    const totalEmDia = allEntries.filter(e => e.status === 'em_dia').reduce((sum, e) => sum + e.valor, 0);
    const totalPendente = allEntries.filter(e => e.status === 'pendente').reduce((sum, e) => sum + e.valor, 0);
    const totalInadimplente = allEntries.filter(e => e.status === 'inadimplente').reduce((sum, e) => sum + e.valor, 0);
    const countInadimplente = allEntries.filter(e => e.status === 'inadimplente').length;
    const totalEntries = allEntries.length;
    const uniqueClients = clientGroups.length;

    return {
      totalReceber,
      totalPago,
      totalEmDia,
      totalPendente,
      totalInadimplente,
      countInadimplente,
      totalEntries,
      uniqueClients,
    };
  }, [allEntries, clientGroups]);

  // Initialize month from active clients if empty
  const initializeMonthMutation = useMutation({
    mutationFn: async (month: string) => {
      // Check if month already has data
      const { data: existing } = await supabase
        .from('financeiro_contas_receber')
        .select('id')
        .eq('mes_referencia', month)
        .limit(1);

      if (existing && existing.length > 0) return;

      // Check previous month for data to copy (only recurring entries)
      const prevMonthDate = new Date(month + '-01');
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const prevMonth = format(prevMonthDate, 'yyyy-MM');

      const { data: prevData } = await supabase
        .from('financeiro_contas_receber')
        .select('client_id, valor, status, produto_slug, is_recurring, inadimplencia_count')
        .eq('mes_referencia', prevMonth)
        .eq('is_recurring', true);

      if (prevData && prevData.length > 0) {
        const isCurrentOrPast = month <= currentMonth;
        const dataToInsert = prevData.map(item => ({
          client_id: item.client_id,
          valor: item.valor,
          produto_slug: item.produto_slug,
          status: isCurrentOrPast ? (item.status === 'pago' ? 'pendente' : item.status) : 'pendente',
          mes_referencia: month,
          is_recurring: true,
          inadimplencia_count: item.status !== 'pago' ? (item.inadimplencia_count || 0) + 1 : 0,
        }));

        const { error } = await supabase
          .from('financeiro_contas_receber')
          .insert(dataToInsert);

        if (error) throw error;
      } else {
        // Initialize from financeiro_active_clients (per product)
        const { data: activeClients } = await supabase
          .from('financeiro_active_clients')
          .select('client_id, product_slug, product_name, monthly_value');

        if (activeClients && activeClients.length > 0) {
          const dataToInsert = activeClients
            .filter(item => (item.monthly_value || 0) > 0)
            .map(item => ({
              client_id: item.client_id,
              valor: item.monthly_value || 0,
              produto_slug: item.product_slug,
              status: 'pendente' as const,
              mes_referencia: month,
              is_recurring: true,
              inadimplencia_count: 0,
            }));

          if (dataToInsert.length > 0) {
            const { error } = await supabase
              .from('financeiro_contas_receber')
              .insert(dataToInsert);

            if (error) throw error;
          }
        }
      }
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('financeiro_contas_receber')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber', selectedMonth] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  // Update value mutation with justification
  const updateValueMutation = useMutation({
    mutationFn: async (params: UpdateValueParams) => {
      const { id, clientId, productSlug, originalValue, newValue, scope, justification, mesReferencia } = params;

      // 1. Update the current entry
      const { error: updateError } = await supabase
        .from('financeiro_contas_receber')
        .update({ valor: newValue, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updateError) throw updateError;

      // 2. If scope is all_following, update base values and future entries
      if (scope === 'all_following') {
        // Update financeiro_active_clients
        await supabase
          .from('financeiro_active_clients')
          .update({ monthly_value: newValue, updated_at: new Date().toISOString() })
          .eq('client_id', clientId)
          .eq('product_slug', productSlug);

        // Update client_product_values
        await supabase
          .from('client_product_values')
          .update({ monthly_value: newValue, updated_at: new Date().toISOString() })
          .eq('client_id', clientId)
          .eq('product_slug', productSlug);

        // Update all future months in contas_receber
        await supabase
          .from('financeiro_contas_receber')
          .update({ valor: newValue, updated_at: new Date().toISOString() })
          .eq('client_id', clientId)
          .eq('produto_slug', productSlug)
          .gt('mes_referencia', mesReferencia);
      }

      // 3. Record the adjustment
      const { error: adjustError } = await supabase
        .from('contas_receber_value_adjustments')
        .insert({
          contas_receber_id: id,
          original_value: originalValue,
          new_value: newValue,
          scope,
          justification,
          user_id: user?.id || '',
        });
      if (adjustError) throw adjustError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Valor atualizado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao atualizar valor');
    },
  });

  // Toggle recurring
  const toggleRecurringMutation = useMutation({
    mutationFn: async ({ id, isRecurring }: { id: string; isRecurring: boolean }) => {
      const { error } = await supabase
        .from('financeiro_contas_receber')
        .update({ is_recurring: isRecurring, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber', selectedMonth] });
    },
    onError: () => {
      toast.error('Erro ao atualizar recorrência');
    },
  });

  // Add new entry mutation
  const addEntryMutation = useMutation({
    mutationFn: async (params: AddEntryParams) => {
      const { error } = await supabase
        .from('financeiro_contas_receber')
        .insert({
          client_id: params.clientId,
          produto_slug: params.productSlug,
          valor: params.valor,
          status: 'pendente',
          mes_referencia: selectedMonth,
          is_recurring: params.isRecurring,
          inadimplencia_count: 0,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber', selectedMonth] });
      toast.success('Entrada adicionada!');
    },
    onError: (error: any) => {
      if (error.message?.includes('unique') || error.code === '23505') {
        toast.error('Este produto deste cliente já está cadastrado neste mês');
      } else {
        toast.error('Erro ao adicionar entrada');
      }
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financeiro_contas_receber')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-receber', selectedMonth] });
      toast.success('Entrada removida!');
    },
    onError: () => {
      toast.error('Erro ao remover entrada');
    },
  });

  // Get available products for a specific client (not yet in this month)
  const getAvailableProducts = (clientId: string) => {
    const existingSlugs = new Set(
      rawEntries
        .filter(e => e.client_id === clientId)
        .map(e => e.produto_slug)
    );
    return activeProducts
      .filter(p => p.client_id === clientId && !existingSlugs.has(p.product_slug))
      .map(p => ({
        slug: p.product_slug,
        name: p.product_name || getProductDisplayName(p.product_slug),
        value: p.monthly_value || 0,
      }));
  };

  return {
    clientGroups,
    allEntries,
    stats,
    isLoading,
    allClients,
    activeProducts,
    getAvailableProducts,
    initializeMonth: initializeMonthMutation.mutate,
    updateStatus: updateStatusMutation.mutate,
    updateValue: updateValueMutation.mutate,
    toggleRecurring: toggleRecurringMutation.mutate,
    addEntry: addEntryMutation.mutate,
    deleteEntry: deleteEntryMutation.mutate,
    isUpdatingValue: updateValueMutation.isPending,
    isAddingEntry: addEntryMutation.isPending,
    isDeletingEntry: deleteEntryMutation.isPending,
    refetch,
  };
}
