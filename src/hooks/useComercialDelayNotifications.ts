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

// Fetch pending delay notifications for current user (CEO sees all)
export function useComercialDelayNotifications() {
  const { user, isCEO } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['comercial-delay-notifications', user?.id],
    queryFn: async (): Promise<ComercialDelayNotification[]> => {
      // Get notifications that don't have justifications yet
      let notifQuery = supabase
        .from('comercial_delay_notifications')
        .select('*')
        .order('created_at', { ascending: true });

      if (user?.role === 'consultor_comercial') {
        notifQuery = notifQuery.eq('user_id', user?.id);
      }

      const { data: notifications, error: notifError } = await notifQuery;
      if (notifError) throw notifError;

      // Get justifications to filter out already justified
      let justQuery = supabase
        .from('comercial_delay_justifications')
        .select('notification_id');

      if (user?.role === 'consultor_comercial') {
        justQuery = justQuery.eq('user_id', user?.id);
      }

      const { data: justifications, error: justError } = await justQuery;
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

// Check if user already justified a delay notification for a given (user, type, client).
// Shared by useCreateComercialDelayNotification + useCheckComercialDelays to prevent
// re-creating notifications for cases already justified (which previously caused the
// "justificativas infinitas" loop).
export async function hasActiveJustificationForDelay(params: {
  user_id: string;
  notification_type: string;
  client_id?: string | null;
}): Promise<boolean> {
  let query = supabase
    .from('comercial_delay_notifications')
    .select('id')
    .eq('user_id', params.user_id)
    .eq('notification_type', params.notification_type);

  if (params.client_id) {
    query = query.eq('client_id', params.client_id);
  }

  const { data: notifications, error } = await query;
  if (error) throw error;
  if (!notifications || notifications.length === 0) return false;

  const ids = notifications.map(n => n.id);
  const { data: justifications, error: justError } = await supabase
    .from('comercial_delay_justifications')
    .select('id')
    .eq('user_id', params.user_id)
    .in('notification_id', ids)
    .limit(1);

  if (justError) throw justError;
  return (justifications?.length ?? 0) > 0;
}

// Create a delay notification (idempotent; skips if user already justified one).
export function useCreateComercialDelayNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notification: Omit<ComercialDelayNotification, 'id' | 'created_at'>) => {
      // Skip if a justification already exists for (user, type, client) — prevents loop
      // where deleting/recreating notifications would reopen the modal endlessly.
      const alreadyJustified = await hasActiveJustificationForDelay({
        user_id: notification.user_id,
        notification_type: notification.notification_type,
        client_id: notification.client_id ?? null,
      });
      if (alreadyJustified) return null;

      // Dedup: don't insert if an unresolved notification already exists.
      let existingQuery = supabase
        .from('comercial_delay_notifications')
        .select('id')
        .eq('user_id', notification.user_id)
        .eq('notification_type', notification.notification_type);

      existingQuery = notification.client_id
        ? existingQuery.eq('client_id', notification.client_id)
        : existingQuery.is('client_id', null);

      const { data: existing } = await existingQuery.maybeSingle();
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

      // NOTE: We intentionally do NOT delete the notification row here.
      // The justification row (via `notification_id` FK) is the source of
      // truth for "already handled"; `useComercialDelayNotifications` filters
      // notifications client-side by joining on justifications.
      // Deleting the notification caused `useCheckComercialDelays` to recreate
      // it on the next 5-min tick, reopening the modal forever.
      // Fix: 2026-04-24 — bug "justificativas infinitas".
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

// Fetch all justifications (for viewing in Justificativa column - CEO sees all, others see own)
export function useComercialJustifications() {
  const { user, isCEO } = useAuth();

  return useQuery({
    queryKey: ['comercial-delay-justifications', user?.id],
    queryFn: async (): Promise<ComercialDelayJustification[]> => {
      let queryBuilder = supabase
        .from('comercial_delay_justifications')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (user?.role === 'consultor_comercial') {
        queryBuilder = queryBuilder.eq('user_id', user?.id);
      }

      const { data, error } = await queryBuilder;

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
