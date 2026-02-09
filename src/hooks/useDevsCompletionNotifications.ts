import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export interface DevCompletionNotification {
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

// Fetch unread completion notifications for the current user
export function useDevCompletionNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dev-completion-notifications', user?.id],
    queryFn: async (): Promise<DevCompletionNotification[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('dev_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DevCompletionNotification[];
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

// Mark notification as read
export function useMarkDevNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('dev_completion_notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-completion-notifications', user?.id] });
    },
  });
}

// Create completion notification
export function useCreateDevCompletionNotification() {
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

      // Get current user's profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const completedByName = profile?.name || 'Desenvolvedor';

      const { data, error } = await supabase
        .from('dev_completion_notifications')
        .insert({
          card_id: cardId,
          card_title: cardTitle,
          requester_id: requesterId,
          requester_name: requesterName,
          completed_by: user.id,
          completed_by_name: completedByName,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-completion-notifications'] });
    },
  });
}

// Hook to show toast notifications for completed dev requests
export function useDevCompletionToasts() {
  const { data: notifications = [] } = useDevCompletionNotifications();
  const markRead = useMarkDevNotificationRead();
  const shownNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    notifications.forEach((notification) => {
      // Skip if already shown
      if (shownNotifications.current.has(notification.id)) {
        return;
      }

      // Mark as shown
      shownNotifications.current.add(notification.id);

      toast.success(
        `Sua demanda de desenvolvimento "${notification.card_title}" está pronta!`,
        {
          duration: 10000,
          description: `Finalizada por ${notification.completed_by_name}`,
          action: {
            label: 'OK',
            onClick: () => {
              markRead.mutate(notification.id);
            },
          },
          onDismiss: () => {
            markRead.mutate(notification.id);
          },
        }
      );
    });
  }, [notifications, markRead]);
}

// Fetch creator info for a card (from dev_briefings or kanban_cards)
export function useDevCardCreatorInfo(cardId: string | undefined) {
  return useQuery({
    queryKey: ['dev-card-creator', cardId],
    queryFn: async () => {
      if (!cardId) return null;

      // First try to get from dev_briefings
      const { data: briefing } = await supabase
        .from('dev_briefings')
        .select('created_by')
        .eq('card_id', cardId)
        .maybeSingle();

      const creatorId = briefing?.created_by;

      if (creatorId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, name')
          .eq('user_id', creatorId)
          .single();

        if (profile) return profile;
      }

      // Fallback to card creator
      const { data: card } = await supabase
        .from('kanban_cards')
        .select('created_by')
        .eq('id', cardId)
        .single();

      if (card?.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, name')
          .eq('user_id', card.created_by)
          .single();

        return profile || null;
      }

      return null;
    },
    enabled: !!cardId,
  });
}

// Fetch creators for multiple cards
export function useMultipleDevCardsCreators(cardIds: string[]) {
  return useQuery({
    queryKey: ['multiple-dev-cards-creators', cardIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, { user_id: string; name: string }>> => {
      if (cardIds.length === 0) return {};

      // Get briefings for all cards
      const { data: briefings } = await supabase
        .from('dev_briefings')
        .select('card_id, created_by')
        .in('card_id', cardIds);

      // Get cards for fallback
      const { data: cards } = await supabase
        .from('kanban_cards')
        .select('id, created_by')
        .in('id', cardIds);

      // Collect all creator IDs
      const creatorIds = new Set<string>();
      briefings?.forEach(b => b.created_by && creatorIds.add(b.created_by));
      cards?.forEach(c => c.created_by && creatorIds.add(c.created_by));

      if (creatorIds.size === 0) return {};

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', Array.from(creatorIds));

      const profileMap = new Map(
        profiles?.map(p => [p.user_id, p]) || []
      );

      // Build result
      const result: Record<string, { user_id: string; name: string }> = {};

      cardIds.forEach(cardId => {
        const briefing = briefings?.find(b => b.card_id === cardId);
        const card = cards?.find(c => c.id === cardId);
        const creatorId = briefing?.created_by || card?.created_by;

        if (creatorId && profileMap.has(creatorId)) {
          result[cardId] = profileMap.get(creatorId)!;
        }
      });

      return result;
    },
    enabled: cardIds.length > 0,
    staleTime: 60000,
  });
}
