import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, User, ChevronDown, ChevronRight, MoreHorizontal, Archive, Trash2, Calendar, AlertTriangle, FileText, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateDevCardModal from '@/components/kanban/CreateDevCardModal';
import CardDetailModal from '@/components/kanban/CardDetailModal';
import DevsDelayModal from '@/components/devs/DevsDelayModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  canCreateDevCard,
  canArchiveDevCard,
  canMoveDevCard,
} from '@/hooks/useDevsKanban';
import { 
  useDevDelayedCards,
  useDevJustifications,
} from '@/hooks/useDevsDelayNotifications';
import { 
  useMultipleDevCardsCreators,
  useCreateDevCompletionNotification,
} from '@/hooks/useDevsCompletionNotifications';
import { KanbanCard } from '@/hooks/useKanban';

interface Dev {
  user_id: string;
  name: string;
  squad_id: string | null;
}

interface DevColumn {
  id: string;
  title: string;
  position: number;
  board_id: string;
  color: string | null;
}

// Internal statuses for each dev column
const CARD_STATUSES = [
  { id: 'a_fazer', label: 'A FAZER', color: 'bg-blue-500' },
  { id: 'fazendo', label: 'FAZENDO', color: 'bg-orange-500' },
  { id: 'alteracao', label: 'ALTERAÇÃO', color: 'bg-red-500' },
  { id: 'aguardando_aprovacao', label: 'AGUARDANDO APROVAÇÃO', color: 'bg-purple-500' },
  { id: 'aprovados', label: 'APROVADOS', color: 'bg-green-500' },
] as const;

