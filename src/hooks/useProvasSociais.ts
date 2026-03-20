import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ProvaSocialType {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface ProvaSocialMetric {
  id: string;
  prova_social_id: string;
  type_id: string;
  type_name: string;
  value: number;
  created_at: string;
}

export interface ProvaSocial {
  id: string;
  client_name: string;
  client_logo_url: string | null;
  project_duration: string;
  strategy_description: string | null;
  archived: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metrics: ProvaSocialMetric[];
}

export const uploadLogo = async (file: File): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${user.id}/provas-sociais/${Date.now()}-${safeName}`;
  const { data, error } = await supabase.storage.from('avatars').upload(fileName, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
  return urlData.publicUrl;
};

export function useProvasSociais(showArchived = false) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const provasQuery = useQuery({
    queryKey: ['provas-sociais', showArchived],
    queryFn: async (): Promise<ProvaSocial[]> => {
      let query = (supabase.from('provas_sociais') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (!showArchived) {
        query = query.eq('archived', false);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch metrics for all provas
      const provaIds = (data || []).map((p: any) => p.id);
      let metrics: any[] = [];
      if (provaIds.length > 0) {
        const { data: metricsData, error: metricsError } = await (supabase.from('prova_social_metrics') as any)
          .select('*')
          .in('prova_social_id', provaIds);
        if (metricsError) throw metricsError;
        metrics = metricsData || [];
      }

      return (data || []).map((p: any) => ({
        ...p,
        metrics: metrics.filter((m: any) => m.prova_social_id === p.id),
      })) as ProvaSocial[];
    },
  });

  const typesQuery = useQuery({
    queryKey: ['prova-social-types'],
    queryFn: async (): Promise<ProvaSocialType[]> => {
      const { data, error } = await (supabase.from('prova_social_types') as any)
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as ProvaSocialType[];
    },
  });

  const createProvaSocial = useMutation({
    mutationFn: async (input: {
      client_name: string;
      client_logo_url?: string | null;
      project_duration: string;
      strategy_description: string;
      metrics: Array<{ type_id: string; type_name: string; value: number }>;
    }) => {
      const { data, error } = await (supabase.from('provas_sociais') as any)
        .insert({
          client_name: input.client_name,
          client_logo_url: input.client_logo_url || null,
          project_duration: input.project_duration,
          strategy_description: input.strategy_description,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (input.metrics.length > 0) {
        const metricsToInsert = input.metrics.map((m) => ({
          prova_social_id: data.id,
          type_id: m.type_id,
          type_name: m.type_name,
          value: m.value,
        }));
        const { error: metricsError } = await (supabase.from('prova_social_metrics') as any)
          .insert(metricsToInsert);
        if (metricsError) throw metricsError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provas-sociais'] });
      toast.success('Prova social registrada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao registrar prova social: ' + error.message);
    },
  });

  const updateProvaSocial = useMutation({
    mutationFn: async (input: {
      id: string;
      client_name: string;
      client_logo_url?: string | null;
      project_duration: string;
      strategy_description: string;
    }) => {
      const { data, error } = await (supabase.from('provas_sociais') as any)
        .update({
          client_name: input.client_name,
          client_logo_url: input.client_logo_url || null,
          project_duration: input.project_duration,
          strategy_description: input.strategy_description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provas-sociais'] });
      toast.success('Prova social atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar prova social: ' + error.message);
    },
  });

  const archiveProvaSocial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('provas_sociais') as any)
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provas-sociais'] });
      toast.success('Prova social arquivada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao arquivar: ' + error.message);
    },
  });

  const deleteProvaSocial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('provas_sociais') as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provas-sociais'] });
      toast.success('Prova social excluída!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  const addMetric = useMutation({
    mutationFn: async (input: {
      prova_social_id: string;
      type_id: string;
      type_name: string;
      value: number;
    }) => {
      const { data, error } = await (supabase.from('prova_social_metrics') as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provas-sociais'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao adicionar métrica: ' + error.message);
    },
  });

  const updateMetric = useMutation({
    mutationFn: async (input: { id: string; value: number }) => {
      const { error } = await (supabase.from('prova_social_metrics') as any)
        .update({ value: input.value })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provas-sociais'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar métrica: ' + error.message);
    },
  });

  const removeMetric = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('prova_social_metrics') as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provas-sociais'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao remover métrica: ' + error.message);
    },
  });

  const createType = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await (supabase.from('prova_social_types') as any)
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      return data as ProvaSocialType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prova-social-types'] });
      toast.success('Tipo de métrica criado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar tipo: ' + error.message);
    },
  });

  return {
    provas: provasQuery.data || [],
    isLoading: provasQuery.isLoading,
    types: typesQuery.data || [],
    typesLoading: typesQuery.isLoading,
    createProvaSocial,
    updateProvaSocial,
    archiveProvaSocial,
    deleteProvaSocial,
    addMetric,
    updateMetric,
    removeMetric,
    createType,
  };
}
