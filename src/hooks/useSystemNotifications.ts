import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface SystemNotification {
  id: string;
  recipient_id: string;
  recipient_role: string | null;
  notification_type: string;
  title: string;
  message: string;
  client_id: string | null;
  card_id: string | null;
  task_id: string | null;
  priority: string | null;
  metadata: Record<string, any> | null;
  read: boolean | null;
  read_at: string | null;
  dismissed: boolean | null;
  dismissed_at: string | null;
  created_at: string;
}

export function useSystemNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['system-notifications', user?.id],
    queryFn: async (): Promise<SystemNotification[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .or('read.is.null,read.eq.false')
        .or('dismissed.is.null,dismissed.eq.false')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching system notifications:', error);
        return [];
      }

      return (data || []) as SystemNotification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('system-notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}

export function useMarkSystemNotificationRead() {
  const queryClient = useQueryClient();

  return async (notificationId: string) => {
    const { error } = await supabase
      .from('system_notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
    }
  };
}

export function useMarkAllSystemNotificationsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return async () => {
    if (!user?.id) return;

    const { error } = await supabase
      .from('system_notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .or('read.is.null,read.eq.false');

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
    }
  };
}
