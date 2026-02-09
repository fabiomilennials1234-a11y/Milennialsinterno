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
import CreateVideoCardModal from '@/components/kanban/CreateVideoCardModal';
import CardDetailModal from '@/components/kanban/CardDetailModal';
import VideoDelayModal from '@/components/video/VideoDelayModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  canCreateVideoCard,
  canArchiveVideoCard,
  canMoveVideoCard,
} from '@/hooks/useVideoKanban';
import { 
  useEditorDelayedCards,
  useEditorJustifications,
} from '@/hooks/useVideoDelayNotifications';
import { 
  useMultipleVideoCardsCreators,
  useCreateVideoCompletionNotification,
} from '@/hooks/useVideoCompletionNotifications';
import { KanbanCard } from '@/hooks/useKanban';

interface VideoEditor {
  user_id: string;
  name: string;
  squad_id: string | null;
}

interface VideoColumn {
  id: string;
  title: string;
  position: number;
  board_id: string;
  color: string | null;
}

// Internal statuses for each editor column
const CARD_STATUSES = [
  { id: 'a_fazer', label: 'A FAZER', color: 'bg-blue-500' },
  { id: 'fazendo', label: 'FAZENDO', color: 'bg-orange-500' },
  { id: 'alteracao', label: 'ALTERAÇÃO', color: 'bg-red-500' },
  { id: 'aguardando_aprovacao', label: 'AGUARDANDO APROVAÇÃO', color: 'bg-purple-500' },
  { id: 'aprovados', label: 'APROVADOS', color: 'bg-green-500' },
] as const;

