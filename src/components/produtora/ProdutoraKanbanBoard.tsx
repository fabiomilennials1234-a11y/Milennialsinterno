import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, User, ChevronDown, ChevronRight, MoreHorizontal, Archive, Trash2, Calendar, AlertTriangle, FileText, UserCircle, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CreateProdutoraCardModal from '@/components/produtora/CreateProdutoraCardModal';
import CardDetailModal from '@/components/kanban/CardDetailModal';
import ProdutoraDelayModal from '@/components/produtora/ProdutoraDelayModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PRODUTORA_STATUSES,
  canCreateProdutoraCard,
  canArchiveProdutoraCard,
  canMoveProdutoraCard,
} from '@/hooks/useProdutoraKanban';
import { 
  useProdutoraDelayedCards,
  useProdutoraJustifications,
} from '@/hooks/useProdutoraDelayNotifications';
import { 
  useMultipleProdutoraCardsCreators,
  useCreateProdutoraCompletionNotification,
} from '@/hooks/useProdutoraCompletionNotifications';
import { KanbanCard } from '@/hooks/useKanban';

interface ProdutoraUser {
  user_id: string;
  name: string;
  squad_id: string | null;
}

interface ProdutoraColumn {
  id: string;
  title: string;
  position: number;
  board_id: string;
  color: string | null;
}

