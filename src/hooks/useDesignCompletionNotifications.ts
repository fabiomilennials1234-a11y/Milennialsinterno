import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export interface DesignCompletionNotification {
  id: string;
  card_id: string;
  card_title: string;
  requester_id: string;
  requester_name: string;
  completed_by: string;
  completed_by_name: string;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

// Fetch unread notifications for the current user
export function useDesignCompletionNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['design-completion-notifications', user?.id],
    queryFn: async (): Promise<DesignCompletionNotification[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('design_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DesignCompletionNotification[];
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Check every 10 seconds for faster notifications
  });
}

// Mark notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('design_completion_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-completion-notifications', user?.id] });
    },
  });
}

// Create a completion notification
export function useCreateCompletionNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      cardTitle,
      requesterId,
      requesterName,
    }: {
      cardId: string;
      cardTitle: string;
      requesterId: string;
      requesterName: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Get current user's name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const { data, error } = await supabase
        .from('design_completion_notifications')
        .insert({
          card_id: cardId,
          card_title: cardTitle,
          requester_id: requesterId,
          requester_name: requesterName,
          completed_by: user.id,
          completed_by_name: profile?.name || 'Designer',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-completion-notifications'] });
    },
  });
}

// Hook to show toast notifications for new completions
export function useDesignCompletionToasts() {
  const { data: notifications = [] } = useDesignCompletionNotifications();
  const markRead = useMarkNotificationRead();
  const shownNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    notifications.forEach((notification) => {
      // Skip if we've already shown this notification
      if (shownNotifications.current.has(notification.id)) {
        return;
      }
      
      // Mark as shown
      shownNotifications.current.add(notification.id);
      
      toast.success(
        `A sua demanda "${notification.card_title}" em design está pronta!`,
        {
          duration: 10000,
          action: {
            label: 'Ok',
            onClick: () => markRead.mutate(notification.id),
          },
          onDismiss: () => markRead.mutate(notification.id),
        }
      );
    });
  }, [notifications]);
}

// Fetch card creator info
export function useCardCreatorInfo(cardId: string | undefined) {
  return useQuery({
    queryKey: ['card-creator', cardId],
    queryFn: async () => {
      if (!cardId) return null;

      // First try to get from design_briefings (who created the briefing)
      const { data: briefing } = await supabase
        .from('design_briefings')
        .select('created_by')
        .eq('card_id', cardId)
        .maybeSingle();

      const creatorId = briefing?.created_by;

      if (!creatorId) {
        // Fallback to card created_by
        const { data: card } = await supabase
          .from('kanban_cards')
          .select('created_by')
          .eq('id', cardId)
          .single();

        if (!card?.created_by) return null;

        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, name')
          .eq('user_id', card.created_by)
          .single();

        return profile;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('user_id', creatorId)
        .single();

      return profile;
    },
    enabled: !!cardId,
  });
}

// Fetch creators for multiple cards at once
export function useMultipleCardsCreators(cardIds: string[]) {
  return useQuery({
    queryKey: ['multiple-cards-creators', cardIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, { user_id: string; name: string }>> => {
      if (cardIds.length === 0) return {};

      // Get briefings
      const { data: briefings } = await supabase
        .from('design_briefings')
        .select('card_id, created_by')
        .in('card_id', cardIds);

      // Get cards for fallback
      const { data: cards } = await supabase
        .from('kanban_cards')
        .select('id, created_by')
        .in('id', cardIds);

      // Collect all user IDs
      const userIds = new Set<string>();
      const cardToCreator: Record<string, string> = {};

      // Prefer briefing creator
      for (const briefing of (briefings || [])) {
        if (briefing.created_by) {
          userIds.add(briefing.created_by);
          cardToCreator[briefing.card_id] = briefing.created_by;
        }
      }

      // Fallback to card creator
      for (const card of (cards || [])) {
        if (!cardToCreator[card.id] && card.created_by) {
          userIds.add(card.created_by);
          cardToCreator[card.id] = card.created_by;
        }
      }

      if (userIds.size === 0) return {};

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', Array.from(userIds));

      const profileMap: Record<string, { user_id: string; name: string }> = {};
      for (const profile of (profiles || [])) {
        profileMap[profile.user_id] = profile;
      }

      // Map cards to creator profiles
      const result: Record<string, { user_id: string; name: string }> = {};
      for (const [cardId, creatorId] of Object.entries(cardToCreator)) {
        if (profileMap[creatorId]) {
          result[cardId] = profileMap[creatorId];
        }
      }

      return result;
    },
    enabled: cardIds.length > 0,
    staleTime: 60000, // 1 minute
  });
}
