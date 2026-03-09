import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StrategyFunnelTemplate {
  id: string;
  platform: 'meta' | 'google' | 'linkedin';
  name: string;
  description: string;
  how_it_works: string[];
  icon_color: string;
  visible_fields: string[];
  created_by: string;
  created_at: string;
}

// Available fields per platform
export const META_FIELDS = [
  { key: 'default_message', label: 'Mensagem Padrão', type: 'textarea' as const },
  { key: 'auto_filter_message', label: 'Mensagem Automática de Filtro', type: 'textarea' as const },
  { key: 'is_national', label: 'Anúncio Nacional?', type: 'switch' as const },
  { key: 'region', label: 'Região do Anúncio', type: 'text' as const },
  { key: 'has_crm', label: 'Cliente possui CRM?', type: 'switch' as const },
  { key: 'crm_name', label: 'Qual CRM o cliente usa?', type: 'text' as const },
  { key: 'initial_dispatch_message', label: 'Mensagem Inicial Automática', type: 'textarea' as const },
  { key: 'lp_url', label: 'Link da Landing Page', type: 'text' as const },
  { key: 'welcome_message', label: 'Mensagem de Boas-Vindas', type: 'textarea' as const },
  { key: 'auto_response', label: 'Resposta Automática', type: 'textarea' as const },
  { key: 'scripts_url', label: 'Link dos Roteiros', type: 'text' as const },
];

export const GOOGLE_FIELDS = [
  { key: 'keywords', label: 'Palavras-Chave', type: 'textarea' as const },
  { key: 'ad_titles', label: 'Títulos dos Anúncios', type: 'textarea' as const },
  { key: 'ad_descriptions', label: 'Descrições dos Anúncios', type: 'textarea' as const },
  { key: 'sitelinks', label: 'Sitelinks', type: 'textarea' as const },
  { key: 'callouts', label: 'Frases de Destaque (Callouts)', type: 'textarea' as const },
  { key: 'scripts_url', label: 'Link dos Roteiros', type: 'text' as const },
];

export const LINKEDIN_FIELDS = [
  { key: 'scripts_url', label: 'Link dos Roteiros', type: 'text' as const },
];

export function getFieldsForPlatform(platform: string) {
  switch (platform) {
    case 'meta': return META_FIELDS;
    case 'google': return GOOGLE_FIELDS;
    case 'linkedin': return LINKEDIN_FIELDS;
    default: return [];
  }
}

// Color options for template icons
export const ICON_COLORS = [
  { value: 'from-indigo-500 to-indigo-600', label: 'Indigo' },
  { value: 'from-cyan-500 to-cyan-600', label: 'Cyan' },
  { value: 'from-emerald-500 to-emerald-600', label: 'Esmeralda' },
  { value: 'from-amber-500 to-amber-600', label: 'Âmbar' },
  { value: 'from-rose-500 to-rose-600', label: 'Rosa' },
  { value: 'from-violet-500 to-violet-600', label: 'Violeta' },
  { value: 'from-sky-500 to-sky-600', label: 'Céu' },
  { value: 'from-lime-500 to-lime-600', label: 'Lima' },
  { value: 'from-fuchsia-500 to-fuchsia-600', label: 'Fúcsia' },
  { value: 'from-slate-500 to-slate-600', label: 'Cinza' },
];

export function useStrategyTemplates(platform?: string) {
  return useQuery({
    queryKey: ['strategy-funnel-templates', platform],
    queryFn: async () => {
      let query = supabase
        .from('strategy_funnel_templates')
        .select('*')
        .order('name', { ascending: true });

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as StrategyFunnelTemplate[];
    },
  });
}

export function useCreateStrategyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      platform: string;
      name: string;
      description: string;
      how_it_works: string[];
      icon_color: string;
      visible_fields: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: template, error } = await supabase
        .from('strategy_funnel_templates')
        .insert({
          ...data,
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return template as unknown as StrategyFunnelTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-funnel-templates'] });
      toast.success('Modelo de estratégia criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar modelo', { description: error.message });
    },
  });
}

export function useDeleteStrategyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('strategy_funnel_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategy-funnel-templates'] });
      toast.success('Modelo excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir modelo', { description: error.message });
    },
  });
}
