import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Factory de hooks de completion notifications para boards especializados.
 *
 * Reaproveita lógica idêntica que vivia em 3 arquivos (~255 linhas cada):
 * `useDesignCompletionNotifications`, `useVideoCompletionNotifications`,
 * `useDevsCompletionNotifications`. Produtora usa realtime channel —
 * preserva implementação própria.
 */

export interface KanbanCompletionConfig {
  /** Tabela de notificações (ex: 'design_completion_notifications'). */
  notificationsTable: string;
  /**
   * Tabela de briefings opcional (ex: 'design_briefings').
   * Quando presente, resolve creator do card via briefing antes de cair em
   * `kanban_cards.created_by`. Quando ausente (ex: Produtora), pula direto.
   */
  briefingsTable?: string;
  /** Mensagem do toast (recebe título do card). */
  toastMessage: (cardTitle: string) => string;
  /** Descrição opcional do toast (recebe `completed_by_name`). */
  toastDescription?: (completedByName: string) => string;
  /** Duração do toast em ms (default 10s). */
  toastDuration?: number;
  /** Nome default em `completed_by_name` quando profile não tem nome. */
  defaultCompletedByName: string;
  /** Query keys. */
  queryKeys: {
    notifications: string;
    creator: string;
    multipleCreators: string;
  };
  /**
   * Realtime opcional. Quando presente, `useToasts` usa channel Postgres
   * Changes em vez de polling/useEffect simples.
   */
  realtime?: {
    /** Nome do channel (ex: 'produtora-completion-notifications'). */
    channelName: string;
  };
}

export interface CompletionNotification {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export function createKanbanCompletionHooks(config: KanbanCompletionConfig) {
  function useNotifications() {
    const { user } = useAuth();

    return useQuery({
      queryKey: [config.queryKeys.notifications, user?.id],
      queryFn: async (): Promise<CompletionNotification[]> => {
        if (!user?.id) return [];

        const { data, error } = await sb
          .from(config.notificationsTable)
          .select('*')
          .eq('requester_id', user.id)
          .eq('read', false)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as CompletionNotification[];
      },
      enabled: !!user?.id,
      refetchInterval: 10_000,
    });
  }