export default function DevsKanbanBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);

  // Fetch delayed cards for this dev
  const { data: delayedCards = [] } = useDevDelayedCards();

  // Create completion notification mutation
  const createCompletionNotification = useCreateDevCompletionNotification();

  // Show delay modal if there are delayed cards
  useEffect(() => {
    if (delayedCards.length > 0 && user?.role === 'devs') {
      setIsDelayModalOpen(true);
    }
  }, [delayedCards.length, user?.role]);

  // Get user's squad
  const userSquadId = user?.squad_id;

  // Fetch dev board for the squad
  const { data: board, isLoading: isBoardLoading } = useQuery({
    queryKey: ['dev-board', userSquadId],
    queryFn: async () => {
      if (!userSquadId) {
        // Fallback: get the first dev board
        const { data, error } = await supabase
          .from('kanban_boards')
          .select('*')
          .ilike('slug', '%dev%')
          .limit(1)
          .maybeSingle();
        
        if (error) throw error;
        return data;
      }

      // Try to get squad-specific board
      const { data, error } = await supabase
        .from('kanban_boards')
        .select('*')
        .eq('squad_id', userSquadId)
        .ilike('slug', '%dev%')
        .maybeSingle();

      if (error) throw error;
      
      // Fallback to any dev board
      if (!data) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('kanban_boards')
          .select('*')
          .ilike('slug', '%dev%')
          .limit(1)
          .maybeSingle();
        
        if (fallbackError) throw fallbackError;
        return fallback;
      }

      return data;
    },
  });

  // Fetch devs in the squad (only those with devs role)
  const { data: devs = [], isLoading: isDevsLoading } = useQuery({
    queryKey: ['squad-devs', userSquadId],
    queryFn: async () => {
      // Get all devs from user_roles
      const { data: allDevs, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'devs');

      if (error) throw error;

      const devIds = allDevs?.map(d => d.user_id) || [];
      
      if (devIds.length === 0) return [];

      // Get profiles for devs
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, squad_id')
        .in('user_id', devIds);

      if (profileError) throw profileError;

      // Filter by squad if user has one
      if (userSquadId) {
        return (profiles || []).filter(p => p.squad_id === userSquadId) as Dev[];
      }

      return (profiles || []) as Dev[];
    },
  });

  // Fetch columns for the board
  const { data: columns = [], isLoading: isColumnsLoading } = useQuery({
    queryKey: ['dev-columns', board?.id],
    queryFn: async () => {
      if (!board?.id) return [];

      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as DevColumn[];
    },
    enabled: !!board?.id,
  });

  // Fetch cards for the board
  const { data: cards = [] } = useQuery({
    queryKey: ['dev-cards', board?.id],
    queryFn: async () => {
      if (!board?.id) return [];

      const { data, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .eq('board_id', board.id)
        .eq('archived', false)
        .order('position', { ascending: true });

      if (error) throw error;
      
      return (data || []) as KanbanCard[];
    },
    enabled: !!board?.id,
  });

  // Fetch creators for all cards
  const cardIds = cards.map(c => c.id);
  const { data: cardCreators = {} } = useMultipleDevCardsCreators(cardIds);

  const ensureColumnsMutation = useMutation({
    mutationFn: async () => {
      if (!board?.id) return;
      
      // CRITICAL: Never run if devs list is empty - prevents race conditions
      if (devs.length === 0) {
        console.log('Skipping column sync - no devs loaded yet');
        return;
      }

      // Re-fetch columns to get the most up-to-date list
      const { data: currentColumns } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id);
      
      const existingTitles = (currentColumns || []).map(c => c.title);
      let position = (currentColumns || []).length;

      // Create dev columns and justification columns
      for (const dev of devs) {
        const columnTitle = `BY ${dev.name.toUpperCase()}`;
        const justificationTitle = `JUSTIFICATIVA (${dev.name.toUpperCase()})`;

        // Create BY column
        if (!existingTitles.includes(columnTitle)) {
          const { data: existingCol } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('board_id', board.id)
            .eq('title', columnTitle)
            .maybeSingle();
          
          if (!existingCol) {
            await supabase
              .from('kanban_columns')
              .insert({
                board_id: board.id,
                title: columnTitle,
                position: position++,
                color: '#3b82f6', // Blue for devs
              });
          }
        }

        // Create Justification column
        if (!existingTitles.includes(justificationTitle)) {
          const { data: existingJustCol } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('board_id', board.id)
            .eq('title', justificationTitle)
            .maybeSingle();
          
          if (!existingJustCol) {
            await supabase
              .from('kanban_columns')
              .insert({
                board_id: board.id,
                title: justificationTitle,
                position: position++,
                color: '#ef4444',
              });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-columns', board?.id] });
    },
  });

  // Track sync state
  const [syncKey, setSyncKey] = useState('');

  // Auto-create columns when devs change
  useEffect(() => {
    if (devs.length === 0) return;
    
    const newSyncKey = `${board?.id}-${devs.map(d => d.user_id).sort().join(',')}`;
    if (board?.id && newSyncKey !== syncKey && !ensureColumnsMutation.isPending) {
      setSyncKey(newSyncKey);
      ensureColumnsMutation.mutate();
    }
  }, [board?.id, devs]);

  // Move card mutation with optimistic update
  const moveCardMutation = useMutation({
    mutationFn: async ({ cardId, columnId, status, position }: { cardId: string; columnId: string; status?: string; position: number }) => {
      const updateData: Record<string, unknown> = { 
        column_id: columnId, 
        position, 
        updated_at: new Date().toISOString() 
      };
      
      if (status) {
        updateData.status = status;
      }

      const { error } = await supabase
        .from('kanban_cards')
        .update(updateData)
        .eq('id', cardId);

      if (error) throw error;
    },
    onMutate: async ({ cardId, columnId, status, position }) => {
      await queryClient.cancelQueries({ queryKey: ['dev-cards', board?.id] });
      
      const previousCards = queryClient.getQueryData<KanbanCard[]>(['dev-cards', board?.id]);
      
      queryClient.setQueryData<KanbanCard[]>(['dev-cards', board?.id], (old) => {
        if (!old) return old;
        return old.map(card => 
          card.id === cardId 
            ? { ...card, column_id: columnId, status: status || card.status, position }
            : card
        );
      });
      
      return { previousCards };
    },
    onError: (err, variables, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(['dev-cards', board?.id], context.previousCards);
      }
      toast.error('Erro ao mover card');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-cards', board?.id] });
    },
  });

  // Archive card mutation
  const archiveCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from('kanban_cards')
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq('id', cardId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-cards', board?.id] });
      toast.success('Card arquivado com sucesso');
    },
  });

  // Delete card mutation
  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from('kanban_cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dev-cards', board?.id] });
      toast.success('Card excluído com sucesso');
    },
  });

  // Create card mutation
  const createCardMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      priority?: 'normal' | 'urgent';
      due_date?: string;
      column_id?: string;
      status?: string;
      materials_url?: string;
      attachments?: { file: File; name: string; size: number; type: string }[];
    }) => {
      if (!board?.id || !data.column_id) throw new Error('Board ou coluna não encontrados');

       const sanitizeFileName = (name: string) => {
         // Remove accents/diacritics and disallow characters that can break storage object keys.
         const noDiacritics = name
           .normalize('NFKD')
           .replace(/[\u0300-\u036f]/g, '');

         // Keep only safe characters and collapse whitespace.
         const safe = noDiacritics
           .trim()
           .replace(/\s+/g, '_')
           .replace(/[^a-zA-Z0-9._-]/g, '_')
           .replace(/_+/g, '_');

         return safe.length > 0 ? safe : 'file';
       };

      // Get max position in column
      const columnCards = cards.filter(c => c.column_id === data.column_id);
      const maxPosition = columnCards.length > 0 
        ? Math.max(...columnCards.map(c => c.position)) + 1 
        : 0;

      const { data: newCard, error } = await supabase
        .from('kanban_cards')
        .insert({
          board_id: board.id,
          column_id: data.column_id,
          title: data.title,
          description: data.description || null,
          priority: data.priority || 'normal',
          due_date: data.due_date || null,
          position: maxPosition,
          created_by: user?.id,
          card_type: 'dev',
          status: data.status || 'a_fazer',
        })
        .select()
        .single();

      if (error) throw error;

      // Create briefing with materials_url if provided
      if (newCard && data.materials_url) {
        await supabase
          .from('dev_briefings')
          .insert({
            card_id: newCard.id,
            materials_url: data.materials_url || null,
            created_by: user?.id,
          });
      }

      // Upload attachments if provided
      if (data.attachments && data.attachments.length > 0 && newCard) {
        console.log('Starting upload of', data.attachments.length, 'attachments for card', newCard.id);
        
        for (const attachment of data.attachments) {
          try {
            const safeName = sanitizeFileName(attachment.name);
            const filePath = `${newCard.id}/${Date.now()}_${safeName}`;
            console.log('Uploading file:', attachment.name, 'to path:', filePath);
            
            const { error: uploadError, data: uploadData } = await supabase.storage
              .from('card-attachments')
              .upload(filePath, attachment.file, {
                upsert: false,
                contentType: attachment.type || undefined,
              });
            
            if (uploadError) {
              console.error('Error uploading attachment:', uploadError);
              continue;
            }
            
            console.log('Upload successful, getting public URL');
            const { data: publicUrlData } = supabase.storage
              .from('card-attachments')
              .getPublicUrl(filePath);
            
            console.log('Public URL:', publicUrlData.publicUrl);
            
            const { error: insertError } = await supabase
              .from('card_attachments')
              .insert({
                card_id: newCard.id,
                file_name: attachment.name,
                file_url: publicUrlData.publicUrl,
                file_type: attachment.type,
                file_size: attachment.size,
                created_by: user?.id,
              });
              
            if (insertError) {
              console.error('Error inserting attachment record:', insertError);
            } else {
              console.log('Attachment record inserted successfully');
            }
          } catch (err) {
            console.error('Exception during attachment upload:', err);
          }
        }
      } else {
        console.log('No attachments to upload. data.attachments:', data.attachments?.length || 0);
      }

      return newCard;
    },
    onSuccess: (newCard) => {
      queryClient.invalidateQueries({ queryKey: ['dev-cards', board?.id] });
      // Also invalidate card attachments for the new card
      if (newCard) {
        queryClient.invalidateQueries({ queryKey: ['card-attachments', newCard.id] });
      }
      toast.success('Demanda de desenvolvimento criada com sucesso');
      setIsCreateModalOpen(false);
      setSelectedColumnId(null);
      setIsCreating(false);
    },
    onError: (error) => {
      console.error('Error creating card:', error);
      toast.error('Erro ao criar demanda');
      setIsCreating(false);
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (!canMoveDevCard(user?.role || null)) {
      toast.error('Você não tem permissão para mover cards');
      return;
    }

    const { draggableId, source, destination } = result;
    
    // Parse destination - format is "columnId:statusId"
    const [columnId, statusId] = destination.droppableId.split(':');
    const [, sourceStatus] = source.droppableId.split(':');
    
    // Check if moving to "aguardando_aprovacao" status
    const movingToAguardandoAprovacao = statusId === 'aguardando_aprovacao' && sourceStatus !== 'aguardando_aprovacao';
    
    moveCardMutation.mutate({
      cardId: draggableId,
      columnId,
      status: statusId,
      position: destination.index,
    });

    // Send notification if moving to "aguardando_aprovacao"
    if (movingToAguardandoAprovacao) {
      const card = cards.find(c => c.id === draggableId);
      const creator = cardCreators[draggableId];
      
      if (card && creator) {
        createCompletionNotification.mutate({
          cardId: draggableId,
          cardTitle: card.title,
          requesterId: creator.user_id,
          requesterName: creator.name,
        });
      }
    }
  };

  const handleCreateCard = (columnId: string) => {
    if (!canCreateDevCard(user?.role || null)) {
      toast.error('Você não tem permissão para criar cards');
      return;
    }
    setSelectedColumnId(columnId);
    setIsCreateModalOpen(true);
  };

  const handleCardClick = (card: KanbanCard) => {
    setSelectedCard(card);
    setIsDetailModalOpen(true);
  };

  const handleCreateSubmit = (data: any, attachments?: { file: File; name: string; size: number; type: string }[]) => {
    setIsCreating(true);
    createCardMutation.mutate({
      ...data,
      column_id: data.column_id || selectedColumnId || undefined,
      attachments,
    });
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Get dev columns only (excluding justification columns)
  const devColumns = columns.filter(c => c.title.startsWith('BY ') && !c.title.startsWith('JUSTIFICATIVA'));

  // Get justification columns
  const justificationColumns = columns.filter(c => c.title.startsWith('JUSTIFICATIVA ('));

  // Get dev columns for the modal
  const devColumnsForModal = devColumns.map(c => ({ id: c.id, title: c.title }));

  const getCardsForColumn = (columnId: string) => {
    const columnCards = cards.filter(c => c.column_id === columnId);
    const result: Record<string, KanbanCard[]> = {};
    
    CARD_STATUSES.forEach(status => {
      result[status.id] = columnCards.filter(card => card.status === status.id);
    });
    
    // Cards without status go to "a_fazer"
    const unassignedCards = columnCards.filter(
      card => !card.status || !CARD_STATUSES.some(s => s.id === card.status)
    );
    if (unassignedCards.length > 0) {
      result['a_fazer'] = [...(result['a_fazer'] || []), ...unassignedCards];
    }
    
    return result;
  };

  // Check if a card is overdue
  const isCardOverdue = (card: KanbanCard) => {
    if (!card.due_date) return false;
    const dueDate = new Date(card.due_date);
    return isPast(dueDate) && !isToday(dueDate);
  };

  // Get dev name from justification column title
  const getDevNameFromColumn = (columnTitle: string) => {
    const match = columnTitle.match(/JUSTIFICATIVA \((.+)\)/);
    return match ? match[1] : null;
  };

  // Show loading state
  const isLoading = isBoardLoading || isDevsLoading || isColumnsLoading;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Nenhum quadro de desenvolvimento encontrado</p>
      </div>
    );
  }

  if (devColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Nenhum desenvolvedor cadastrado neste squad. Crie um usuário com cargo "Desenvolvedor" para começar.</p>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-4 scrollbar-apple">
          {devColumns.map((column) => {
            const cardsByStatus = getCardsForColumn(column.id);
            const totalCards = Object.values(cardsByStatus).flat().length;

            return (
              <div
                key={column.id}
                className="w-[340px] flex-shrink-0 flex flex-col bg-card rounded-xl border border-subtle overflow-hidden"
              >
                {/* Column Header */}
                <div
                  className="p-4 flex items-center justify-between border-b border-border"
                  style={{ borderTopWidth: 4, borderTopColor: '#3b82f6' }}
                >
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-blue-500" />
                    <h3 className="font-semibold text-sm text-foreground">{column.title}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {totalCards}
                    </span>
                  </div>
                  {canCreateDevCard(user?.role || null) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCreateCard(column.id)}
                    >
                      <Plus size={14} />
                    </Button>
                  )}
                </div>

                {/* Subcategories Container */}
                <div className="flex-1 overflow-y-auto scrollbar-apple">
                  {CARD_STATUSES.map((status) => {
                    const statusCards = cardsByStatus[status.id] || [];
                    const isCollapsed = collapsedSections[`${column.id}:${status.id}`];
                    
                    return (
                      <div key={status.id} className="border-b border-border/50 last:border-b-0">
                        {/* Status Header */}
                        <button
                          onClick={() => toggleSection(`${column.id}:${status.id}`)}
                          className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className={cn("w-2 h-2 rounded-full", status.color)} />
                          {isCollapsed ? (
                            <ChevronRight size={14} className="text-muted-foreground" />
                          ) : (
                            <ChevronDown size={14} className="text-muted-foreground" />
                          )}
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {status.label}
                          </span>
                          <span className="ml-auto px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground">
                            {statusCards.length}
                          </span>
                        </button>

                        {/* Status Cards */}
                        {!isCollapsed && (
                          <Droppable droppableId={`${column.id}:${status.id}`}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                  "px-3 pb-3 space-y-2 min-h-[60px]",
                                  snapshot.isDraggingOver && "bg-primary/5"
                                )}
                              >
                                {statusCards.map((card, cardIndex) => (
                                  <Draggable 
                                    key={card.id} 
                                    draggableId={card.id} 
                                    index={cardIndex}
                                    isDragDisabled={!canMoveDevCard(user?.role || null)}
                                  >
                                    {(provided, snapshot) => {
                                      const overdue = isCardOverdue(card);
                                      const hasJustification = card.justification;
                                      
                                      return (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          onClick={() => handleCardClick(card)}
                                          className={cn(
                                            "p-3 bg-background rounded-lg border cursor-pointer",
                                            "hover:border-primary/50 hover:shadow-sm transition-all",
                                            snapshot.isDragging && "rotate-2 scale-105 shadow-lg",
                                            overdue && !hasJustification ? "border-danger" : "border-border"
                                          )}
                                        >
                                          {/* Priority Badge - Destaque */}
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className={cn(
                                              "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                              card.priority === 'urgent' 
                                                ? "bg-danger/20 text-danger border border-danger/30" 
                                                : "bg-info/20 text-info border border-info/30"
                                            )}>
                                              {card.priority === 'urgent' ? '🔥 Urgente' : 'Normal'}
                                            </span>
                                          </div>
                                          
                                          {/* Due Date Badge */}
                                          {card.due_date && (
                                            <div className={cn(
                                              "flex items-center gap-1 text-[10px] font-medium mb-1.5",
                                              overdue && !hasJustification 
                                                ? "text-danger" 
                                                : overdue && hasJustification
                                                  ? "text-warning"
                                                  : "text-muted-foreground"
                                            )}>
                                              {overdue && !hasJustification ? (
                                                <AlertTriangle size={10} />
                                              ) : (
                                                <Calendar size={10} />
                                              )}
                                              {format(new Date(card.due_date), "dd/MM/yyyy")}
                                              {overdue && !hasJustification && (
                                                <span className="ml-1 text-[9px] uppercase">(Atrasado)</span>
                                              )}
                                            </div>
                                          )}
                                          
                                          {/* Creator info */}
                                          {cardCreators[card.id] && (
                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
                                              <UserCircle size={10} />
                                              <span>Por: {cardCreators[card.id].name}</span>
                                            </div>
                                          )}
                                          
                                          <div className="flex items-start justify-between gap-2">
                                            <h4 className="font-medium text-sm text-foreground line-clamp-2">
                                              {card.title}
                                            </h4>
                                            {canArchiveDevCard(user?.role || null) && (
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                                    <MoreHorizontal size={14} />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      archiveCardMutation.mutate(card.id);
                                                    }}
                                                  >
                                                    <Archive size={14} className="mr-2" />
                                                    Arquivar
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      deleteCardMutation.mutate(card.id);
                                                    }}
                                                    className="text-danger"
                                                  >
                                                    <Trash2 size={14} className="mr-2" />
                                                    Excluir
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    }}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Justification Columns */}
          {justificationColumns.map((column) => {
            const devName = getDevNameFromColumn(column.title);
            
            return (
              <JustificationColumn 
                key={column.id} 
                column={column} 
                devName={devName || ''} 
              />
            );
          })}
        </div>
      </DragDropContext>

      {/* Create Card Modal */}
      <CreateDevCardModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedColumnId(null);
        }}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
        devColumns={devColumnsForModal}
      />

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedCard(null);
          }}
          card={selectedCard}
          isDevBoard={true}
        />
      )}

      {/* Delay Modal for Dev */}
      <DevsDelayModal
        isOpen={isDelayModalOpen}
        onClose={() => setIsDelayModalOpen(false)}
        delayedCards={delayedCards}
      />
    </>
  );
}

// Justification Column Component
function JustificationColumn({ column, devName }: { column: DevColumn; devName: string }) {
  const { data: justifications = [] } = useDevJustifications(devName);

  return (
    <div
      className="w-[300px] flex-shrink-0 flex flex-col bg-card rounded-xl border border-subtle overflow-hidden"
      style={{ borderTopWidth: 4, borderTopColor: '#ef4444' }}
    >
      {/* Column Header */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-danger" />
          <h3 className="font-semibold text-sm text-foreground">{column.title}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {justifications.length}
          </span>
        </div>
      </div>

      {/* Justifications List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-apple">
        {justifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            Nenhuma justificativa
          </div>
        ) : (
          justifications.map((justification) => (
            <div
              key={justification.id}
              className="p-3 bg-danger/5 rounded-lg border border-danger/20"
            >
              <p className="text-xs text-muted-foreground mb-1">
                {format(new Date(justification.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
              </p>
              <p className="text-sm text-foreground">{justification.justification}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
