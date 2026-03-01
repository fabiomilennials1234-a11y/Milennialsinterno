import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AdsNewClientNotification {
  id: string;
  ads_manager_id: string;
  client_id: string;
  client_name: string;
  created_by: string;
  created_by_name: string;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

// Create notification and task when a new client is assigned to ads manager
export async function createNewClientNotificationAndTask({
  clientId,
  clientName,
  adsManagerId,
  createdBy,
  createdByName,
}: {
  clientId: string;
  clientName: string;
  adsManagerId: string;
  createdBy: string;
  createdByName: string;
}) {
  // 1. Create the visible task in ads_tasks (named "Marcar Call 1: [nome]")
  // The tag "client_id:uuid" links this task to the client for onboarding automation
  const { error: taskError } = await supabase
    .from('ads_tasks')
    .insert({
      ads_manager_id: adsManagerId,
      title: `Marcar Call 1: ${clientName}`,
      description: `Marcar a primeira call com o cliente ${clientName}. Ao concluir, o cliente será movido para Call #1 Marcada.`,
      task_type: 'daily',
      status: 'todo',
      priority: 'high',
      tags: [`client_id:${clientId}`, `onboarding_task_type:marcar_call_1`],
    });

  if (taskError) {
    console.error('[createNewClientNotificationAndTask] Erro ao criar tarefa ads_tasks:', {
      code: taskError.code,
      message: taskError.message,
      adsManagerId,
      clientId,
    });
    // Don't throw — notification can still be created
  }

  // 2. Create the notification
  const { error: notificationError } = await supabase
    .from('ads_new_client_notifications')
    .insert({
      ads_manager_id: adsManagerId,
      client_id: clientId,
      client_name: clientName,
      created_by: createdBy,
      created_by_name: createdByName,
    });

  if (notificationError) {
    console.error('[createNewClientNotificationAndTask] Erro ao criar notificação ads_new_client_notifications:', {
      code: notificationError.code,
      message: notificationError.message,
      adsManagerId,
      clientId,
    });
    throw notificationError;
  }
}

// Fetch unread new client notifications for the current ads manager
export function useAdsNewClientNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ads-new-client-notifications', user?.id],
    queryFn: async (): Promise<AdsNewClientNotification[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('ads_new_client_notifications')
        .select('*')
        .eq('ads_manager_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AdsNewClientNotification[];
    },
    enabled: !!user?.id,
  });

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`ads-new-client-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ads_new_client_notifications',
          filter: `ads_manager_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as AdsNewClientNotification;

          // Show toast notification
          toast.info(
            `Novo cliente "${notification.client_name}" atribuído a você. Confira em "Novo Cliente".`,
            {
              duration: 8000,
              action: {
                label: 'Ver',
                onClick: () => {
                  // Mark as read
                  supabase
                    .from('ads_new_client_notifications')
                    .update({ read: true, read_at: new Date().toISOString() })
                    .eq('id', notification.id);
                },
              },
            }
          );

          // Invalidate to refresh the list
          queryClient.invalidateQueries({
            queryKey: ['ads-new-client-notifications'],
          });
          queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
          queryClient.invalidateQueries({ queryKey: ['ads-tasks', 'daily'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}
