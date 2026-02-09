import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isPast, isToday } from 'date-fns';

export interface VideoDelayNotification {
  id: string;
  card_id: string;
  card_title: string;
  editor_id: string;
  editor_name: string;
  due_date: string;
  created_at: string;
}

export interface VideoDelayJustification {
  id: string;
  card_id: string;
  editor_id: string;
  editor_name: string;
  justification: string;
  created_at: string;
  archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
}

// Fetch delayed video cards that need justification (for the editor)
export function useEditorDelayedCards() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['editor-delayed-cards', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get cards assigned to this editor (by column) that are overdue and not justified
      const { data: cards, error } = await supabase
        .from('kanban_cards')
        .select(`
          id,
          title,
          due_date,
          column_id,
          status,
          board_id
        `)
        .eq('archived', false)
        .eq('card_type', 'video')
        .not('due_date', 'is', null);

      if (error) throw error;

      // Get columns to find editor's columns
      const { data: columns } = await supabase
        .from('kanban_columns')
        .select('id, title');

      // Get user's profile to match column
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      if (!profile || !columns) return [];

      const editorColumnTitle = `BY ${profile.name.toUpperCase()}`;
      const editorColumn = columns.find(c => c.title === editorColumnTitle);

      if (!editorColumn) return [];

      // Filter cards in editor's column that are overdue
      const overdueCards = (cards || []).filter(card => {
        if (card.column_id !== editorColumn.id) return false;
        if (!card.due_date) return false;
        const dueDate = new Date(card.due_date);
        return isPast(dueDate) && !isToday(dueDate);
      });

      // Check which ones already have justifications
      const cardIds = overdueCards.map(c => c.id);
      if (cardIds.length === 0) return [];

      const { data: existingJustifications } = await supabase
        .from('video_delay_justifications')
        .select('card_id')
        .in('card_id', cardIds);

      const justifiedCardIds = new Set((existingJustifications || []).map(j => j.card_id));

      // Return only cards without justification
      return overdueCards.filter(card => !justifiedCardIds.has(card.id));
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Check every 30 seconds
  });
}

// Fetch all video delay notifications (for all viewers)
export function useVideoDelayNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['video-delay-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_delay_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user's dismissals
      const { data: dismissals } = await supabase
        .from('video_notification_dismissals')
        .select('notification_id')
        .eq('user_id', user?.id || '');

      const dismissedIds = new Set((dismissals || []).map(d => d.notification_id));

      // Filter out dismissed notifications
      return (data || []).filter(n => !dismissedIds.has(n.id)) as VideoDelayNotification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
}

// Fetch justifications for a specific editor
export function useEditorJustifications(editorName: string | undefined) {
  return useQuery({
    queryKey: ['editor-justifications', editorName],
    queryFn: async () => {
      if (!editorName) return [];

      const { data, error } = await supabase
        .from('video_delay_justifications')
        .select('*')
        .eq('editor_name', editorName)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as VideoDelayJustification[];
    },
    enabled: !!editorName,
  });
}

// Create justification
export function useCreateVideoJustification() {
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

      // Get user's profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      const { data, error } = await supabase
        .from('video_delay_justifications')
        .insert({
          card_id: cardId,
          editor_id: user.id,
          editor_name: profile.name,
          justification,
        })
        .select()
        .single();

      if (error) throw error;

      // Also update the card with justification info
      await supabase
        .from('kanban_cards')
        .update({
          justification,
          justification_at: new Date().toISOString(),
        })
        .eq('id', cardId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editor-delayed-cards'] });
      queryClient.invalidateQueries({ queryKey: ['editor-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['video-cards'] });
    },
  });
}

// Dismiss notification
export function useDismissVideoNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('video_notification_dismissals')
        .insert({
          notification_id: notificationId,
          user_id: user.id,
        });

      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-delay-notifications'] });
    },
  });
}

// Create notification for delayed card
export function useCreateVideoDelayNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      cardTitle,
      editorId,
      editorName,
      dueDate,
    }: {
      cardId: string;
      cardTitle: string;
      editorId: string;
      editorName: string;
      dueDate: string;
    }) => {
      // Check if notification already exists for this card
      const { data: existing } = await supabase
        .from('video_delay_notifications')
        .select('id')
        .eq('card_id', cardId)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from('video_delay_notifications')
        .insert({
          card_id: cardId,
          card_title: cardTitle,
          editor_id: editorId,
          editor_name: editorName,
          due_date: dueDate,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-delay-notifications'] });
    },
  });
}
