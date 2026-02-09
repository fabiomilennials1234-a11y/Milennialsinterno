import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MetaStrategy {
  enabled: boolean;
  budget: number;
  scripts_url?: string;
  // Millennials Mensagem specific
  default_message?: string;
  auto_filter_message?: string;
  is_national?: boolean;
  region?: string;
  // Millennials Cadastro specific
  has_crm?: boolean;
  crm_name?: string;
  initial_dispatch_message?: string;
  // Millennials Call specific
  lp_url?: string;
  // Grupo VIP specific
  welcome_message?: string;
  auto_response?: string;
}

export interface GoogleStrategy {
  enabled: boolean;
  budget: number;
  keywords?: string;
  ad_titles?: string;
  ad_descriptions?: string;
  sitelinks?: string;
  callouts?: string;
  scripts_url?: string;
}

export interface LinkedInStrategy {
  enabled: boolean;
  budget: number;
  scripts_url?: string;
}

export interface ClientStrategy {
  id: string;
  client_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  minimum_investment: number | null;
  recommended_investment: number | null;
  ad_location: string | null;
  use_client_material: boolean;
  client_material_details: string | null;
  meta_enabled: boolean;
  google_enabled: boolean;
  linkedin_enabled: boolean;
  meta_millennials_mensagem: MetaStrategy | null;
  meta_millennials_cadastro: MetaStrategy | null;
  meta_millennials_call: MetaStrategy | null;
  meta_captacao_representantes: MetaStrategy | null;
  meta_captacao_sdr: MetaStrategy | null;
  meta_disparo_email: MetaStrategy | null;
  meta_grupo_vip: MetaStrategy | null;
  meta_aumento_base: MetaStrategy | null;
  google_pmax: GoogleStrategy | null;
  google_pesquisa: GoogleStrategy | null;
  google_display: GoogleStrategy | null;
  linkedin_vagas: LinkedInStrategy | null;
  linkedin_cadastro: LinkedInStrategy | null;
  public_token: string;
  is_published: boolean;
}

export function useClientStrategies(clientId: string) {
  return useQuery({
    queryKey: ['client-strategies', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_strategies')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as ClientStrategy[];
    },
    enabled: !!clientId,
  });
}

export function useClientStrategy(strategyId: string) {
  return useQuery({
    queryKey: ['client-strategy', strategyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (error) throw error;
      return data as unknown as ClientStrategy;
    },
    enabled: !!strategyId,
  });
}

export function usePublicStrategy(token: string) {
  return useQuery({
    queryKey: ['public-strategy', token],
    queryFn: async () => {
      // Fetch strategy without client join (RLS blocks anon from clients table)
      const { data: strategy, error } = await supabase
        .from('client_strategies')
        .select('*')
        .eq('public_token', token)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      if (!strategy) throw new Error('Estratégia não encontrada');

      // For public access, we need to get client name differently
      // We'll use a separate call that might fail if no RLS, but we handle gracefully
      let clientName = 'Cliente';
      let clientNiche = null;
      
      try {
        const { data: client } = await supabase
          .from('clients')
          .select('name, niche')
          .eq('id', strategy.client_id)
          .maybeSingle();
        
        if (client) {
          clientName = client.name;
          clientNiche = client.niche;
        }
      } catch {
        // Silently fail - client name will be 'Cliente'
      }
      
      return {
        ...strategy,
        clients: { name: clientName, niche: clientNiche }
      } as unknown as ClientStrategy & { clients: { name: string; niche: string | null } };
    },
    enabled: !!token && token.length > 0,
    retry: false,
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<ClientStrategy> & { client_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: strategy, error } = await supabase
        .from('client_strategies')
        .insert({
          ...data,
          created_by: user.id,
          is_published: true,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return strategy as unknown as ClientStrategy;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-strategies', variables.client_id] });
      toast.success('Estratégia criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar estratégia', { description: error.message });
    },
  });
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientStrategy> }) => {
      const { data: strategy, error } = await supabase
        .from('client_strategies')
        .update(data as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return strategy as unknown as ClientStrategy;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['client-strategies', result.client_id] });
      queryClient.invalidateQueries({ queryKey: ['client-strategy', result.id] });
      toast.success('Estratégia atualizada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar estratégia', { description: error.message });
    },
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('client_strategies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, clientId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['client-strategies', result.clientId] });
      toast.success('Estratégia excluída!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir estratégia', { description: error.message });
    },
  });
}
