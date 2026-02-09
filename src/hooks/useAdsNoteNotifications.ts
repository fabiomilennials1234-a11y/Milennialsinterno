import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AdsNoteNotification {
  id: string;
  ads_manager_id: string;
  client_id: string;
  client_name: string;
  note_id: string;
  note_content: string;
  created_by: string;
  created_by_name: string;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

// Fetch unread notifications for the current ads manager
export function useAdsNoteNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ads-note-notifications', user?.id],
    queryFn: async (): Promise<AdsNoteNotification[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('ads_note_notifications')
        .select('*')
        .eq('ads_manager_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AdsNoteNotification[];
    },
    enabled: !!user?.id,
  });

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`ads-note-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ads_note_notifications',
          filter: `ads_manager_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as AdsNoteNotification;
          
          // Show toast notification
          toast.info(
            `Você possui uma nova anotação no/na ${notification.client_name}, leia ela em "Tarefas diárias".`,
            {
              duration: 8000,
              action: {
                label: 'Ver',
                onClick: () => {
                  // Mark as read
                  supabase
                    .from('ads_note_notifications')
                    .update({ read: true, read_at: new Date().toISOString() })
                    .eq('id', notification.id);
                },
              },
            }
          );

          // Invalidate to refresh the list
          queryClient.invalidateQueries({ queryKey: ['ads-note-notifications'] });
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

// Mark notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('ads_note_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-note-notifications'] });
    },
  });
}

// Create notification and task when a note is added
export async function createNoteNotificationAndTask({
  clientId,
  clientName,
  adsManagerId,
  noteId,
  noteContent,
  createdBy,
  createdByName,
}: {
  clientId: string;
  clientName: string;
  adsManagerId: string;
  noteId: string;
  noteContent: string;
  createdBy: string;
  createdByName: string;
}) {
  // Truncate content if too long for task title
  const truncatedContent = noteContent.length > 80 
    ? noteContent.substring(0, 80) + '...' 
    : noteContent;

  // 1. Create the task in ads_tasks
  const { error: taskError } = await supabase
    .from('ads_tasks')
    .insert({
      ads_manager_id: adsManagerId,
      title: `Nova Anotação (${truncatedContent})`,
      description: `Anotação adicionada por ${createdByName} no cliente ${clientName}:\n\n${noteContent}`,
      task_type: 'daily',
      status: 'todo',
      priority: 'high',
    });

  if (taskError) {
    console.error('Error creating task:', taskError);
    throw taskError;
  }

  // 2. Create the notification
  const { error: notificationError } = await supabase
    .from('ads_note_notifications')
    .insert({
      ads_manager_id: adsManagerId,
      client_id: clientId,
      client_name: clientName,
      note_id: noteId,
      note_content: noteContent,
      created_by: createdBy,
      created_by_name: createdByName,
    });

  if (notificationError) {
    console.error('Error creating notification:', notificationError);
    throw notificationError;
  }
}
