import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

interface AtrizesCompletionNotification {
  id: string;
  card_id: string;
  card_title: string;
  completed_by: string;
  completed_by_name: string;
  requester_id: string;
  requester_name: string;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

export function useAtrizesCompletionNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unread notifications for current user
  const { data: notifications = [], refetch } = useQuery({
    queryKey: ['atrizes-completion-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('atrizes_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching atrizes notifications:', error);
        return [];
      }

      return (data || []) as unknown as AtrizesCompletionNotification[];
    },
    enabled: !!user?.id,
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('atrizes_completion_notifications')
        .update({ read: true, read_at: new Date().toISOString() } as any)
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atrizes-completion-notifications'] });
    },
  });

  // Create notification when card moves to aguardando_aprovacao
  const createNotificationMutation = useMutation({
    mutationFn: async (data: {
      cardId: string;
      cardTitle: string;
      completedBy: string;
      completedByName: string;
      requesterId: string;
      requesterName: string;
    }) => {
      // Check if notification already exists for this card
      const { data: existing } = await supabase
        .from('atrizes_completion_notifications')
        .select('id')
        .eq('card_id', data.cardId)
        .eq('read', false)
        .maybeSingle();

      if (existing) {
        console.log('Notification already exists for this card');
        return null;
      }

      const { error } = await supabase
        .from('atrizes_completion_notifications')
        .insert({
          card_id: data.cardId,
          card_title: data.cardTitle,
          completed_by: data.completedBy,
          completed_by_name: data.completedByName,
          requester_id: data.requesterId,
          requester_name: data.requesterName,
        } as any);

      if (error) throw error;
    },
    onError: (error) => {
      console.error('Error creating atrizes notification:', error);
    },
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('atrizes-completion-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'atrizes_completion_notifications',
          filter: `requester_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as AtrizesCompletionNotification;
          toast.success(
            `🎬 Sua demanda "${notification.card_title}" em Gravação está pronta!`,
            {
              duration: 8000,
              action: {
                label: 'Ver',
                onClick: () => {
                  // Could navigate to the card
                },
              },
            }
          );
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  return {
    notifications,
    markAsRead: markAsReadMutation.mutate,
    createNotification: createNotificationMutation.mutate,
    isCreating: createNotificationMutation.isPending,
  };
}

// Hook for showing toasts globally (used in MainLayout)
export function useAtrizesCompletionToasts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch and show pending notifications on mount
  const { data: pendingNotifications = [] } = useQuery({
    queryKey: ['atrizes-pending-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('atrizes_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []) as unknown as AtrizesCompletionNotification[];
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Show pending notifications once on mount
  useEffect(() => {
    if (pendingNotifications.length > 0) {
      pendingNotifications.forEach((notification) => {
        toast.success(
          `🎬 Sua demanda "${notification.card_title}" em Gravação está pronta!`,
          {
            id: `atrizes-pending-${notification.id}`,
            duration: 10000,
            action: {
              label: 'Marcar como lida',
              onClick: async () => {
                await supabase
                  .from('atrizes_completion_notifications')
                  .update({ read: true, read_at: new Date().toISOString() } as any)
                  .eq('id', notification.id);
                queryClient.invalidateQueries({ queryKey: ['atrizes-pending-notifications'] });
              },
            },
          }
        );
      });
    }
  }, [pendingNotifications.length > 0]);

  // Subscribe to realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('atrizes-completion-toasts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'atrizes_completion_notifications',
          filter: `requester_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as AtrizesCompletionNotification;
          toast.success(
            `🎬 Sua demanda "${notification.card_title}" em Gravação está pronta!`,
            {
              duration: 8000,
            }
          );
          queryClient.invalidateQueries({ queryKey: ['atrizes-pending-notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