export default function VideoKanbanBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);

  // Fetch delayed cards for this editor
  const { data: delayedCards = [] } = useEditorDelayedCards();

  // Completion toasts are handled globally in MainLayout

  // Create completion notification mutation
  const createCompletionNotification = useCreateVideoCompletionNotification();

  // Show delay modal if there are delayed cards
  useEffect(() => {
    if (delayedCards.length > 0 && user?.role === 'editor_video') {
      setIsDelayModalOpen(true);
    }
  }, [delayedCards.length, user?.role]);

  // Get user's squad
  const userSquadId = user?.squad_id;

  // Fetch video board for the squad
  const { data: board, isLoading: isBoardLoading } = useQuery({
    queryKey: ['video-board', userSquadId],
    queryFn: async () => {
      if (!userSquadId) {
        // Fallback: get the first video board
        const { data, error } = await supabase
          .from('kanban_boards')
          .select('*')
          .ilike('slug', '%video%')
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
        .ilike('slug', '%video%')
        .maybeSingle();

      if (error) throw error;
      
      // Fallback to any video board
      if (!data) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('kanban_boards')
          .select('*')
          .ilike('slug', '%video%')
          .limit(1)
          .maybeSingle();
        
        if (fallbackError) throw fallbackError;
        return fallback;
      }

      return data;
    },
  });

  // Fetch editors in the squad (only those with editor_video role)
  const { data: editors = [], isLoading: isEditorsLoading } = useQuery({
    queryKey: ['squad-editors', userSquadId],
    queryFn: async () => {
      // Get all editors from user_roles
      const { data: allEditors, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'editor_video');

      if (error) throw error;

      const editorIds = allEditors?.map(d => d.user_id) || [];
      
      if (editorIds.length === 0) return [];

      // Get profiles for editors
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, squad_id')
        .in('user_id', editorIds);

      if (profileError) throw profileError;

      // Filter by squad if user has one
      if (userSquadId) {
        return (profiles || []).filter(p => p.squad_id === userSquadId) as VideoEditor[];
      }

      return (profiles || []) as VideoEditor[];
    },
  });

  // Fetch columns for the board
  const { data: columns = [], isLoading: isColumnsLoading } = useQuery({
    queryKey: ['video-columns', board?.id],
    queryFn: async () => {
      if (!board?.id) return [];

      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as VideoColumn[];
    },
    enabled: !!board?.id,
  });

  // Fetch cards for the board
  const { data: cards = [] } = useQuery({
    queryKey: ['video-cards', board?.id],
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
  const { data: cardCreators = {} } = useMultipleVideoCardsCreators(cardIds);

  const ensureColumnsMutation = useMutation({
    mutationFn: async () => {
      if (!board?.id) return;
      
      // CRITICAL: Never run if editors list is empty - prevents race conditions
      if (editors.length === 0) {
        console.log('Skipping column sync - no editors loaded yet');
        return;
      }

      // Re-fetch columns to get the most up-to-date list
      const { data: currentColumns } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id);
      
      const existingTitles = (currentColumns || []).map(c => c.title);
      let position = (currentColumns || []).length;

      // Create editor columns and justification columns
      for (const editor of editors) {
        const columnTitle = `BY ${editor.name.toUpperCase()}`;
        const justificationTitle = `JUSTIFICATIVA (${editor.name.toUpperCase()})`;

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
                color: '#8b5cf6', // Purple for video
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
      queryClient.invalidateQueries({ queryKey: ['video-columns', board?.id] });
    },
  });

  // Track sync state
  const [syncKey, setSyncKey] = useState('');

  // Auto-create columns when editors change
  useEffect(() => {
    if (editors.length === 0) return;
    
    const newSyncKey = `${board?.id}-${editors.map(d => d.user_id).sort().join(',')}`;
    if (board?.id && newSyncKey !== syncKey && !ensureColumnsMutation.isPending) {
      setSyncKey(newSyncKey);
      ensureColumnsMutation.mutate();
    }
  }, [board?.id, editors]);

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
      await queryClient.cancelQueries({ queryKey: ['video-cards', board?.id] });
      
      const previousCards = queryClient.getQueryData<KanbanCard[]>(['video-cards', board?.id]);
      
      queryClient.setQueryData<KanbanCard[]>(['video-cards', board?.id], (old) => {
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
        queryClient.setQueryData(['video-cards', board?.id], context.previousCards);
      }
      toast.error('Erro ao mover card');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['video-cards', board?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['video-cards', board?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['video-cards', board?.id] });
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
        script_url?: string;
        observations?: string;
        materials_url?: string;
        reference_video_url?: string;
        identity_url?: string;
      };
    }) => {
      if (!board?.id || !data.column_id) throw new Error('Board ou coluna não encontrados');

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
          card_type: 'video',
          status: data.status || 'a_fazer',
        })
        .select()
        .single();

      if (error) throw error;

      // Create briefing if provided
      if (data.briefing && newCard) {
        await supabase
          .from('video_briefings')
          .insert({
            card_id: newCard.id,
            script_url: data.briefing.script_url || null,
            observations: data.briefing.observations || null,
            materials_url: data.briefing.materials_url || null,
            reference_video_url: data.briefing.reference_video_url || null,
            identity_url: data.briefing.identity_url || null,
            created_by: user?.id,
          });
      }

      return newCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-cards', board?.id] });
      toast.success('Demanda de vídeo criada com sucesso');
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
    if (!canMoveVideoCard(user?.role || null)) {
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
      
      console.log('Moving to aguardando_aprovacao:', { card: card?.title, creator, userId: user?.id });
      
      if (card && creator) {
        createCompletionNotification.mutate({
          cardId: draggableId,
          cardTitle: card.title,
          requesterId: creator.user_id,
          requesterName: creator.name,
        }, {
          onSuccess: () => {
            console.log('Video notification created successfully');
          },
          onError: (error) => {
            console.error('Error creating video notification:', error);
          }
        });
      }
    }
  };

  const handleCreateCard = (columnId: string) => {
    if (!canCreateVideoCard(user?.role || null)) {
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

  const handleCreateSubmit = (data: any) => {
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

  // Get editor columns only (excluding justification columns)
  const editorColumns = columns.filter(c => c.title.startsWith('BY ') && !c.title.startsWith('JUSTIFICATIVA'));

  // Get justification columns
  const justificationColumns = columns.filter(c => c.title.startsWith('JUSTIFICATIVA ('));

  // Get editor columns for the modal
  const editorColumnsForModal = editorColumns.map(c => ({ id: c.id, title: c.title }));

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

  // Get editor name from justification column title
  const getEditorNameFromColumn = (columnTitle: string) => {
    const match = columnTitle.match(/JUSTIFICATIVA \((.+)\)/);
    return match ? match[1] : null;
  };

  // Show loading state
  const isLoading = isBoardLoading || isEditorsLoading || isColumnsLoading;
  
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
        <p>Nenhum quadro de vídeo encontrado</p>
      </div>
    );
  }

  if (editorColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Nenhum editor de vídeo cadastrado neste squad. Crie um usuário com cargo "Editor de Vídeo" para começar.</p>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-4 scrollbar-apple">
          {editorColumns.map((column) => {
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
                  style={{ borderTopWidth: 4, borderTopColor: '#8b5cf6' }}
                >
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-purple-500" />
                    <h3 className="font-semibold text-sm text-foreground">{column.title}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {totalCards}
                    </span>
                  </div>
                  {canCreateVideoCard(user?.role || null) && (
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
                                    isDragDisabled={!canMoveVideoCard(user?.role || null)}
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
                                            {canArchiveVideoCard(user?.role || null) && (
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
            const editorName = getEditorNameFromColumn(column.title);
            
            return (
              <JustificationColumn 
                key={column.id} 
                column={column} 
                editorName={editorName || ''} 
              />
            );
          })}
        </div>
      </DragDropContext>

      {/* Create Card Modal */}
      <CreateVideoCardModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedColumnId(null);
        }}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
        editorColumns={editorColumnsForModal}
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
          isVideoBoard={true}
        />
      )}

      {/* Delay Modal for Editor */}
      <VideoDelayModal
        isOpen={isDelayModalOpen}
        onClose={() => setIsDelayModalOpen(false)}
        delayedCards={delayedCards}
      />
    </>
  );
}

// Justification Column Component
function JustificationColumn({ column, editorName }: { column: VideoColumn; editorName: string }) {
  const { data: justifications = [] } = useEditorJustifications(editorName);

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
