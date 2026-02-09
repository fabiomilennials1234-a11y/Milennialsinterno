import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isPast, isToday } from 'date-fns';

export interface DesignDelayNotification {
  id: string;
  card_id: string;
  card_title: string;
  designer_id: string;
  designer_name: string;
  due_date: string;
  created_at: string;
}

export interface DesignDelayJustification {
  id: string;
  card_id: string;
  designer_id: string;
  designer_name: string;
  justification: string;
  created_at: string;
  archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
}

// Fetch delayed design cards that need justification (for the designer)
export function useDesignerDelayedCards() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['designer-delayed-cards', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get cards assigned to this designer (by column) that are overdue and not justified
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
        .eq('card_type', 'design')
        .not('due_date', 'is', null);

      if (error) throw error;

      // Get columns to find designer's columns
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

      const designerColumnTitle = `BY ${profile.name.toUpperCase()}`;
      const designerColumn = columns.find(c => c.title === designerColumnTitle);

      if (!designerColumn) return [];

      // Filter cards in designer's column that are overdue
      const overdueCards = (cards || []).filter(card => {
        if (card.column_id !== designerColumn.id) return false;
        if (!card.due_date) return false;
        const dueDate = new Date(card.due_date);
        return isPast(dueDate) && !isToday(dueDate);
      });

      // Check which ones already have justifications
      const cardIds = overdueCards.map(c => c.id);
      if (cardIds.length === 0) return [];

      const { data: existingJustifications } = await supabase
        .from('design_delay_justifications')
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

// Fetch all design delay notifications (for all viewers)
export function useDesignDelayNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['design-delay-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('design_delay_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user's dismissals
      const { data: dismissals } = await supabase
        .from('design_notification_dismissals')
        .select('notification_id')
        .eq('user_id', user?.id || '');

      const dismissedIds = new Set((dismissals || []).map(d => d.notification_id));

      // Filter out dismissed notifications
      return (data || []).filter(n => !dismissedIds.has(n.id)) as DesignDelayNotification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
}

// Fetch justifications for a specific designer
export function useDesignerJustifications(designerName: string | undefined) {
  return useQuery({
    queryKey: ['designer-justifications', designerName],
    queryFn: async () => {
      if (!designerName) return [];

      const { data, error } = await supabase
        .from('design_delay_justifications')
        .select('*')
        .eq('designer_name', designerName)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DesignDelayJustification[];
    },
    enabled: !!designerName,
  });
}

// Create justification
export function useCreateDesignJustification() {
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
        .from('design_delay_justifications')
        .insert({
          card_id: cardId,
          designer_id: user.id,
          designer_name: profile.name,
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
      queryClient.invalidateQueries({ queryKey: ['designer-delayed-cards'] });
      queryClient.invalidateQueries({ queryKey: ['designer-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['design-cards'] });
    },
  });
}

// Dismiss notification
export function useDismissDesignNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('design_notification_dismissals')
        .insert({
          notification_id: notificationId,
          user_id: user.id,
        });

      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-delay-notifications'] });
    },
  });
}

// Create notification for delayed card
export function useCreateDesignDelayNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      cardTitle,
      designerId,
      designerName,
      dueDate,
    }: {
      cardId: string;
      cardTitle: string;
      designerId: string;
      designerName: string;
      dueDate: string;
    }) => {
      // Check if notification already exists for this card
      const { data: existing } = await supabase
        .from('design_delay_notifications')
        .select('id')
        .eq('card_id', cardId)
        .maybeSingle();

      if (existing) return existing;

      const { data, error } = await supabase
        .from('design_delay_notifications')
        .insert({
          card_id: cardId,
          card_title: cardTitle,
          designer_id: designerId,
          designer_name: designerName,
          due_date: dueDate,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-delay-notifications'] });
    },
  });
}
