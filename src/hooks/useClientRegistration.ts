import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface OrganizationGroup {
  id: string;
  name: string;
  slug: string;
}

export interface Squad {
  id: string;
  name: string;
  slug: string;
  group_id: string;
  group_name?: string;
}

export interface AdsManager {
  user_id: string;
  name: string;
  email: string;
}

export interface ComercialConsultant {
  user_id: string;
  name: string;
  email: string;
}

export interface ProductValueInput {
  product_slug: string;
  product_name: string;
  monthly_value: number;
}

export interface NewClientData {
  name: string;
  cnpj?: string;
  cpf?: string;
  razao_social?: string;
  niche?: string;
  general_info?: string;
  expected_investment?: number;
  monthly_value?: number;
  sales_percentage?: number;
  group_id?: string;
  squad_id?: string;
  assigned_ads_manager?: string;
  assigned_comercial?: string;
  entry_date?: string;
  contracted_products?: string[];
  product_values?: ProductValueInput[];
}

// Fetch groups for dropdown
export function useGroups() {
  return useQuery({
    queryKey: ['registration-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_groups')
        .select('id, name, slug')
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as OrganizationGroup[];
    },
  });
}

// Fetch squads for dropdown (filtered by group)
export function useSquads(groupId?: string) {
  return useQuery({
    queryKey: ['registration-squads', groupId],
    queryFn: async () => {
      let query = supabase
        .from('squads')
        .select('id, name, slug, group_id')
        .order('position', { ascending: true });
      
      if (groupId) {
        query = query.eq('group_id', groupId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Squad[];
    },
    enabled: !!groupId,
  });
}

// Fetch ads managers for dropdown
export function useAdsManagers() {
  return useQuery({
    queryKey: ['ads-managers'],
    queryFn: async () => {
      // Get all users with gestor_ads role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_ads');
      
      if (roleError) throw roleError;
      
      const userIds = roleData?.map(r => r.user_id) || [];
      
      if (userIds.length === 0) return [];
      
      // Get profile info for these users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      
      if (profileError) throw profileError;
      
      return profiles as AdsManager[];
    },
  });
}

// Fetch comercial consultants for dropdown
export function useComercialConsultants() {
  return useQuery({
    queryKey: ['comercial-consultants'],
    queryFn: async () => {
      // Get all users with consultor_comercial role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'consultor_comercial');
      
      if (roleError) throw roleError;
      
      const userIds = roleData?.map(r => r.user_id) || [];
      
      if (userIds.length === 0) return [];
      
      // Get profile info for these users
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      
      if (profileError) throw profileError;
      
      return profiles as ComercialConsultant[];
    },
  });
}

// Create new client
export function useCreateClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (clientData: NewClientData) => {
      // Primeiro, cria o cliente
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: clientData.name,
          cnpj: clientData.cnpj,
          cpf: clientData.cpf,
          razao_social: clientData.razao_social,
          niche: clientData.niche,
          general_info: clientData.general_info,
          expected_investment: clientData.expected_investment,
          monthly_value: clientData.monthly_value,
          sales_percentage: clientData.sales_percentage,
          group_id: clientData.group_id,
          squad_id: clientData.squad_id,
          assigned_ads_manager: clientData.assigned_ads_manager,
          assigned_comercial: clientData.assigned_comercial,
          entry_date: clientData.entry_date,
          contracted_products: clientData.contracted_products,
          created_by: user?.id,
          status: 'new_client',
          // Campos para o Consultor Comercial
          comercial_status: 'novo',
          comercial_entered_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (clientError) throw clientError;
      
      // Depois, salva os valores por produto
      if (clientData.product_values && clientData.product_values.length > 0) {
        const productValuesData = clientData.product_values.map(pv => ({
          client_id: client.id,
          product_slug: pv.product_slug,
          product_name: pv.product_name,
          monthly_value: pv.monthly_value,
        }));
        
        const { error: pvError } = await supabase
          .from('client_product_values')
          .insert(productValuesData);
        
        if (pvError) {
          console.error('Error saving product values:', pvError);
          // Não falha a criação do cliente por causa disso
        }
      }
      
      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['board-cards'] });
      queryClient.invalidateQueries({ queryKey: ['recent-clients'] });
      queryClient.invalidateQueries({ queryKey: ['total-clients-count'] });
      queryClient.invalidateQueries({ queryKey: ['client-product-values'] });
      // Invalidar queries do Consultor Comercial
      queryClient.invalidateQueries({ queryKey: ['comercial-clients'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-new-clients'] });
      toast.success('Cliente cadastrado com sucesso!', {
        description: 'Cards criados automaticamente nos kanbans das equipes.',
      });
    },
    onError: (error: Error) => {
      console.error('Error creating client:', error);
      toast.error('Erro ao cadastrar cliente', {
        description: error.message,
      });
    },
  });
}
