import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface ComercialDelayNotification {
  id: string;
  user_id: string;
  user_name: string;
  notification_type: 'novo_cliente_24h' | 'onboarding_5d' | 'acompanhamento';
  client_id?: string;
  client_name?: string;
  task_id?: string;
  task_title?: string;
  due_date?: string;
  created_at: string;
}

export interface ComercialDelayJustification {
  id: string;
  notification_id: string;
  user_id: string;
  user_name: string;
  justification: string;
  notification_type: string;
  client_name?: string;
  archived: boolean;
  archived_at?: string;
  archived_by?: string;
  created_at: string;
}

// Fetch pending delay notifications for current user
export function useComercialDelayNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['comercial-delay-notifications', user?.id],
    queryFn: async (): Promise<ComercialDelayNotification[]> => {
      // Get notifications that don't have justifications yet
      const { data: notifications, error: notifError } = await supabase
        .from('comercial_delay_notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });

      if (notifError) throw notifError;

      // Get justifications to filter out already justified
      const { data: justifications, error: justError } = await supabase
        .from('comercial_delay_justifications')
        .select('notification_id')
        .eq('user_id', user?.id);

      if (justError) throw justError;

      const justifiedIds = new Set(justifications?.map(j => j.notification_id) || []);
      
      return (notifications || []).filter(n => !justifiedIds.has(n.id)) as ComercialDelayNotification[];
    },
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('comercial-delay-notif-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comercial_delay_notifications',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['comercial-delay-notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

// Create a delay notification
export function useCreateComercialDelayNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: Omit<ComercialDelayNotification, 'id' | 'created_at'>) => {
      // Check if notification already exists
      const { data: existing } = await supabase
        .from('comercial_delay_notifications')
        .select('id')
        .eq('user_id', notification.user_id)
        .eq('notification_type', notification.notification_type)
        .eq('client_id', notification.client_id || '')
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from('comercial_delay_notifications')
        .insert(notification)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial-delay-notifications'] });
    },
  });
}

// Save justification for a delay notification
export function useSaveComercialJustification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      notificationId, 
      justification 
    }: { 
      notificationId: string; 
      justification: string;
    }) => {
      // Get notification details
      const { data: notification, error: notifError } = await supabase
        .from('comercial_delay_notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (notifError) throw notifError;

      // Get user profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user?.id)
        .single();

      const { data, error } = await supabase
        .from('comercial_delay_justifications')
        .insert({
          notification_id: notificationId,
          user_id: user?.id,
          user_name: profile?.name || 'Usuário',
          justification,
          notification_type: notification.notification_type,
          client_name: notification.client_name,
        })
        .select()
        .single();

      if (error) throw error;

      // Delete the notification after justification is saved
      await supabase
        .from('comercial_delay_notifications')
        .delete()
        .eq('id', notificationId);

      return data;
    },
    onSuccess: () => {
      toast.success('Justificativa salva!');
      queryClient.invalidateQueries({ queryKey: ['comercial-delay-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-delay-justifications'] });
    },
    onError: () => {
      toast.error('Erro ao salvar justificativa');
    },
  });
}

// Fetch all justifications (for viewing in Justificativa column)
export function useComercialJustifications() {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['comercial-delay-justifications', user?.id],
    queryFn: async (): Promise<ComercialDelayJustification[]> => {
      const { data, error } = await supabase
        .from('comercial_delay_justifications')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ComercialDelayJustification[];
    },
    enabled: !!user,
  });
}

// Archive a justification (CEO only)
export function useArchiveComercialJustification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (justificationId: string) => {
      const { error } = await supabase
        .from('comercial_delay_justifications')
        .update({ 
          archived: true, 
          archived_at: new Date().toISOString(),
          archived_by: user?.id,
        })
        .eq('id', justificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Justificativa arquivada!');
      queryClient.invalidateQueries({ queryKey: ['comercial-delay-justifications'] });
    },
    onError: () => {
      toast.error('Erro ao arquivar justificativa');
    },
  });
}

// Get notification type label
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  novo_cliente_24h: 'Novo Cliente (+24h)',
  onboarding_5d: 'Onboarding PRO+ (+5 dias)',
  acompanhamento: 'Acompanhamento não movido',
};
