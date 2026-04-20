import { useState, useEffect, useMemo } from 'react';
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
import CreateAtrizesCardModal from '@/components/kanban/CreateAtrizesCardModal';
import CardDetailModal from '@/components/kanban/CardDetailModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  canCreateAtrizesCard,
  canArchiveAtrizesCard,
  canMoveAtrizesCard,
  ATRIZES_STATUSES,
} from '@/hooks/useAtrizesKanban';
import { KanbanCard } from '@/hooks/useKanban';
import { useAtrizesCompletionNotifications } from '@/hooks/useAtrizesCompletionNotifications';

interface AtrizUser {
  user_id: string;
  name: string;
  category_id: string | null;
}

interface AtrizColumn {
  id: string;
  title: string;
  position: number;
  board_id: string;
  color: string | null;
}

// Internal statuses for each atriz column
const CARD_STATUSES = ATRIZES_STATUSES;

export default function AtrizesKanbanBoard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { createNotification } = useAtrizesCompletionNotifications();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Fetch atrizes board (by slug containing 'atrizes')
  const { data: board, isLoading: isBoardLoading } = useQuery({
    queryKey: ['atrizes-board'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kanban_boards')
        .select('*')
        .ilike('slug', '%atrizes%')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch atrizes (users with atrizes_gravacao role - independent, not in squads)
  const { data: atrizes = [], isLoading: isAtrizesLoading } = useQuery({
    queryKey: ['atrizes-users'],
    queryFn: async () => {
      // Get all users with atrizes_gravacao role
      const { data: atrizRoles, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'atrizes_gravacao');

      if (error) throw error;

      const atrizIds = atrizRoles?.map(d => d.user_id) || [];
      
      if (atrizIds.length === 0) return [];

      // Get profiles for atrizes
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, category_id')
        .in('user_id', atrizIds);

      if (profileError) throw profileError;

      return (profiles || []) as AtrizUser[];
    },
  });

  // Fetch columns for the board
  const { data: columns = [], isLoading: isColumnsLoading } = useQuery({
    queryKey: ['atrizes-columns', board?.id],
    queryFn: async () => {
      if (!board?.id) return [];

      const { data, error } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as AtrizColumn[];
    },
    enabled: !!board?.id,
  });

  // Fetch cards for the board
  const { data: cards = [] } = useQuery({
    queryKey: ['atrizes-cards', board?.id],
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

  // Fetch card creators
  const { data: cardCreators = {} } = useQuery({
    queryKey: ['atrizes-card-creators', cards.map(c => c.id).join(',')],
    queryFn: async () => {
      const creatorIds = [...new Set(cards.map(c => c.created_by).filter(Boolean))] as string[];
      if (creatorIds.length === 0) return {};

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', creatorIds);

      const result: Record<string, { user_id: string; name: string }> = {};
      cards.forEach(card => {
        if (card.created_by) {
          const profile = profiles?.find(p => p.user_id === card.created_by);
          if (profile) {
            result[card.id] = { user_id: profile.user_id, name: profile.name };
          }
        }
      });

      return result;
    },
    enabled: cards.length > 0,
  });

  const ensureColumnsMutation = useMutation({
    mutationFn: async () => {
      if (!board?.id) return;
      
      // CRITICAL: Never run if atrizes list is empty - prevents race conditions
      if (atrizes.length === 0) {
        return;
      }

      // Re-fetch columns to get the most up-to-date list
      const { data: currentColumns } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', board.id);
      
      const existingTitles = (currentColumns || []).map(c => c.title);
      let position = (currentColumns || []).length;

      // Create atriz columns and justification columns
      for (const atriz of atrizes) {
        const columnTitle = `BY ${atriz.name.toUpperCase()}`;
        const justificationTitle = `JUSTIFICATIVA (${atriz.name.toUpperCase()})`;

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
      queryClient.invalidateQueries({ queryKey: ['atrizes-columns', board?.id] });
    },
  });

  // Track sync state
  const [syncKey, setSyncKey] = useState('');

  // Auto-create columns when atrizes change
  useEffect(() => {
    if (atrizes.length === 0) return;
    
    const newSyncKey = `${board?.id}-${atrizes.map(d => d.user_id).sort().join(',')}`;
    if (board?.id && newSyncKey !== syncKey && !ensureColumnsMutation.isPending) {
      setSyncKey(newSyncKey);
      ensureColumnsMutation.mutate();
    }
  }, [board?.id, atrizes]);

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
      await queryClient.cancelQueries({ queryKey: ['atrizes-cards', board?.id] });
      
      const previousCards = queryClient.getQueryData<KanbanCard[]>(['atrizes-cards', board?.id]);
      
      queryClient.setQueryData<KanbanCard[]>(['atrizes-cards', board?.id], (old) => {
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
        queryClient.setQueryData(['atrizes-cards', board?.id], context.previousCards);
      }
      toast.error('Erro ao mover card');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['atrizes-cards', board?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['atrizes-cards', board?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['atrizes-cards', board?.id] });
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
        client_instagram?: string;
        script_url?: string;
        drive_upload_url?: string;
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
          card_type: 'atrizes',
          status: data.status || 'a_fazer',
        })
        .select()
        .single();

      if (error) throw error;

      // Create briefing if provided
      if (data.briefing && newCard) {
        await supabase
          .from('atrizes_briefings' as any)
          .insert({
            card_id: newCard.id,
            client_instagram: data.briefing.client_instagram || null,
            script_url: data.briefing.script_url || null,
            drive_upload_url: data.briefing.drive_upload_url || null,
            created_by: user?.id,
          } as any);
      }

      return newCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atrizes-cards', board?.id] });
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

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (!canMoveAtrizesCard(user?.role || null)) {
      toast.error('Você não tem permissão para mover cards');
      return;
    }

    const { draggableId, destination, source } = result;
    
    // Parse destination - format is "columnId:statusId"
    const [columnId, statusId] = destination.droppableId.split(':');
    const [, sourceStatusId] = source.droppableId.split(':');
    
    // Check if moving to "aguardando_aprovacao" status
    const isMovingToApproval = statusId === 'aguardando_aprovacao' && sourceStatusId !== 'aguardando_aprovacao';
    
    moveCardMutation.mutate({
      cardId: draggableId,
      columnId,
      status: statusId,
      position: destination.index,
    });

    // Create completion notification if moving to aguardando_aprovacao
    if (isMovingToApproval) {
      const card = cards.find(c => c.id === draggableId);
      const creator = cardCreators[draggableId];
      
      if (card && creator && user) {
        // Get current user's name
        const { data: currentUserProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .maybeSingle();

        createNotification({
          cardId: card.id,
          cardTitle: card.title,
          completedBy: user.id,
          completedByName: currentUserProfile?.name || 'Atriz',
          requesterId: creator.user_id,
          requesterName: creator.name,
        });
      }
    }
  };

  const handleCreateCard = (columnId: string) => {
    if (!canCreateAtrizesCard(user?.role || null)) {
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

  // Get atriz columns only (excluding justification columns)
  const atrizColumns = columns.filter(c => c.title.startsWith('BY ') && !c.title.startsWith('JUSTIFICATIVA'));

  // Get justification columns
  const justificationColumns = columns.filter(c => c.title.startsWith('JUSTIFICATIVA ('));

  // Get atriz columns for the modal
  const atrizColumnsForModal = atrizColumns.map(c => ({ id: c.id, title: c.title }));

  // Agrupa cards por coluna+status em 1 pass (O(n)) e memoiza.
  // Antes: chamado N vezes no render, cada um rodando 2 filters sobre `cards`.
  const cardsByColumnAndStatus = useMemo(() => {
    const statusIds = new Set(CARD_STATUSES.map(s => s.id));
    const buckets: Record<string, Record<string, KanbanCard[]>> = {};
    for (const card of cards) {
      if (!buckets[card.column_id]) {
        buckets[card.column_id] = {};
        for (const s of CARD_STATUSES) buckets[card.column_id][s.id] = [];
      }
      const status = card.status && statusIds.has(card.status) ? card.status : 'a_fazer';
      buckets[card.column_id][status].push(card);
    }
    return buckets;
  }, [cards]);

  const getCardsForColumn = (columnId: string) => {
    return cardsByColumnAndStatus[columnId] || CARD_STATUSES.reduce((acc, s) => {
      acc[s.id] = [];
      return acc;
    }, {} as Record<string, KanbanCard[]>);
  };

  // Check if a card is overdue
  const isCardOverdue = (card: KanbanCard) => {
    if (!card.due_date) return false;
    const dueDate = new Date(card.due_date);
    return isPast(dueDate) && !isToday(dueDate);
  };

  // Show loading state
  const isLoading = isBoardLoading || isAtrizesLoading || isColumnsLoading;
  
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
        <p>Nenhum quadro de gravação encontrado</p>
      </div>
    );
  }

  if (atrizColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Nenhuma atriz de gravação cadastrada. Crie um usuário com cargo "Atrizes de Gravação" para começar.</p>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-4 scrollbar-apple">
          {atrizColumns.map((column) => {
            const cardsByStatus = getCardsForColumn(column.id);
            const totalCards = Object.values(cardsByStatus).flat().length;
            const displayTitle = column.title.replace(/^BY\s+/i, '');

            return (
              <div
                key={column.id}
                className="kanban-column w-[340px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-border overflow-hidden"
              >
                {/* Column Header — estilo pipeline, ações sempre visíveis */}
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
                    {canCreateAtrizesCard(user?.role || null) && (
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
                  {CARD_STATUSES.map((status) => {
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
                                    isDragDisabled={!canMoveAtrizesCard(user?.role || null)}
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
                                            {canArchiveAtrizesCard(user?.role || null) && (
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
          {justificationColumns.map((column) => (
            <JustificationColumn key={column.id} column={column} />
          ))}
        </div>
      </DragDropContext>

      {/* Create Card Modal */}
      <CreateAtrizesCardModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedColumnId(null);
        }}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
        atrizColumns={atrizColumnsForModal}
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
        />
      )}
    </>
  );
}

// Justification Column Component
function JustificationColumn({ column }: { column: AtrizColumn }) {
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
        </div>
      </div>

      {/* Justifications List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-apple">
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50 select-none">
          <div className="w-8 h-8 rounded-lg border border-dashed border-border mb-2" />
          <p className="text-[11px]">Nenhuma justificativa</p>
        </div>
      </div>
    </div>
  );
}