export default function ProdutoraKanbanBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);

  // Fetch delayed cards for this produtora
  const { data: delayedCards = [] } = useProdutoraDelayedCards();

  // Create completion notification mutation
  const createCompletionNotification = useCreateProdutoraCompletionNotification();

  // Show delay modal if there are delayed cards
  useEffect(() => {
    if (delayedCards.length > 0 && user?.role === 'produtora') {
      setIsDelayModalOpen(true);
    }
  }, [delayedCards.length, user?.role]);

  // Fetch produtora board - use the existing board by slug
  const { data: board, isLoading: isBoardLoading } = useQuery({
    queryKey: ['produtora-board'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kanban_boards')
        .select('*')
        .eq('slug', 'produtora-board')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all produtora users (no squad filter - all users see the same board)
  const { data: produtoraUsers = [], isLoading: isProdutoraUsersLoading } = useQuery({
    queryKey: ['all-produtora-users'],
    queryFn: async () => {
      const { data: allProdutoras, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'produtora');
      if (error) throw error;
      const produtoraIds = allProdutoras?.map(d => d.user_id) || [];
      if (produtoraIds.length === 0) return [];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, squad_id')
        .in('user_id', produtoraIds);
      if (profileError) throw profileError;
      return (profiles || []) as ProdutoraUser[];
    },
  });

  // Fetch columns for the board
  const { data: columns = [], isLoading: isColumnsLoading } = useQuery({
    queryKey: ['produtora-columns', board?.id],
    queryFn: async () => {
      if (!board?.id) return [];

      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as ProdutoraColumn[];
    },
    enabled: !!board?.id,
  });

  // Fetch cards for the board
  const { data: cards = [] } = useQuery({
    queryKey: ['produtora-cards', board?.id],
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
  const { data: cardCreators = {} } = useMultipleProdutoraCardsCreators(cardIds);

  const ensureColumnsMutation = useMutation({
    mutationFn: async () => {
      if (!board?.id) return;
      
      // CRITICAL: Never run if produtora list is empty - prevents race conditions
      if (produtoraUsers.length === 0) {
        return;
      }

      // Re-fetch columns to get the most up-to-date list
      const { data: currentColumns } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id);
      
      const existingTitles = (currentColumns || []).map(c => c.title);
      let position = (currentColumns || []).length;

      // Create produtora columns and justification columns
      for (const produtoraUser of produtoraUsers) {
        const columnTitle = `BY ${produtoraUser.name.toUpperCase()}`;
        const justificationTitle = `JUSTIFICATIVA (${produtoraUser.name.toUpperCase()})`;

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
                color: 'primary',
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
                color: 'danger',
              });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtora-columns', board?.id] });
    },
  });

  // Track sync state
  const [syncKey, setSyncKey] = useState('');

  // Auto-create columns when produtora users change
  useEffect(() => {
    if (produtoraUsers.length === 0) return;
    
    const newSyncKey = `${board?.id}-${produtoraUsers.map(d => d.user_id).sort().join(',')}`;
    if (board?.id && newSyncKey !== syncKey && !ensureColumnsMutation.isPending) {
      setSyncKey(newSyncKey);
      ensureColumnsMutation.mutate();
    }
  }, [board?.id, produtoraUsers]);

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
      await queryClient.cancelQueries({ queryKey: ['produtora-cards', board?.id] });
      
      const previousCards = queryClient.getQueryData<KanbanCard[]>(['produtora-cards', board?.id]);
      
      queryClient.setQueryData<KanbanCard[]>(['produtora-cards', board?.id], (old) => {
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
        queryClient.setQueryData(['produtora-cards', board?.id], context.previousCards);
      }
      toast.error('Erro ao mover card');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['produtora-cards', board?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['produtora-cards', board?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['produtora-cards', board?.id] });
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
        reference_video_url?: string;
      };
    }) => {
      if (!board?.id || !data.column_id) throw new Error('Board ou coluna não encontrados');

      // Get max position in column
      const columnCards = cards.filter(c => c.column_id === data.column_id);
      const maxPosition = columnCards.length > 0 
        ? Math.max(...columnCards.map(c => c.position)) + 1 
        : 0;

      // Map priority: 'normal' -> 'medium', 'urgent' -> 'urgent'
      const dbPriority = data.priority === 'urgent' ? 'urgent' : 'medium';

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
          card_type: 'produtora',
          status: data.status || 'a_gravar',
        })
        .select()
        .single();

      if (error) throw error;

      // Create briefing if provided
      if (data.briefing && newCard) {
        await supabase
          .from('produtora_briefings')
          .insert({
            card_id: newCard.id,
            script_url: data.briefing.script_url || null,
            observations: data.briefing.observations || null,
            reference_video_url: data.briefing.reference_video_url || null,
            created_by: user?.id,
          });
      }

      return newCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtora-cards', board?.id] });
      toast.success('Demanda de gravação criada com sucesso');
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
    if (!canMoveProdutoraCard(user?.role || null)) {
      toast.error('Você não tem permissão para mover cards');
      return;
    }

    const { draggableId, source, destination } = result;
    
    // Parse destination - format is "columnId:statusId"
    const [columnId, statusId] = destination.droppableId.split(':');
    const [, sourceStatus] = source.droppableId.split(':');
    
    // Check if moving to "gravado" status
    const movingToGravado = statusId === 'gravado' && sourceStatus !== 'gravado';
    
    moveCardMutation.mutate({
      cardId: draggableId,
      columnId,
      status: statusId,
      position: destination.index,
    });

    // Send notification if moving to "gravado"
    if (movingToGravado) {
      const card = cards.find(c => c.id === draggableId);
      const creator = cardCreators[draggableId];
      
      
      if (card && creator) {
        createCompletionNotification.mutate({
          cardId: draggableId,
          cardTitle: card.title,
          requesterId: creator.user_id,
          requesterName: creator.name,
        }, {
          onSuccess: () => {
          },
          onError: (error) => {
            console.error('Error creating produtora notification:', error);
          }
        });
      }
    }
  };

  const handleCreateCard = (columnId: string) => {
    if (!canCreateProdutoraCard(user?.role || null)) {
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

  // Get produtora columns only (excluding justification columns)
  const produtoraColumns = columns.filter(c => c.title.startsWith('BY ') && !c.title.startsWith('JUSTIFICATIVA'));

  // Get justification columns
  const justificationColumns = columns.filter(c => c.title.startsWith('JUSTIFICATIVA ('));

  // Get produtora columns for the modal
  const produtoraColumnsForModal = produtoraColumns.map(c => ({ id: c.id, title: c.title }));

  const getCardsForColumn = (columnId: string) => {
    const columnCards = cards.filter(c => c.column_id === columnId);
    const result: Record<string, KanbanCard[]> = {};
    
    PRODUTORA_STATUSES.forEach(status => {
      result[status.id] = columnCards.filter(card => card.status === status.id);
    });
    
    // Cards without status go to "a_gravar"
    const unassignedCards = columnCards.filter(
      card => !card.status || !PRODUTORA_STATUSES.some(s => s.id === card.status)
    );
    if (unassignedCards.length > 0) {
      result['a_gravar'] = [...(result['a_gravar'] || []), ...unassignedCards];
    }
    
    return result;
  };

  // Check if a card is overdue
  const isCardOverdue = (card: KanbanCard) => {
    if (!card.due_date) return false;
    const dueDate = new Date(card.due_date);
    return isPast(dueDate) && !isToday(dueDate);
  };

  // Get produtora name from justification column title
  const getProdutoraNameFromColumn = (columnTitle: string) => {
    const match = columnTitle.match(/JUSTIFICATIVA \((.+)\)/);
    return match ? match[1] : null;
  };

  // Show loading state
  const isLoading = isBoardLoading || isProdutoraUsersLoading || isColumnsLoading;
  
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
        <p>Nenhum quadro de produtora encontrado</p>
      </div>
    );
  }

  if (produtoraColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Nenhum usuário produtora cadastrado. Crie um usuário com cargo "Produtora" para começar.</p>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-4 scrollbar-apple">
          {produtoraColumns.map((column) => {
            const cardsByStatus = getCardsForColumn(column.id);
            const totalCards = Object.values(cardsByStatus).flat().length;
            const displayTitle = column.title.replace(/^BY\s+/i, '');

            return (
              <div
                key={column.id}
                className="kanban-column w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-border overflow-hidden"
              >
                {/* Column Header — estilo pipeline */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <User size={13} className="text-muted-foreground/70 shrink-0" strokeWidth={2.25} />
                    <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-foreground truncate">
                      {displayTitle}
                    </h3>
                    <span className="text-[12px] font-medium text-muted-foreground/70 tabular-nums ml-0.5">
                      {totalCards}
                    </span>
                    {canCreateProdutoraCard(user?.role || null) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-auto text-muted-foreground/60 hover:text-foreground"
                        onClick={() => handleCreateCard(column.id)}
                      >
                        <Plus size={14} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Subcategories Container */}
                <div className="flex-1 overflow-y-auto scrollbar-apple">
                  {PRODUTORA_STATUSES.map((status) => {
                    const statusCards = cardsByStatus[status.id] || [];
                    const isCollapsed = collapsedSections[`${column.id}:${status.id}`];

                    return (
                      <div key={status.id} className="border-b border-border/40 last:border-b-0">
                        {/* Status Header */}
                        <button
                          onClick={() => toggleSection(`${column.id}:${status.id}`)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={13} className="text-muted-foreground/70 shrink-0" />
                          ) : (
                            <ChevronDown size={13} className="text-muted-foreground/70 shrink-0" />
                          )}
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.color)} />
                          <span className="text-[12px] font-medium text-foreground/80">
                            {status.label}
                          </span>
                          <span className="ml-auto text-[11px] font-medium text-muted-foreground/70 tabular-nums">
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
                                  "px-3 pb-3 space-y-2 min-h-[60px] transition-colors",
                                  snapshot.isDraggingOver && "kanban-droppable-active"
                                )}
                              >
                                {statusCards.map((card, cardIndex) => (
                                  <Draggable
                                    key={card.id}
                                    draggableId={card.id}
                                    index={cardIndex}
                                    isDragDisabled={!canMoveProdutoraCard(user?.role || null)}
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
                                            "kanban-card group p-3.5 bg-card rounded-xl border cursor-pointer",
                                            snapshot.isDragging && "kanban-card-dragging",
                                            overdue && !hasJustification ? "border-danger/60" : "border-border"
                                          )}
                                        >
                                          {/* Metadata row */}
                                          <div className="flex items-center gap-1.5 mb-2 min-h-[16px]">
                                            {card.priority === 'urgent' && (
                                              <Flag size={12} strokeWidth={2.5} fill="currentColor" className="text-danger" />
                                            )}
                                            {card.due_date && (
                                              <div className={cn(
                                                "flex items-center gap-1 text-[11px] font-medium tabular-nums",
                                                overdue && !hasJustification
                                                  ? "text-danger"
                                                  : overdue && hasJustification
                                                    ? "text-warning"
                                                    : "text-muted-foreground/80"
                                              )}>
                                                {overdue && !hasJustification ? (
                                                  <AlertTriangle size={11} strokeWidth={2.25} />
                                                ) : (
                                                  <Calendar size={11} strokeWidth={2.25} />
                                                )}
                                                {format(new Date(card.due_date), "dd MMM", { locale: ptBR })}
                                              </div>
                                            )}
                                            {cardCreators[card.id] && (
                                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80 truncate">
                                                <UserCircle size={11} strokeWidth={2.25} />
                                                <span className="truncate">{cardCreators[card.id].name}</span>
                                              </div>
                                            )}
                                          </div>

                                          <div className="flex items-start justify-between gap-2">
                                            <h4 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground leading-[1.35] line-clamp-2">
                                              {card.title}
                                            </h4>
                                            {canArchiveProdutoraCard(user?.role || null) && (
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
            const produtoraName = getProdutoraNameFromColumn(column.title);
            
            return (
              <JustificationColumn 
                key={column.id} 
                column={column} 
                produtoraName={produtoraName || ''} 
              />
            );
          })}
        </div>
      </DragDropContext>

      {/* Create Card Modal */}
      <CreateProdutoraCardModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedColumnId(null);
        }}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
        produtoraColumns={produtoraColumnsForModal}
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
          isProdutoraBoard={true}
        />
      )}

      {/* Delay Modal for Produtora */}
      <ProdutoraDelayModal
        isOpen={isDelayModalOpen}
        onClose={() => setIsDelayModalOpen(false)}
        delayedCards={delayedCards}
      />
    </>
  );
}

