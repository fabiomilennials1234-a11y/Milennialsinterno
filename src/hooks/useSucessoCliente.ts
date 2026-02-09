import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Types
export interface AdsManager {
  user_id: string;
  name: string;
}

export interface CSClient {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  razao_social: string | null;
  general_info: string | null;
  expected_investment: number | null;
  group_id: string | null;
  squad_id: string | null;
  assigned_ads_manager: string | null;
  status: string;
  onboarding_started_at: string | null;
  campaign_published_at: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  archived_at: string | null;
  sales_percentage: number;
  entry_date: string | null;
  cs_classification: 'normal' | 'alerta' | 'critico' | 'encerrado';
  last_cs_contact_at: string | null;
  cs_classification_reason: string | null;
  niche: string | null;
  client_label: 'otimo' | 'bom' | 'medio' | 'ruim' | null;
  distrato_step: string | null;
}

export interface CSActionManual {
  id: string;
  title: string;
  description: string | null;
  content: string;
  category: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CSClassification = 'normal' | 'alerta' | 'critico' | 'encerrado';

// =============================================
// GESTORES DE ADS HOOKS
// =============================================

export function useAdsManagers() {
  return useQuery({
    queryKey: ['ads-managers'],
    queryFn: async (): Promise<AdsManager[]> => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'gestor_ads');

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = data.map(r => r.user_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds)
        .order('name');

      if (profilesError) throw profilesError;
      
      return (profiles || []).map(p => ({
        user_id: p.user_id,
        name: p.name,
      }));
    },
  });
}

// =============================================
// CLIENTES POR GESTOR
// =============================================

export function useCSClientsByManager() {
  return useQuery({
    queryKey: ['cs-clients-by-manager'],
    queryFn: async () => {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      
      return (clients || []) as CSClient[];
    },
  });
}

// =============================================
// CLASSIFICAÇÃO DE CLIENTES
// =============================================

export function useUpdateClientClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      classification,
      reason,
    }: {
      clientId: string;
      classification: CSClassification;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from('clients')
        .update({
          cs_classification: classification,
          cs_classification_reason: reason || null,
          last_cs_contact_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-clients-by-manager'] });
      queryClient.invalidateQueries({ queryKey: ['sucesso-clients'] });
      toast.success('Classificação atualizada');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar classificação', { description: error.message });
    },
  });
}

export function useUpdateClientLastContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .update({
          last_cs_contact_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-clients-by-manager'] });
    },
  });
}

// =============================================
// MANUAL DE AÇÕES
// =============================================

export function useCSActionManuals() {
  return useQuery({
    queryKey: ['cs-action-manuals'],
    queryFn: async (): Promise<CSActionManual[]> => {
      const { data, error } = await supabase
        .from('cs_action_manuals')
        .select('*')
        .order('position');

      if (error) throw error;
      return (data || []) as CSActionManual[];
    },
  });
}

export function useCreateCSActionManual() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      title,
      description,
      content,
      category,
    }: {
      title: string;
      description?: string;
      content: string;
      category?: string;
    }) => {
      // Get max position
      const { data: maxData } = await supabase
        .from('cs_action_manuals')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = (maxData?.[0]?.position || 0) + 1;

      const { data, error } = await supabase
        .from('cs_action_manuals')
        .insert({
          title,
          description: description || null,
          content,
          category: category || 'general',
          position: nextPosition,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-action-manuals'] });
      toast.success('Manual criado com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar manual', { description: error.message });
    },
  });
}

export function useUpdateCSActionManual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      description,
      content,
      category,
    }: {
      id: string;
      title?: string;
      description?: string;
      content?: string;
      category?: string;
    }) => {
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (content !== undefined) updateData.content = content;
      if (category !== undefined) updateData.category = category;

      const { error } = await supabase
        .from('cs_action_manuals')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-action-manuals'] });
      toast.success('Manual atualizado');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar manual', { description: error.message });
    },
  });
}

export function useDeleteCSActionManual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cs_action_manuals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-action-manuals'] });
      toast.success('Manual removido');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover manual', { description: error.message });
    },
  });
}

// =============================================
// CONTACT HISTORY
// =============================================

export interface CSContactRecord {
  id: string;
  client_id: string;
  user_id: string;
  contact_type: 'call' | 'email' | 'whatsapp' | 'meeting' | 'other';
  notes: string | null;
  created_at: string;
  user_name?: string;
}

export function useClientContactHistory(clientId: string | null) {
  return useQuery({
    queryKey: ['cs-contact-history', clientId],
    queryFn: async (): Promise<CSContactRecord[]> => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('cs_contact_history')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get user names
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.name]) || []);

      return (data || []).map(r => ({
        ...r,
        user_name: nameMap.get(r.user_id) || 'Usuário',
      })) as CSContactRecord[];
    },
    enabled: !!clientId,
  });
}