  function useMarkRead() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
      mutationFn: async (notificationId: string) => {
        const { error } = await sb
          .from(config.notificationsTable)
          .update({ read: true, read_at: new Date().toISOString() })
          .eq('id', notificationId);
        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [config.queryKeys.notifications, user?.id] });
      },
    });
  }

  function useCreate() {
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

        const { data: profile } = await sb
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .single();

        const { data, error } = await sb
          .from(config.notificationsTable)
          .insert({
            card_id: cardId,
            card_title: cardTitle,
            requester_id: requesterId,
            requester_name: requesterName,
            completed_by: user.id,
            completed_by_name: profile?.name || config.defaultCompletedByName,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [config.queryKeys.notifications] });
      },
    });
  }

  function useToastsPolling() {
    const { data: notifications = [] } = useNotifications();
    const markRead = useMarkRead();
    const shownNotifications = useRef<Set<string>>(new Set());

    useEffect(() => {
      notifications.forEach((notification) => {
        if (shownNotifications.current.has(notification.id)) return;
        shownNotifications.current.add(notification.id);

        const description = config.toastDescription
          ? config.toastDescription(notification.completed_by_name)
          : notification.completed_by_name
            ? `Finalizada por ${notification.completed_by_name}`
            : undefined;

        toast.success(config.toastMessage(notification.card_title), {
          duration: config.toastDuration ?? 10_000,
          description,
          action: {
            label: 'Ok',
            onClick: () => markRead.mutate(notification.id),
          },
          onDismiss: () => markRead.mutate(notification.id),
        });
      });
    }, [notifications, markRead]);
  }

  function useToastsRealtime() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const markRead = useMarkRead();

    useEffect(() => {
      if (!user?.id || !config.realtime) return;

      const channel = sb
        .channel(config.realtime.channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: config.notificationsTable,
            filter: `requester_id=eq.${user.id}`,
          },
          (payload: { new: CompletionNotification }) => {
            const notification = payload.new;

            const description = config.toastDescription
              ? config.toastDescription(notification.completed_by_name)
              : notification.completed_by_name
                ? `Concluída por ${notification.completed_by_name}`
                : undefined;

            toast.success(config.toastMessage(notification.card_title), {
              duration: config.toastDuration ?? 8_000,
              description,
            });

            markRead.mutate(notification.id);
            queryClient.invalidateQueries({ queryKey: [config.queryKeys.notifications] });
          },
        )
        .subscribe();

      return () => {
        sb.removeChannel(channel);
      };
    }, [user?.id, queryClient, markRead]);
  }

  const useToasts = config.realtime ? useToastsRealtime : useToastsPolling;

  function useCardCreator(cardId: string | undefined) {
    return useQuery({
      queryKey: [config.queryKeys.creator, cardId],
      queryFn: async () => {
        if (!cardId) return null;

        let creatorId: string | null = null;

        if (config.briefingsTable) {
          const { data: briefing } = await sb
            .from(config.briefingsTable)
            .select('created_by')
            .eq('card_id', cardId)
            .maybeSingle();
          creatorId = briefing?.created_by ?? null;
        }

        if (!creatorId) {
          const { data: card } = await sb
            .from('kanban_cards')
            .select('created_by')
            .eq('id', cardId)
            .single();
          if (!card?.created_by) return null;
          creatorId = card.created_by;
        }

        const { data: profile } = await sb
          .from('profiles')
          .select('user_id, name')
          .eq('user_id', creatorId)
          .single();
        return profile;
      },
      enabled: !!cardId,
    });
  }

  function useMultipleCardsCreators(cardIds: string[]) {
    return useQuery({
      queryKey: [config.queryKeys.multipleCreators, cardIds.sort().join(',')],
      queryFn: async (): Promise<Record<string, { user_id: string; name: string }>> => {
        if (cardIds.length === 0) return {};

        const userIds = new Set<string>();
        const cardToCreator: Record<string, string> = {};

        if (config.briefingsTable) {
          const { data: briefings } = await sb
            .from(config.briefingsTable)
            .select('card_id, created_by')
            .in('card_id', cardIds);

          for (const briefing of (briefings || []) as { card_id: string; created_by: string | null }[]) {
            if (briefing.created_by) {
              userIds.add(briefing.created_by);
              cardToCreator[briefing.card_id] = briefing.created_by;
            }
          }
        }

        const { data: cards } = await sb
          .from('kanban_cards')
          .select('id, created_by')
          .in('id', cardIds);

        for (const card of (cards || []) as { id: string; created_by: string | null }[]) {
          if (!cardToCreator[card.id] && card.created_by) {
            userIds.add(card.created_by);
            cardToCreator[card.id] = card.created_by;
          }
        }

        if (userIds.size === 0) return {};

        const { data: profiles } = await sb
          .from('profiles')
          .select('user_id, name')
          .in('user_id', Array.from(userIds));

        const profileMap: Record<string, { user_id: string; name: string }> = {};
        for (const p of (profiles || []) as { user_id: string; name: string }[]) {
          profileMap[p.user_id] = p;
        }

        const result: Record<string, { user_id: string; name: string }> = {};
        for (const [cardId, creatorId] of Object.entries(cardToCreator)) {
          if (profileMap[creatorId]) result[cardId] = profileMap[creatorId];
        }
        return result;
      },
      enabled: cardIds.length > 0,
      staleTime: 60_000,
    });
  }

  return {
    useNotifications,
    useMarkRead,
    useCreate,
    useToasts,
    useCardCreator,
    useMultipleCardsCreators,
  };
}
