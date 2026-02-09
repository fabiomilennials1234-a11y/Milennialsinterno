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
import CreateDesignCardModal from '@/components/kanban/CreateDesignCardModal';
import CardDetailModal from '@/components/kanban/CardDetailModal';
import DesignDelayModal from '@/components/design/DesignDelayModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  canCreateDesignCard,
  canArchiveDesignCard,
  canMoveDesignCard,
} from '@/hooks/useDesignKanban';
import { 
  useDesignerDelayedCards,
  useDesignerJustifications,
} from '@/hooks/useDesignDelayNotifications';
import { 
  useMultipleCardsCreators,
  useCreateCompletionNotification,
} from '@/hooks/useDesignCompletionNotifications';
import { KanbanCard } from '@/hooks/useKanban';

interface Designer {
  user_id: string;
  name: string;
  squad_id: string | null;
}

interface DesignColumn {
  id: string;
  title: string;
  position: number;
  board_id: string;
  color: string | null;
}

// Internal statuses for each designer column
const CARD_STATUSES = [
  { id: 'a_fazer', label: 'A FAZER', color: 'bg-blue-500' },
  { id: 'fazendo', label: 'FAZENDO', color: 'bg-orange-500' },
  { id: 'arrumar', label: 'ARRUMAR', color: 'bg-red-500' },
  { id: 'para_aprovacao', label: 'PARA APROVAÇÃO', color: 'bg-purple-500' },
  { id: 'aprovado', label: 'APROVADO', color: 'bg-green-500' },
] as const;