// Justification Column Component
function JustificationColumn({ column, produtoraName }: { column: ProdutoraColumn; produtoraName: string }) {
  const { data: justifications = [] } = useProdutoraJustifications(produtoraName);
  const displayTitle = column.title.replace(/JUSTIFICATIVA\s*\(([^)]+)\)/i, '$1');

  return (
    <div className="kanban-column w-[300px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-border overflow-hidden">
      {/* Column Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-danger shrink-0" strokeWidth={2.25} />
          <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground truncate">
            Justificativa · {displayTitle}
          </h3>
          <span className="text-[11px] font-medium text-muted-foreground/80 tabular-nums">
            {justifications.length}
          </span>
        </div>
      </div>

      {/* Justifications List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-apple">
        {justifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50 select-none">
            <div className="w-8 h-8 rounded-lg border border-dashed border-border mb-2" />
            <p className="text-[11px]">Nenhuma justificativa</p>
          </div>
        ) : (
          justifications.map((justification) => (
            <div
              key={justification.id}
              className="p-3 bg-danger/5 rounded-xl border border-danger/20"
            >
              <p className="text-[11px] text-muted-foreground mb-1 tabular-nums">
                {format(new Date(justification.created_at), "dd MMM, HH:mm", { locale: ptBR })}
              </p>
              <p className="text-[13px] text-foreground leading-[1.45]">{justification.justification}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
