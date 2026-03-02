import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProspeccaoAtivaConfig {
  enabled: boolean;
  daily_connections?: number;
  daily_messages?: number;
  daily_calls_target?: number;
  daily_emails_target?: number;
  cadence_steps?: number;
  cadence_interval_days?: number;
  use_automation?: boolean;
  automation_tool?: string;
  target_titles?: string;
  target_industries?: string;
  call_tool?: string;
  best_time_to_call?: string;
  email_tool?: string;
  initial_message_template?: string;
  followup_message_template?: string;
  scripts_url?: string;
  notes?: string;
}

export interface RemarketingBaseConfig {
  enabled: boolean;
  base_size?: number;
  email_tool?: string;
  cadence_steps?: number;
  cadence_interval_days?: number;
  message_frequency?: string;
  content_type?: string;
  offer_type?: string;
  approach?: string;
  target_segment?: string;
  offer_details?: string;
  initial_message_template?: string;
  scripts_url?: string;
  notes?: string;
}

export interface OutboundStrategy {
  id: string;
  client_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  monthly_budget: number | null;
  target_region: string | null;
  target_icp: string | null;
  use_client_base: boolean;
  client_base_details: string | null;
  tools_used: string | null;
  prospeccao_ativa_enabled: boolean;
  remarketing_base_enabled: boolean;
  ambos_enabled: boolean;
  pa_linkedin_prospecting: ProspeccaoAtivaConfig | null;
  pa_cold_calling: ProspeccaoAtivaConfig | null;
  pa_cold_email: ProspeccaoAtivaConfig | null;
  pa_whatsapp_outreach: ProspeccaoAtivaConfig | null;
  rb_email_reactivation: RemarketingBaseConfig | null;
  rb_whatsapp_nurturing: RemarketingBaseConfig | null;
  rb_upsell_crosssell: RemarketingBaseConfig | null;
  ambos_combined_notes: string | null;
  public_token: string;
  is_published: boolean;
}

export function useOutboundStrategies(clientId: string) {
  return useQuery({
    queryKey: ['outbound-strategies', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outbound_strategies' as any)
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as OutboundStrategy[];
    },
    enabled: !!clientId,
  });
}

export function useOutboundStrategy(strategyId: string) {
  return useQuery({
    queryKey: ['outbound-strategy', strategyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outbound_strategies' as any)
        .select('*')
        .eq('id', strategyId)
        .single();

      if (error) throw error;
      return data as unknown as OutboundStrategy;
    },
    enabled: !!strategyId,
  });
}

export function usePublicOutboundStrategy(token: string) {
  return useQuery({
    queryKey: ['public-outbound-strategy', token],
    queryFn: async () => {
      const { data: strategy, error } = await supabase
        .from('outbound_strategies' as any)
        .select('*')
        .eq('public_token', token)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      if (!strategy) throw new Error('Estratégia não encontrada');

      let clientName = 'Cliente';
      let clientNiche = null;

      try {
        const { data: client } = await supabase
          .from('clients')
          .select('name, niche')
          .eq('id', (strategy as any).client_id)
          .maybeSingle();

        if (client) {
          clientName = client.name;
          clientNiche = client.niche;
        }
      } catch {
        // Silently fail
      }

      return {
        ...strategy,
        clients: { name: clientName, niche: clientNiche }
      } as unknown as OutboundStrategy & { clients: { name: string; niche: string | null } };
    },
    enabled: !!token && token.length > 0,
    retry: false,
  });
}

export function useCreateOutboundStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<OutboundStrategy> & { client_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: strategy, error } = await supabase
        .from('outbound_strategies' as any)
        .insert({
          ...data,
          created_by: user.id,
          is_published: true,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return strategy as unknown as OutboundStrategy;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-strategies', variables.client_id] });
      toast.success('Estratégia outbound criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar estratégia outbound', { description: error.message });
    },
  });
}

export function useUpdateOutboundStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OutboundStrategy> }) => {
      const { data: strategy, error } = await supabase
        .from('outbound_strategies' as any)
        .update(data as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return strategy as unknown as OutboundStrategy;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-strategies', result.client_id] });
      queryClient.invalidateQueries({ queryKey: ['outbound-strategy', result.id] });
      toast.success('Estratégia outbound atualizada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar estratégia outbound', { description: error.message });
    },
  });
}

export function useDeleteOutboundStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('outbound_strategies' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, clientId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-strategies', result.clientId] });
      toast.success('Estratégia outbound excluída!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir estratégia outbound', { description: error.message });
    },
  });
}