export default function DesignKanbanBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);

  // Fetch delayed cards for this designer
  const { data: delayedCards = [] } = useDesignerDelayedCards();

  // Completion toasts are now handled globally in MainLayout

  // Create completion notification mutation
  const createCompletionNotification = useCreateCompletionNotification();

  // Show delay modal if there are delayed cards
  useEffect(() => {
    if (delayedCards.length > 0 && user?.role === 'design') {
      setIsDelayModalOpen(true);
    }
  }, [delayedCards.length, user?.role]);

  // Get user's squad
  const userSquadId = user?.squad_id;

  // Fetch design board for the squad
  const { data: board, isLoading: isBoardLoading } = useQuery({
    queryKey: ['design-board', userSquadId],
    queryFn: async () => {
      if (!userSquadId) {
        // Fallback: get the first design board
        const { data, error } = await supabase
          .from('kanban_boards')
          .select('*')
          .ilike('slug', '%design%')
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
        .ilike('slug', '%design%')
        .maybeSingle();

      if (error) throw error;
      
      // Fallback to any design board
      if (!data) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('kanban_boards')
          .select('*')
          .ilike('slug', '%design%')
          .limit(1)
          .maybeSingle();
        
        if (fallbackError) throw fallbackError;
        return fallback;
      }

      return data;
    },
  });

  // Fetch designers in the squad (only those with design role)
  const { data: designers = [], isLoading: isDesignersLoading } = useQuery({
    queryKey: ['squad-designers', userSquadId],
    queryFn: async () => {
      // Get all designers from user_roles
      const { data: allDesigners, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'design');

      if (error) throw error;

      const designerIds = allDesigners?.map(d => d.user_id) || [];
      
      if (designerIds.length === 0) return [];

      // Get profiles for designers
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, squad_id')
        .in('user_id', designerIds);

      if (profileError) throw profileError;

      // Filter by squad if user has one
      if (userSquadId) {
        return (profiles || []).filter(p => p.squad_id === userSquadId) as Designer[];
      }

      return (profiles || []) as Designer[];
    },
  });

  // Fetch columns for the board
  const { data: columns = [], isLoading: isColumnsLoading } = useQuery({
    queryKey: ['design-columns', board?.id],
    queryFn: async () => {
      if (!board?.id) return [];

      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as DesignColumn[];
    },
    enabled: !!board?.id,
  });

  // Fetch cards for the board
  const { data: cards = [] } = useQuery({
    queryKey: ['design-cards', board?.id],
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
  const { data: cardCreators = {} } = useMultipleCardsCreators(cardIds);
  const ensureColumnsMutation = useMutation({
    mutationFn: async () => {
      if (!board?.id) return;
      
      // CRITICAL: Never run if designers list is empty - this prevents race conditions
      // where columns get deleted during loading
      if (designers.length === 0) {
        console.log('Skipping column sync - no designers loaded yet');
        return;
      }

      // Re-fetch columns to get the most up-to-date list and avoid race conditions
      const { data: currentColumns } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id);
      
      const existingTitles = (currentColumns || []).map(c => c.title);
      let position = (currentColumns || []).length;

      // Create designer columns and justification columns (skip if already exists)
      for (const designer of designers) {
        const columnTitle = `BY ${designer.name.toUpperCase()}`;
        const justificationTitle = `JUSTIFICATIVA (${designer.name.toUpperCase()})`;

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
                color: '#6366f1',
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

      // REMOVED: Column deletion logic that was causing cards to disappear
      // Previously this would delete columns for designers not in the current list,
      // but during loading the list could be temporarily empty, causing all columns to be deleted.
      // Columns should only be deleted manually by admins, not automatically.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-columns', board?.id] });
    },
  });

  // Track sync state
  const [syncKey, setSyncKey] = useState('');

  // Auto-create columns when designers change (only when we have designers)
  useEffect(() => {
    // Only sync if we have designers loaded
    if (designers.length === 0) return;
    
    const newSyncKey = `${board?.id}-${designers.map(d => d.user_id).sort().join(',')}`;
    if (board?.id && newSyncKey !== syncKey && !ensureColumnsMutation.isPending) {
      setSyncKey(newSyncKey);
      ensureColumnsMutation.mutate();
    }
  }, [board?.id, designers]);

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
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['design-cards', board?.id] });
      
      // Snapshot the previous value
      const previousCards = queryClient.getQueryData<KanbanCard[]>(['design-cards', board?.id]);
      
      // Optimistically update the card
      queryClient.setQueryData<KanbanCard[]>(['design-cards', board?.id], (old) => {
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
      // Rollback on error
      if (context?.previousCards) {
        queryClient.setQueryData(['design-cards', board?.id], context.previousCards);
      }
      toast.error('Erro ao mover card');
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['design-cards', board?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['design-cards', board?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['design-cards', board?.id] });
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
      briefing?: {
        description?: string;
        references_url?: string;
        identity_url?: string;
        client_instagram?: string;
        script_url?: string;
      };
    }) => {
      if (!board?.id || !data.column_id) throw new Error('Board ou coluna não encontrados');

      // Get max position in column
      const columnCards = cards.filter(c => c.column_id === data.column_id);
      const maxPosition = columnCards.length > 0 
        ? Math.max(...columnCards.map(c => c.position)) + 1 
        : 0;

      // Map frontend priority to database values
      const priorityMap: Record<string, string> = {
        'normal': 'medium',
        'urgent': 'urgent',
        'high': 'high',
        'medium': 'medium',
        'low': 'low',
      };
      const dbPriority = priorityMap[data.priority || 'normal'] || 'medium';

      const { data: newCard, error } = await supabase
        .from('kanban_cards')
        .insert({
          board_id: board.id,
          column_id: data.column_id,
          title: data.title,
          description: data.description || null,
          priority: dbPriority,
          due_date: data.due_date || null,
          position: maxPosition,
          created_by: user?.id,
          card_type: 'design',
          status: data.status || 'a_fazer',
        })
        .select()
        .single();

      if (error) throw error;

      // Create briefing if provided
      if (data.briefing && newCard) {
        await supabase
          .from('design_briefings')
          .insert({
            card_id: newCard.id,
            description: data.briefing.description || null,
            references_url: data.briefing.references_url || null,
            identity_url: data.briefing.identity_url || null,
            client_instagram: data.briefing.client_instagram || null,
            script_url: data.briefing.script_url || null,
            created_by: user?.id,
          });
      }

      return newCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-cards', board?.id] });
      toast.success('Card modelo criado com sucesso');
      setIsCreateModalOpen(false);
      setSelectedColumnId(null);
      setIsCreating(false);
    },
    onError: (error) => {
      console.error('Error creating card:', error);
      toast.error('Erro ao criar card');
      setIsCreating(false);
    },
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (!canMoveDesignCard(user?.role || null)) {
      toast.error('Você não tem permissão para mover cards');
      return;
    }

    const { draggableId, source, destination } = result;
    
    // Parse destination - format is "columnId:statusId"
    const [columnId, statusId] = destination.droppableId.split(':');
    const [, sourceStatus] = source.droppableId.split(':');
    
    // Check if moving to "para_aprovacao" status (and wasn't already there)
    const movingToParaAprovacao = statusId === 'para_aprovacao' && sourceStatus !== 'para_aprovacao';
    
    moveCardMutation.mutate({
      cardId: draggableId,
      columnId,
      status: statusId,
      position: destination.index,
    });

    // Send notification if moving to "para_aprovacao"
    if (movingToParaAprovacao) {
      const card = cards.find(c => c.id === draggableId);
      const creator = cardCreators[draggableId];
      
      console.log('Moving to para_aprovacao:', { card: card?.title, creator, userId: user?.id });
      
      // Send notification to the person who created the briefing
      // (they should be notified even if they are moving it themselves in some cases,
      // but typically a designer moves it, not the person who briefed)
      if (card && creator) {
        createCompletionNotification.mutate({
          cardId: draggableId,
          cardTitle: card.title,
          requesterId: creator.user_id,
          requesterName: creator.name,
        }, {
          onSuccess: () => {
            console.log('Notification created successfully');
          },
          onError: (error) => {
            console.error('Error creating notification:', error);
          }
        });
      } else {
        console.log('Missing card or creator:', { hasCard: !!card, hasCreator: !!creator });
      }
    }
  };

  const handleCreateCard = (columnId: string) => {
    if (!canCreateDesignCard(user?.role || null)) {
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

  const handleCreateSubmit = (data: {
    title: string;
    description?: string;
    priority?: 'normal' | 'urgent';
    due_date?: string;
    column_id?: string;
    status?: string;
    briefing?: {
      description?: string;
      references_url?: string;
      identity_url?: string;
      client_instagram?: string;
      script_url?: string;
    };
  }) => {
    setIsCreating(true);
    createCardMutation.mutate({
      ...data,
      column_id: data.column_id || selectedColumnId || undefined,
    });
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Get designer columns only (excluding justification columns)
  const designerColumns = columns.filter(c => c.title.startsWith('BY ') && !c.title.startsWith('JUSTIFICATIVA'));

  // Get justification columns
  const justificationColumns = columns.filter(c => c.title.startsWith('JUSTIFICATIVA ('));

  // Get designer columns for the modal
  const designerColumnsForModal = designerColumns.map(c => ({ id: c.id, title: c.title }));

  const getCardsForColumnAndStatus = (columnId: string, status: string) => {
    return cards.filter(c => c.column_id === columnId && c.status === status);
  };

  // Cards without status go to "a_fazer" by default
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

  // Get designer name from justification column title
  const getDesignerNameFromColumn = (columnTitle: string) => {
    const match = columnTitle.match(/JUSTIFICATIVA \((.+)\)/);
    return match ? match[1] : null;
  };

  // Show loading state while data is being fetched
  const isLoading = isBoardLoading || isDesignersLoading || isColumnsLoading;
  
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
        <p>Nenhum quadro de design encontrado</p>
      </div>
    );
  }

  if (designerColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Nenhum designer cadastrado neste squad. Crie um usuário com cargo "Design" para começar.</p>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-4 scrollbar-apple">
          {designerColumns.map((column) => {
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
                  style={{ borderTopWidth: 4, borderTopColor: '#6366f1' }}
                >
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">{column.title}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {totalCards}
                    </span>
                  </div>
                  {canCreateDesignCard(user?.role || null) && (
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
                                    isDragDisabled={!canMoveDesignCard(user?.role || null)}
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
                                            {canArchiveDesignCard(user?.role || null) && (
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
            const designerName = getDesignerNameFromColumn(column.title);
            
            return (
              <JustificationColumn 
                key={column.id} 
                column={column} 
                designerName={designerName || ''} 
              />
            );
          })}
        </div>
      </DragDropContext>

      {/* Create Card Modal */}
      <CreateDesignCardModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedColumnId(null);
        }}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
        designerColumns={designerColumnsForModal}
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
          isDesignBoard={true}
        />
      )}

      {/* Delay Modal for Designer */}
      <DesignDelayModal
        isOpen={isDelayModalOpen}
        onClose={() => setIsDelayModalOpen(false)}
        delayedCards={delayedCards}
      />
    </>
  );
}

// Justification Column Component
function JustificationColumn({ column, designerName }: { column: DesignColumn; designerName: string }) {
  const { data: justifications = [] } = useDesignerJustifications(designerName);

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
                {format(new Date(justification.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <p className="text-sm text-foreground">
                {justification.justification}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
