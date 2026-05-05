import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isPast, isToday } from 'date-fns';

/**
 * Factory de hooks de delay/justificativa para boards especializados.
 *
 * Reaproveita a lógica idêntica que vivia em 4 arquivos (~278 linhas cada):
 * `useDesignDelayNotifications`, `useVideoDelayNotifications`,
 * `useDevsDelayNotifications`, `useProdutoraDelayNotifications`.
 *
 * Cada board injeta seu config de tabelas/colunas e query keys; lógica de
 * filtragem (overdue, dismissals, justified) é idêntica.
 */

export interface KanbanDelayConfig {
  /** Valor de `kanban_cards.card_type` (ex: 'design', 'video', 'dev', 'produtora'). */
  cardType: string;
  /** Tabela de justificativas (ex: 'design_delay_justifications'). */
  justificationsTable: string;
  /** Tabela de notificações (ex: 'design_delay_notifications'). */
  notificationsTable: string;
  /** Tabela de dismissals (ex: 'design_notification_dismissals'). */
  dismissalsTable: string;
  /** Nome da coluna FK do "responsável" (ex: 'designer_id', 'editor_id'). */
  personIdCol: string;
  /** Nome da coluna do nome do "responsável" (ex: 'designer_name'). */
  personNameCol: string;
  /** Query keys usadas em invalidate/cache. */
  queryKeys: {
    /** Cards atrasados (lista local pra justificativa). */
    delayed: string;
    /** Notificações de atraso (broadcast). */
    notifications: string;
    /** Lista de justificativas por pessoa. */
    justifications: string;
    /** Cards do board (para invalidar após criar justificativa). */
    boardCards: string;
  };
}

export interface DelayNotificationRow {
  id: string;
  card_id: string;
  card_title: string;
  due_date: string;
  created_at: string;
  [key: string]: unknown;
}

export interface DelayJustificationRow {
  id: string;
  card_id: string;
  justification: string;
  created_at: string;
  archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  [key: string]: unknown;
}

interface CardLite {
  id: string;
  title: string;
  due_date: string | null;
  column_id: string;
  status: string | null;
  board_id: string;
}

interface ColumnLite {
  id: string;
  title: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export function createKanbanDelayHooks(config: KanbanDelayConfig) {
  function useDelayedCards() {
    const { user } = useAuth();

    return useQuery({
      queryKey: [config.queryKeys.delayed, user?.id],
      queryFn: async () => {
        if (!user?.id) return [];

        const { data: cards, error } = await sb
          .from('kanban_cards')
          .select('id, title, due_date, column_id, status, board_id')
          .eq('archived', false)
          .eq('card_type', config.cardType)
          .not('due_date', 'is', null);
        if (error) throw error;

        const { data: columns } = await sb
          .from('kanban_columns')
          .select('id, title');

        const { data: profile } = await sb
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .single();

        if (!profile || !columns) return [];

        const personColumnTitle = `BY ${profile.name.toUpperCase()}`;
        const personColumn = (columns as ColumnLite[]).find(c => c.title === personColumnTitle);
        if (!personColumn) return [];

        const overdueCards = ((cards || []) as CardLite[]).filter(card => {
          if (card.column_id !== personColumn.id) return false;
          if (!card.due_date) return false;
          const dueDate = new Date(card.due_date);
          return isPast(dueDate) && !isToday(dueDate);
        });

        const cardIds = overdueCards.map(c => c.id);
        if (cardIds.length === 0) return [];

        const { data: existingJustifications } = await sb
          .from(config.justificationsTable)
          .select('card_id')
          .in('card_id', cardIds);

        const justifiedCardIds = new Set(
          ((existingJustifications || []) as { card_id: string }[]).map(j => j.card_id),
        );

        return overdueCards.filter(card => !justifiedCardIds.has(card.id));
      },
      enabled: !!user?.id,
      refetchInterval: 300_000,
      initialData: [],
    });
  }

  function useDelayNotifications() {
    const { user } = useAuth();

    return useQuery({
      queryKey: [config.queryKeys.notifications],
      queryFn: async () => {
        const { data, error } = await sb
          .from(config.notificationsTable)
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;

        const { data: dismissals } = await sb
          .from(config.dismissalsTable)
          .select('notification_id')
          .eq('user_id', user?.id || '');

        const dismissedIds = new Set(
          ((dismissals || []) as { notification_id: string }[]).map(d => d.notification_id),
        );

        return ((data || []) as DelayNotificationRow[]).filter(n => !dismissedIds.has(n.id));
      },
      enabled: !!user?.id,
      refetchInterval: 300_000,
    });
  }

  function useJustifications(personName: string | undefined) {
    return useQuery({
      queryKey: [config.queryKeys.justifications, personName],
      queryFn: async () => {
        if (!personName) return [];
        const { data, error } = await sb
          .from(config.justificationsTable)
          .select('*')
          .eq(config.personNameCol, personName)
          .eq('archived', false)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as DelayJustificationRow[];
      },
      enabled: !!personName,
    });
  }

  function useCreateJustification() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
      mutationFn: async ({
        cardId,
        justification,
      }: {
        cardId: string;
        justification: string;
      }) => {
        if (!user) throw new Error('Usuário não autenticado');

        const { data: profile } = await sb
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .single();
        if (!profile) throw new Error('Perfil não encontrado');

        const insertPayload: Record<string, unknown> = {
          card_id: cardId,
          [config.personIdCol]: user.id,
          [config.personNameCol]: profile.name,
          justification,
        };

        const { data, error } = await sb
          .from(config.justificationsTable)
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;

        await sb
          .from('kanban_cards')
          .update({
            justification,
            justification_at: new Date().toISOString(),
          })
          .eq('id', cardId);

        return data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [config.queryKeys.delayed] });
        queryClient.invalidateQueries({ queryKey: [config.queryKeys.justifications] });
        queryClient.invalidateQueries({ queryKey: [config.queryKeys.boardCards] });
      },
    });
  }

  function useDismissNotification() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
      mutationFn: async (notificationId: string) => {
        if (!user) throw new Error('Usuário não autenticado');
        const { error } = await sb
          .from(config.dismissalsTable)
          .insert({
            notification_id: notificationId,
            user_id: user.id,
          });
        if (error && !error.message.includes('duplicate')) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [config.queryKeys.notifications] });
      },
    });
  }

  function useCreateDelayNotification() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        cardId,
        cardTitle,
        personId,
        personName,
        dueDate,
      }: {
        cardId: string;
        cardTitle: string;
        personId: string;
        personName: string;
        dueDate: string;
      }) => {
        const { data: existing } = await sb
          .from(config.notificationsTable)
          .select('id')
          .eq('card_id', cardId)
          .maybeSingle();
        if (existing) return existing;

        const insertPayload: Record<string, unknown> = {
          card_id: cardId,
          card_title: cardTitle,
          [config.personIdCol]: personId,
          [config.personNameCol]: personName,
          due_date: dueDate,
        };

        const { data, error } = await sb
          .from(config.notificationsTable)
          .insert(insertPayload)
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

  return {
    useDelayedCards,
    useDelayNotifications,
    useJustifications,
    useCreateJustification,
    useDismissNotification,
    useCreateDelayNotification,
  };
}
