import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface KanbanBoard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface KanbanColumn {
  id: string;
  board_id: string;
  title: string;
  position: number;
  color: string | null;
}

export interface KanbanCard {
  id: string;
  column_id: string;
  board_id: string;
  // Optional because some boards may have non-client cards
  client_id?: string | null;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string | null;
  progress: number;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  position: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  justification: string | null;
  justification_at: string | null;
  archived?: boolean | null;
  archived_at?: string | null;
  card_type?: string | null;
  // Joined data
  assignee?: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
  client?: {
    id: string;
    name: string;
    created_at: string;
    client_label: string | null;
  } | null;
}

// Fetch single board by slug
export function useBoard(slug: string) {
  return useQuery({
    queryKey: ['board', slug],
    queryFn: async (): Promise<KanbanBoard | null> => {
      const { data, error } = await supabase
        .from('kanban_boards')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });
}

// Fetch columns for a board
export function useBoardColumns(boardId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['columns', boardId],
    queryFn: async (): Promise<KanbanColumn[]> => {
      if (!boardId) return [];
      
      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', boardId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!boardId,
  });

  // Real-time subscription for columns
  useEffect(() => {
    if (!boardId) return;

    const channel = supabase
      .channel(`columns-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kanban_columns',
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['columns', boardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, queryClient]);

  return query;
}

// Fetch cards for a board with real-time updates
export function useBoardCards(boardId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cards', boardId],
    queryFn: async (): Promise<KanbanCard[]> => {
      if (!boardId) return [];
      
      const { data: cards, error } = await supabase
        .from('kanban_cards')
        // Include client label so it can be displayed universally across boards
        .select('*, client:clients(id, name, created_at, client_label)')
        .eq('board_id', boardId)
        .eq('archived', false) // Only fetch non-archived cards
        .order('position', { ascending: true });

      if (error) throw error;
      if (!cards) return [];

      // Fetch assignee profiles
      const assigneeIds = [...new Set(cards.filter((c: any) => c.assigned_to).map((c: any) => c.assigned_to))];
      
      let profiles: Record<string, { id: string; name: string; avatar: string | null }> = {};
      
      if (assigneeIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name, avatar')
          .in('user_id', assigneeIds);
        
        if (profilesData) {
          profiles = profilesData.reduce((acc, p) => ({
            ...acc,
            [p.user_id]: { id: p.user_id, name: p.name, avatar: p.avatar }
          }), {});
        }
      }

      return (cards as any[]).map((card) => ({
        ...card,
        priority: card.priority as 'low' | 'medium' | 'high' | 'urgent',
        assignee: card.assigned_to ? profiles[card.assigned_to] || null : null,
        client: card.client ?? null,
      })) as KanbanCard[];
    },
    enabled: !!boardId,
  });

  // Real-time subscription for cards
  useEffect(() => {
    if (!boardId) return;

    const channel = supabase
      .channel(`cards-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kanban_cards',
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cards', boardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, queryClient]);

  return query;
}

// Create card mutation
export function useCreateCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      board_id: string;
      column_id: string;
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      due_date?: string;
      assigned_to?: string;
      tags?: string[];
      status?: string;
    }) => {
      // Get max position in column
      const { data: existingCards } = await supabase
        .from('kanban_cards')
        .select('position')
        .eq('column_id', data.column_id)
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = existingCards?.[0]?.position ?? -1;

      const { data: card, error } = await supabase
        .from('kanban_cards')
        .insert({
          ...data,
          position: maxPosition + 1,
          created_by: user?.id,
          progress: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity with column info
      if (card && user) {
        // Fetch the column name for "Para" info
        const { data: columnData } = await supabase
          .from('kanban_columns')
          .select('title')
          .eq('id', data.column_id)
          .single();

        await supabase.from('card_activities').insert({
          card_id: card.id,
          user_id: user.id,
          action: 'created',
          details: { 
            title: data.title,
            to: columnData?.title || 'Coluna'
          },
        });
      }

      return card;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards', variables.board_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Update card mutation
export function useUpdateCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      cardId, 
      updates,
      boardId 
    }: { 
      cardId: string; 
      updates: Partial<KanbanCard>;
      boardId: string;
    }) => {
      const { data, error } = await supabase
        .from('kanban_cards')
        .update(updates)
        .eq('id', cardId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      if (data && user) {
        await supabase.from('card_activities').insert({
          card_id: cardId,
          user_id: user.id,
          action: 'updated',
          details: updates,
        });
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards', variables.boardId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Move card mutation (for drag and drop) - supports both column and status changes
// Uses optimistic updates for instant UI feedback
export function useMoveCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cardId,
      sourceColumnId,
      destinationColumnId,
      newPosition,
      boardId,
      sourceStatus,
      destinationStatus,
    }: {
      cardId: string;
      sourceColumnId: string;
      destinationColumnId: string;
      newPosition: number;
      boardId: string;
      sourceStatus?: string;
      destinationStatus?: string;
    }) => {
      // Build update object
      const updateData: { column_id: string; position: number; status?: string } = {
        column_id: destinationColumnId,
        position: newPosition,
      };

      // If destination status is provided, update status as well
      if (destinationStatus) {
        updateData.status = destinationStatus;
      }

      // Update card's column, position and optionally status
      const { error } = await supabase
        .from('kanban_cards')
        .update(updateData)
        .eq('id', cardId);

      if (error) throw error;

      // Reorder other cards in destination column with same status
      const query = supabase
        .from('kanban_cards')
        .select('id, position')
        .eq('column_id', destinationColumnId)
        .neq('id', cardId)
        .order('position', { ascending: true });

      // If working with statuses, only reorder cards with same status
      if (destinationStatus) {
        query.eq('status', destinationStatus);
      }

      const { data: cardsInColumn } = await query;

      if (cardsInColumn) {
        for (let i = 0; i < cardsInColumn.length; i++) {
          const card = cardsInColumn[i];
          const expectedPosition = i >= newPosition ? i + 1 : i;
          if (card.position !== expectedPosition) {
            await supabase
              .from('kanban_cards')
              .update({ position: expectedPosition })
              .eq('id', card.id);
          }
        }
      }

      // Log activity if column or status changed
      const columnChanged = sourceColumnId !== destinationColumnId;
      const statusChanged = sourceStatus && destinationStatus && sourceStatus !== destinationStatus;

      if ((columnChanged || statusChanged) && user) {
        const details: Record<string, string | undefined> = {};

        if (columnChanged) {
          const { data: columns } = await supabase
            .from('kanban_columns')
            .select('id, title')
            .in('id', [sourceColumnId, destinationColumnId]);

          const sourceCol = columns?.find(c => c.id === sourceColumnId);
          const destCol = columns?.find(c => c.id === destinationColumnId);
          details.from_column = sourceCol?.title;
          details.to_column = destCol?.title;
        }

        if (statusChanged) {
          details.from_status = sourceStatus;
          details.to_status = destinationStatus;
        }

        await supabase.from('card_activities').insert({
          card_id: cardId,
          user_id: user.id,
          action: 'moved',
          details,
        });
      }

      return { success: true };
    },
    // Optimistic update - instantly update UI before server responds
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['cards', variables.boardId] });

      // Snapshot previous value
      const previousCards = queryClient.getQueryData<KanbanCard[]>(['cards', variables.boardId]);

      // Optimistically update the cache
      if (previousCards) {
        const updatedCards = previousCards.map(card => {
          if (card.id === variables.cardId) {
            return {
              ...card,
              column_id: variables.destinationColumnId,
              position: variables.newPosition,
              status: variables.destinationStatus ?? card.status,
            };
          }
          return card;
        });

        queryClient.setQueryData(['cards', variables.boardId], updatedCards);
      }

      // Return context with previous value for rollback
      return { previousCards };
    },
    // If mutation fails, rollback to previous state
    onError: (_err, variables, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(['cards', variables.boardId], context.previousCards);
      }
    },
    // Always refetch after error or success
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards', variables.boardId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Delete card mutation
export function useDeleteCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, boardId }: { cardId: string; boardId: string }) => {
      const { error } = await supabase
        .from('kanban_cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards', variables.boardId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Archive card mutation
export function useArchiveCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ cardId, boardId }: { cardId: string; boardId: string }) => {
      const { error } = await supabase
        .from('kanban_cards')
        .update({ 
          archived: true, 
          archived_at: new Date().toISOString() 
        })
        .eq('id', cardId);

      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('card_activities').insert({
          card_id: cardId,
          user_id: user.id,
          action: 'archived',
          details: { archived_at: new Date().toISOString() },
        });
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards', variables.boardId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Restore archived card mutation
export function useRestoreCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ cardId, boardId }: { cardId: string; boardId: string }) => {
      const { error } = await supabase
        .from('kanban_cards')
        .update({ 
          archived: false, 
          archived_at: null 
        })
        .eq('id', cardId);

      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('card_activities').insert({
          card_id: cardId,
          user_id: user.id,
          action: 'restored',
          details: { restored_at: new Date().toISOString() },
        });
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards', variables.boardId] });
      queryClient.invalidateQueries({ queryKey: ['archived-cards', variables.boardId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

// Fetch archived cards for a board
export function useArchivedCards(boardId: string | undefined) {
  return useQuery({
    queryKey: ['archived-cards', boardId],
    queryFn: async (): Promise<KanbanCard[]> => {
      if (!boardId) return [];
      
      const { data: cards, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .eq('board_id', boardId)
        .eq('archived', true)
        .order('archived_at', { ascending: false });

      if (error) throw error;
      return (cards || []).map(card => ({
        ...card,
        priority: card.priority as 'low' | 'medium' | 'high' | 'urgent',
        assignee: null,
      }));
    },
    enabled: !!boardId,
  });
}

// Get all boards
export function useAllBoards() {
  return useQuery({
    queryKey: ['all-boards'],
    queryFn: async (): Promise<KanbanBoard[]> => {
      const { data, error } = await supabase
        .from('kanban_boards')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}
