import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface ClientAreaItem {
  id: string;
  name: string;
  razao_social: string | null;
  cnpj: string | null;
  niche: string | null;
  status: string | null;
  cx_validation_status: string | null;
  cx_validation_notes: string | null;
  entry_date: string | null;
  created_at: string;
  monthly_value: number | null;
  contracted_products: string[] | null;
  torque_crm_products: string[] | null;
  client_label: 'otimo' | 'bom' | 'medio' | 'ruim' | null;
  assigned_ads_manager: string | null;
  assigned_sucesso_cliente: string | null;
  assigned_comercial: string | null;
  assigned_crm: string | null;
  assigned_outbound_manager: string | null;
  assigned_mktplace: string | null;
  general_info: string | null;
  expected_investment: number | null;
  contract_duration_months: number | null;
  payment_due_day: number | null;
  sales_percentage: number;
  phone: string | null;
  // Resolved names
  ads_manager_name?: string;
  sucesso_cliente_name?: string;
  comercial_name?: string;
  crm_name?: string;
}

const CLIENT_AREA_KEY = ['client-area-data'];

export function useClientArea() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CLIENT_AREA_KEY,
    queryFn: async (): Promise<ClientAreaItem[]> => {
      const { data: clients, error } = await supabase
        .from('clients')
        .select(`
          id, name, razao_social, cnpj, niche, status,
          cx_validation_status, cx_validation_notes,
          entry_date, created_at, monthly_value,
          contracted_products, torque_crm_products, client_label,
          assigned_ads_manager, assigned_sucesso_cliente,
          assigned_comercial, assigned_crm,
          assigned_outbound_manager, assigned_mktplace,
          general_info, expected_investment,
          contract_duration_months, payment_due_day,
          sales_percentage, phone
        `)
        .neq('status', 'churned')
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Collect all manager UUIDs
      const managerIds = new Set<string>();
      (clients || []).forEach(c => {
        if (c.assigned_ads_manager) managerIds.add(c.assigned_ads_manager);
        if (c.assigned_sucesso_cliente) managerIds.add(c.assigned_sucesso_cliente);
        if (c.assigned_comercial) managerIds.add(c.assigned_comercial);
        if (c.assigned_crm) managerIds.add(c.assigned_crm);
      });

      let profileMap: Record<string, string> = {};
      if (managerIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', Array.from(managerIds));
        if (profiles) {
          profileMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (clients || []).map(c => ({
        ...c,
        client_label: c.client_label as ClientAreaItem['client_label'],
        ads_manager_name: c.assigned_ads_manager ? profileMap[c.assigned_ads_manager] : undefined,
        sucesso_cliente_name: c.assigned_sucesso_cliente ? profileMap[c.assigned_sucesso_cliente] : undefined,
        comercial_name: c.assigned_comercial ? profileMap[c.assigned_comercial] : undefined,
        crm_name: c.assigned_crm ? profileMap[c.assigned_crm] : undefined,
      }));
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Realtime invalidation on clients table changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('client-area-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clients',
      }, () => {
        queryClient.invalidateQueries({ queryKey: CLIENT_AREA_KEY });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return query;
}