export function useRegisterContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      clientId,
      contactType,
      notes,
    }: {
      clientId: string;
      contactType: 'call' | 'email' | 'whatsapp' | 'meeting' | 'other';
      notes?: string;
    }) => {
      // Insert contact record
      const { error: insertError } = await supabase
        .from('cs_contact_history')
        .insert({
          client_id: clientId,
          user_id: user?.id,
          contact_type: contactType,
          notes: notes || null,
        });

      if (insertError) throw insertError;

      // Update client's last contact
      const { error: updateError } = await supabase
        .from('clients')
        .update({ last_cs_contact_at: new Date().toISOString() })
        .eq('id', clientId);

      if (updateError) throw updateError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cs-contact-history', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['cs-clients-by-manager'] });
      toast.success('Contato registrado');
    },
    onError: (error: any) => {
      toast.error('Erro ao registrar contato', { description: error.message });
    },
  });
}

// =============================================
// CS INSIGHTS (Melhorias)
// =============================================

export interface CSInsight {
  id: string;
  title: string;
  description: string | null;
  status: 'idea' | 'in_progress' | 'done' | 'archived';
  priority: 'normal' | 'urgent';
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

export function useCSInsights() {
  return useQuery({
    queryKey: ['cs-insights'],
    queryFn: async (): Promise<CSInsight[]> => {
      const { data, error } = await supabase
        .from('cs_insights')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get creator names
      const creatorIds = [...new Set((data || []).map(r => r.created_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', creatorIds as string[]);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.name]) || []);

      return (data || []).map(r => ({
        ...r,
        creator_name: r.created_by ? nameMap.get(r.created_by) || 'Usuário' : undefined,
      })) as CSInsight[];
    },
  });
}

export function useCreateCSInsight() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      title,
      description,
      priority,
    }: {
      title: string;
      description?: string;
      priority?: 'normal' | 'urgent';
    }) => {
      const { data, error } = await supabase
        .from('cs_insights')
        .insert({
          title,
          description: description || null,
          priority: priority || 'normal',
          created_by: user?.id,
          status: 'idea',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-insights'] });
      toast.success('Insight criado');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar insight', { description: error.message });
    },
  });
}

export function useUpdateCSInsight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      title,
      description,
      priority,
    }: {
      id: string;
      status?: 'idea' | 'in_progress' | 'done' | 'archived';
      title?: string;
      description?: string;
      priority?: 'normal' | 'urgent';
    }) => {
      const updateData: any = {};
      if (status !== undefined) updateData.status = status;
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (priority !== undefined) updateData.priority = priority;

      const { error } = await supabase
        .from('cs_insights')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cs-insights'] });
      toast.success('Insight atualizado');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar', { description: error.message });
    },
  });
}

// =============================================
// ALERT SUGGESTIONS (Auto classification)
// =============================================

export function useClientAlertSuggestions(clients: CSClient[]) {
  // Calculate which clients should be suggested for alert/critical
  const suggestions = clients.map(client => {
    const daysSinceContact = client.last_cs_contact_at
      ? Math.floor((Date.now() - new Date(client.last_cs_contact_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    let suggestedClassification: CSClassification | null = null;
    let reason = '';

    // If no contact for 7+ days, suggest alert
    if (daysSinceContact !== null && daysSinceContact >= 7 && client.cs_classification === 'normal') {
      suggestedClassification = 'alerta';
      reason = `Sem contato há ${daysSinceContact} dias`;
    }
    
    // If no contact for 14+ days, suggest critical
    if (daysSinceContact !== null && daysSinceContact >= 14 && client.cs_classification !== 'critico') {
      suggestedClassification = 'critico';
      reason = `Sem contato há ${daysSinceContact} dias`;
    }

    return {
      client,
      suggestedClassification,
      reason,
      daysSinceContact,
    };
  }).filter(s => s.suggestedClassification !== null);

  return suggestions;
}

// =============================================
// PERMISSIONS
// =============================================

export function useCSPermissions() {
  const { user, isCEO, isAdminUser } = useAuth();

  const canCreate = isCEO || user?.role === 'sucesso_cliente';
  const canMove = isCEO || user?.role === 'sucesso_cliente';
  const canEdit = isCEO || user?.role === 'sucesso_cliente';
  // Gestor de Projetos can set labels but not move/create
  const canSetLabels = isCEO || user?.role === 'sucesso_cliente' || user?.role === 'gestor_projetos';
  const canViewDashboards = isCEO || isAdminUser || user?.role === 'sucesso_cliente';
  const isViewOnly = !canMove && !canCreate;

  return {
    canCreate,
    canMove,
    canEdit,
    canSetLabels,
    canViewDashboards,
    isViewOnly,
  };
}
