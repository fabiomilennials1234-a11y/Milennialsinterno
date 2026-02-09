import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

export interface ProdutoraCompletionNotification {
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

// Fetch pending notifications for the current user
export function useProdutoraCompletionNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['produtora-completion-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('produtora_completion_notifications')
        .select('*')
        .eq('requester_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ProdutoraCompletionNotification[];
    },
    enabled: !!user?.id,
  });
}

// Mark notification as read
export function useMarkProdutoraNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('produtora_completion_notifications')
        .update({ 
          read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtora-completion-notifications'] });
    },
  });
}

// Create completion notification
export function useCreateProdutoraCompletionNotification() {
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

      if (!profile) throw new Error('Perfil não encontrado');

      const { data, error } = await supabase
        .from('produtora_completion_notifications')
        .insert({
          card_id: cardId,
          card_title: cardTitle,
          requester_id: requesterId,
          requester_name: requesterName,
          completed_by: user.id,
          completed_by_name: profile.name,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtora-completion-notifications'] });
    },
  });
}

// Get creator info for a card
export function useProdutoraCardCreator(cardId: string | undefined) {
  return useQuery({
    queryKey: ['produtora-card-creator', cardId],
    queryFn: async () => {
      if (!cardId) return null;

      const { data: card, error: cardError } = await supabase
        .from('kanban_cards')
        .select('created_by')
        .eq('id', cardId)
        .single();

      if (cardError || !card?.created_by) return null;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('user_id', card.created_by)
        .single();

      if (profileError) return null;
      return profile;
    },
    enabled: !!cardId,
  });
}

// Get creators for multiple cards
export function useMultipleProdutoraCardsCreators(cardIds: string[]) {
  return useQuery({
    queryKey: ['produtora-cards-creators', cardIds],
    queryFn: async () => {
      if (cardIds.length === 0) return {};

      const { data: cards, error: cardsError } = await supabase
        .from('kanban_cards')
        .select('id, created_by')
        .in('id', cardIds);

      if (cardsError || !cards) return {};

      const creatorIds = [...new Set(cards.map(c => c.created_by).filter(Boolean))] as string[];
      if (creatorIds.length === 0) return {};

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', creatorIds);

      if (profilesError || !profiles) return {};

      const profileMap: Record<string, { user_id: string; name: string }> = {};
      profiles.forEach(p => {
        profileMap[p.user_id] = p;
      });

      const result: Record<string, { user_id: string; name: string }> = {};
      cards.forEach(card => {
        if (card.created_by && profileMap[card.created_by]) {
          result[card.id] = profileMap[card.created_by];
        }
      });

      return result;
    },
    enabled: cardIds.length > 0,
  });
}

// Hook to listen for real-time completion notifications and show toasts
export function useProdutoraCompletionToasts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const markAsRead = useMarkProdutoraNotificationAsRead();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('produtora-completion-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'produtora_completion_notifications',
          filter: `requester_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as ProdutoraCompletionNotification;
          
          // Show toast
          toast.success(
            `🎬 Sua demanda "${notification.card_title}" foi gravada!`,
            {
              description: `Concluída por ${notification.completed_by_name}`,
              duration: 8000,
            }
          );

          // Mark as read automatically after showing toast
          markAsRead.mutate(notification.id);

          // Refresh notifications list
          queryClient.invalidateQueries({ queryKey: ['produtora-completion-notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, markAsRead]);
}
