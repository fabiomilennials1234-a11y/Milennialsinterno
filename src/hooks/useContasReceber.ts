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

  // Fetch client product values (for add dropdown product options)
  const { data: activeProducts = [] } = useQuery({
    queryKey: ['active-products-for-receber'],
    queryFn: async () => {
      // Get from client_product_values (has actual values per product)
      const { data: cpv, error: cpvError } = await supabase
        .from('client_product_values')
        .select('client_id, product_slug, product_name, monthly_value');
      if (cpvError) throw cpvError;

      // Also get from financeiro_active_clients as fallback
      const { data: fac, error: facError } = await supabase
        .from('financeiro_active_clients')
        .select('client_id, product_slug, product_name, monthly_value');
      if (facError) throw facError;

      // Merge: cpv takes priority over fac
      const map = new Map<string, typeof fac[0]>();
      for (const item of (fac || [])) {
        map.set(`${item.client_id}::${item.product_slug}`, item);
      }
      for (const item of (cpv || [])) {
        map.set(`${item.client_id}::${item.product_slug}`, item);
      }
      return Array.from(map.values());
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
        // Initialize from ALL registered clients with their product values
        const { data: clients } = await supabase
          .from('clients')
          .select('id, entry_date, contracted_products')
          .eq('archived', false);

        if (!clients || clients.length === 0) return;

        // Filter clients whose entry_date is within or before the selected month
        const eligibleClients = clients.filter(c => {
          if (!c.entry_date) return true;
          const entryMonth = (c.entry_date as string).substring(0, 7);
          return entryMonth <= month;
        });

        if (eligibleClients.length === 0) return;

        const clientIds = eligibleClients.map(c => c.id);

        // Get per-product values from client_product_values (source of truth)
        const { data: productValues } = await supabase
          .from('client_product_values')
          .select('client_id, product_slug, product_name, monthly_value')
          .in('client_id', clientIds);

        // Also get financeiro_active_clients as fallback
        const { data: facData } = await supabase
          .from('financeiro_active_clients')
          .select('client_id, product_slug, product_name, monthly_value')
          .in('client_id', clientIds);

        // Build map: client_id -> product_slug -> { name, value }
        const clientProductMap = new Map<string, Map<string, { name: string; value: number }>>();

        // Populate from financeiro_active_clients first
        if (facData) {
          for (const ac of facData) {
            if (!clientProductMap.has(ac.client_id)) {
              clientProductMap.set(ac.client_id, new Map());
            }
            clientProductMap.get(ac.client_id)!.set(ac.product_slug, {
              name: ac.product_name || getProductDisplayName(ac.product_slug),
              value: ac.monthly_value || 0,
            });
          }
        }

        // Override with client_product_values (has actual monthly values)
        if (productValues) {
          for (const pv of productValues) {
            if (!clientProductMap.has(pv.client_id)) {
              clientProductMap.set(pv.client_id, new Map());
            }
            const ex = clientProductMap.get(pv.client_id)!.get(pv.product_slug);
            if (!ex || (pv.monthly_value || 0) > 0) {
              clientProductMap.get(pv.client_id)!.set(pv.product_slug, {
                name: pv.product_name || getProductDisplayName(pv.product_slug),
                value: pv.monthly_value || 0,
              });
            }
          }
        }

        // For clients with contracted_products but no product values yet
        for (const client of eligibleClients) {
          if (client.contracted_products && (client.contracted_products as string[]).length > 0) {
            if (!clientProductMap.has(client.id)) {
              clientProductMap.set(client.id, new Map());
            }
            const existingProducts = clientProductMap.get(client.id)!;
            for (const slug of (client.contracted_products as string[])) {
              if (!existingProducts.has(slug)) {
                existingProducts.set(slug, {
                  name: getProductDisplayName(slug),
                  value: 0,
                });
              }
            }
          }
        }

        // Build insert data
        const dataToInsert: Array<{
          client_id: string;
          valor: number;
          produto_slug: string;
          status: 'pendente';
          mes_referencia: string;
          is_recurring: boolean;
          inadimplencia_count: number;
        }> = [];

        for (const [clientId, products] of clientProductMap) {
          for (const [slug, product] of products) {
            dataToInsert.push({
              client_id: clientId,
              valor: product.value,
              produto_slug: slug,
              status: 'pendente',
              mes_referencia: month,
              is_recurring: true,
              inadimplencia_count: 0,
            });
          }
        }

        if (dataToInsert.length > 0) {
          const { error } = await supabase
            .from('financeiro_contas_receber')
            .insert(dataToInsert);

          if (error) throw error;
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
