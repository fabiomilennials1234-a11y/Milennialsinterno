import { useState, useCallback, useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Loader2, Command } from 'lucide-react';
import { useColumnCollapse } from '@/hooks/useColumnCollapse';
import { useKanbanKeyboard } from '@/hooks/useKanbanKeyboard';
import KanbanFilters, { applyKanbanFilter, type KanbanFilter } from './KanbanFilters';
import KanbanQuickSearch from './KanbanQuickSearch';
import { 
  useBoard, 
  useBoardColumns, 
  useBoardCards, 
  useMoveCard,
  useCreateCard,
  useDeleteCard,
  useArchiveCard,
  KanbanCard,
} from '@/hooks/useKanban';
import KanbanColumn from './KanbanColumn';
import DesignKanbanColumn from './DesignKanbanColumn';
import VideoKanbanColumn from './VideoKanbanColumn';
import CreateCardModal from './CreateCardModal';
import CreateDesignCardModal from './CreateDesignCardModal';
import CreateVideoCardModal from './CreateVideoCardModal';
import CardDetailModal from './CardDetailModal';
import JustificationModal from '@/components/shared/JustificationModal';
import ClientRegistrationBoard from '@/components/client-registration/ClientRegistrationBoard';
import AtrizesKanbanBoard from '@/components/atrizes/AtrizesKanbanBoard';
import ProdutoraKanbanBoard from '@/components/produtora/ProdutoraKanbanBoard';
import { toast } from 'sonner';
import { useAddJustification } from '@/hooks/useTaskJustification';
import { 
  canCreateDesignCard, 
  canMoveDesignCard, 
  canArchiveDesignCard,
  useUpsertBriefing 
} from '@/hooks/useDesignKanban';
import {
  canCreateVideoCard,
  canMoveVideoCard,
  canArchiveVideoCard,
  useUpsertVideoBriefing,
} from '@/hooks/useVideoKanban';

interface KanbanBoardProps {
  boardSlug: string;
}

export default function KanbanBoard({ boardSlug }: KanbanBoardProps) {
  // Se for o board de cadastro de clientes, renderiza componente especial
  if (boardSlug === 'cadastro-novos-clientes') {
    return <ClientRegistrationBoard boardSlug={boardSlug} />;
  }

  // Se for o board de atrizes, renderiza componente especial
  if (boardSlug === 'atrizes' || boardSlug.includes('atrizes')) {
    return <AtrizesKanbanBoard />;
  }

  // Se for o board de produtora, renderiza componente especial
  if (boardSlug === 'produtora-board' || boardSlug === 'produtora') {
    return <ProdutoraKanbanBoard />;
  }

  return <StandardKanbanBoard boardSlug={boardSlug} />;
}

function StandardKanbanBoard({ boardSlug }: KanbanBoardProps) {
  const { canMoveFreely, user } = useAuth();
  const userRole = user?.role || null;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [isCardDetailOpen, setIsCardDetailOpen] = useState(false);
  const [justificationModal, setJustificationModal] = useState<{ open: boolean; card: KanbanCard | null }>({ open: false, card: null });

  const { data: board, isLoading: boardLoading } = useBoard(boardSlug);
  const { data: columns = [], isLoading: columnsLoading } = useBoardColumns(board?.id);
  const { data: cards = [] } = useBoardCards(board?.id);
  const moveCard = useMoveCard();
  const createCard = useCreateCard();
  const deleteCard = useDeleteCard();
  const archiveCard = useArchiveCard();
  const upsertBriefing = useUpsertBriefing();
  const upsertVideoBriefing = useUpsertVideoBriefing();
  const addJustification = useAddJustification('kanban_cards', ['cards', board?.id || '']);

  const isDesignBoard = boardSlug === 'design' || board?.slug === 'design';
  const isVideoBoard = boardSlug === 'editor-video' || board?.slug === 'editor-video';
  const isSpecialBoard = isDesignBoard || isVideoBoard;

  const designerColumns = useMemo(() => {
    return columns.filter(col => col.title.toUpperCase().startsWith('BY '));
  }, [columns]);

  const editorColumns = useMemo(() => {
    return columns.filter(col => col.title.toUpperCase().startsWith('BY '));
  }, [columns]);

  const canCreateCard = isDesignBoard 
    ? canCreateDesignCard(userRole) 
    : isVideoBoard 
      ? canCreateVideoCard(userRole) 
      : canMoveFreely;
  const canMove = isDesignBoard 
    ? canMoveDesignCard(userRole) 
    : isVideoBoard 
      ? canMoveVideoCard(userRole) 
      : canMoveFreely;
  const canDelete = isDesignBoard 
    ? canArchiveDesignCard(userRole) 
    : isVideoBoard 
      ? canArchiveVideoCard(userRole) 
      : canMoveFreely;

  const [filter, setFilter] = useState<KanbanFilter>('all');
  const [focusModeOn, setFocusModeOn] = useState(false);

  const filteredCards = useMemo(() => applyKanbanFilter(cards, filter), [cards, filter]);

  // Agrupa e ordena cards por coluna em O(n + k log k). Antes era recalculado
  // a cada render — problema real em boards com 500+ cards e keyboard nav.
  const cardsByColumn = useMemo(() => {
    const bucket: Record<string, KanbanCard[]> = {};
    for (const col of columns) bucket[col.id] = [];
    for (const card of filteredCards) {
      if (bucket[card.column_id]) bucket[card.column_id].push(card);
    }
    for (const key in bucket) {
      bucket[key].sort((a, b) => a.position - b.position);
    }
    return bucket;
  }, [columns, filteredCards]);

  const { isCollapsed, toggle: toggleCollapse } = useColumnCollapse(boardSlug);

  const visibleColumns = useMemo(() => {
    return isDesignBoard ? designerColumns : isVideoBoard ? editorColumns : columns;
  }, [isDesignBoard, isVideoBoard, designerColumns, editorColumns, columns]);

  const { focusedCardId } = useKanbanKeyboard({
    columns: visibleColumns,
    cardsByColumn,
    onOpenCard: (card) => {
      setSelectedCard(card);
      setIsCardDetailOpen(true);
    },
    onCreateCard: canCreateCard
      ? (columnId) => {
          setSelectedColumnId(columnId);
          setIsCreateModalOpen(true);
        }
      : undefined,
    onArchiveCard: canDelete ? (card) => handleArchiveCard(card) : undefined,
    onDeleteCard: canDelete ? (card) => handleDeleteCard(card) : undefined,
    onToggleFocusMode: () => setFocusModeOn(v => !v),
    enabled: !isSpecialBoard,
  });

  const columnsToRender = useMemo(() => {
    if (!focusModeOn || !focusedCardId) return visibleColumns;
    const focusedColumnId = cards.find(c => c.id === focusedCardId)?.column_id;
    if (!focusedColumnId) return visibleColumns;
    return visibleColumns.filter(c => c.id === focusedColumnId);
  }, [focusModeOn, focusedCardId, visibleColumns, cards]);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (!canMove) {
      toast.error('Sem permissão', { description: 'Você não tem permissão para mover cards.' });
      return;
    }
    if (!board) return;

    try {
      // For Design/Video boards, droppableId format is "columnId:statusId"
      if (isSpecialBoard) {
        const [sourceColumnId, sourceStatus] = source.droppableId.split(':');
        const [destColumnId, destStatus] = destination.droppableId.split(':');

        await moveCard.mutateAsync({
          cardId: draggableId,
          sourceColumnId,
          destinationColumnId: destColumnId,
          newPosition: destination.index,
          boardId: board.id,
          sourceStatus,
          destinationStatus: destStatus,
        });
      } else {
        await moveCard.mutateAsync({
          cardId: draggableId,
          sourceColumnId: source.droppableId,
          destinationColumnId: destination.droppableId,
          newPosition: destination.index,
          boardId: board.id,
        });
      }
    } catch {
      toast.error('Erro ao mover card');
    }
  }, [canMove, board, moveCard, isSpecialBoard]);

  const handleCreateCard = async (data: any) => {
    const columnId = data.column_id || selectedColumnId;
    if (!board || !columnId) return;

    try {
      const card = await createCard.mutateAsync({
        board_id: board.id,
        column_id: columnId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        due_date: data.due_date,
        status: data.status,
      });

      // Save briefing for design board
      if (isDesignBoard && data.briefing && card) {
        await upsertBriefing.mutateAsync({ cardId: card.id, briefing: data.briefing });
      }

      // Save briefing for video board
      if (isVideoBoard && data.briefing && card) {
        await upsertVideoBriefing.mutateAsync({ cardId: card.id, briefing: data.briefing });
      }

      setIsCreateModalOpen(false);
      setSelectedColumnId(null);
      toast.success(isSpecialBoard ? 'Demanda criada!' : 'Tarefa criada!');
    } catch {
      toast.error(isSpecialBoard ? 'Erro ao criar demanda' : 'Erro ao criar tarefa');
    }
  };

  const handleCardClick = (card: KanbanCard) => {
    setSelectedCard(card);
    setIsCardDetailOpen(true);
  };

  const handleDeleteCard = async (card?: KanbanCard) => {
    const cardToDelete = card || selectedCard;
    if (!cardToDelete || !board) return;
    try {
      await deleteCard.mutateAsync({ cardId: cardToDelete.id, boardId: board.id });
      if (selectedCard?.id === cardToDelete.id) {
        setIsCardDetailOpen(false);
        setSelectedCard(null);
      }
      toast.success('Tarefa excluída!');
    } catch {
      toast.error('Erro ao excluir tarefa');
    }
  };

  const handleArchiveCard = async (card?: KanbanCard) => {
    const cardToArchive = card || selectedCard;
    if (!cardToArchive || !board) return;
    try {
      await archiveCard.mutateAsync({ cardId: cardToArchive.id, boardId: board.id });
      if (selectedCard?.id === cardToArchive.id) {
        setIsCardDetailOpen(false);
        setSelectedCard(null);
      }
      toast.success('Tarefa arquivada!');
    } catch {
      toast.error('Erro ao arquivar tarefa');
    }
  };

  if (boardLoading || columnsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="font-display text-xl font-bold text-foreground">Quadro não encontrado</h2>
          <p className="text-muted-foreground mt-2">O quadro solicitado não existe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 flex items-center justify-between gap-4 border-b border-border bg-card/30 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground truncate">
            {board.name}
          </h2>
          {board.description && <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{board.description}</p>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <KanbanFilters cards={cards} value={filter} onChange={setFilter} />
          {focusModeOn && (
            <button
              onClick={() => setFocusModeOn(false)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/15 transition-colors"
              title="Sair do modo foco (F)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Modo foco
            </button>
          )}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 text-muted-foreground text-[11px] font-medium">
            <Command size={11} strokeWidth={2.5} />
            <span>
              <kbd className="px-1 rounded bg-background text-foreground/80 font-mono">C</kbd> criar ·{' '}
              <kbd className="px-1 rounded bg-background text-foreground/80 font-mono">F</kbd> foco ·{' '}
              <kbd className="px-1 rounded bg-background text-foreground/80 font-mono">⌘K</kbd> buscar
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-[11px] font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Tempo real
          </div>
          {canCreateCard && isSpecialBoard && (
            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-105 transition-all">
              <Plus size={16} />
              <span>Nova demanda</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-elegant">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 p-6 h-full">
            {columnsToRender.map((column, index) => (
              isDesignBoard ? (
                <DesignKanbanColumn
                  key={column.id}
                  column={column}
                  cards={cardsByColumn[column.id] || []}
                  index={index}
                  onAddCard={() => { setSelectedColumnId(column.id); setIsCreateModalOpen(true); }}
                  canAddCard={canCreateCard}
                  onCardClick={handleCardClick}
                  onArchiveCard={canDelete ? handleArchiveCard : undefined}
                  onDeleteCard={canDelete ? handleDeleteCard : undefined}
                  onJustifyCard={(card) => setJustificationModal({ open: true, card })}
                  isCollapsed={isCollapsed(column.id)}
                  onToggleCollapse={() => toggleCollapse(column.id)}
                />
              ) : isVideoBoard ? (
                <VideoKanbanColumn
                  key={column.id}
                  column={column}
                  cards={cardsByColumn[column.id] || []}
                  index={index}
                  onAddCard={() => { setSelectedColumnId(column.id); setIsCreateModalOpen(true); }}
                  canAddCard={canCreateCard}
                  onCardClick={handleCardClick}
                  onArchiveCard={canDelete ? handleArchiveCard : undefined}
                  onDeleteCard={canDelete ? handleDeleteCard : undefined}
                  onJustifyCard={(card) => setJustificationModal({ open: true, card })}
                  isCollapsed={isCollapsed(column.id)}
                  onToggleCollapse={() => toggleCollapse(column.id)}
                />
              ) : (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={cardsByColumn[column.id] || []}
                  index={index}
                  onAddCard={() => { setSelectedColumnId(column.id); setIsCreateModalOpen(true); }}
                  canAddCard={canCreateCard}
                  onCardClick={handleCardClick}
                  onArchiveCard={canDelete ? handleArchiveCard : undefined}
                  onDeleteCard={canDelete ? handleDeleteCard : undefined}
                  onJustifyCard={(card) => setJustificationModal({ open: true, card })}
                  isCollapsed={isCollapsed(column.id)}
                  onToggleCollapse={() => toggleCollapse(column.id)}
                  focusedCardId={focusedCardId}
                />
              )
            ))}
          </div>
        </DragDropContext>
      </div>

      {!canMove && (
        <div className="px-6 py-3 bg-muted/50 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">Você tem permissão de visualização neste quadro.</p>
        </div>
      )}

      {!isSpecialBoard && (
        <CreateCardModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setSelectedColumnId(null); }} onSubmit={handleCreateCard} isLoading={createCard.isPending} />
      )}

      {isDesignBoard && (
        <CreateDesignCardModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setSelectedColumnId(null); }} onSubmit={handleCreateCard} isLoading={createCard.isPending || upsertBriefing.isPending} designerColumns={designerColumns.map(c => ({ id: c.id, title: c.title }))} />
      )}

      {isVideoBoard && (
        <CreateVideoCardModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setSelectedColumnId(null); }} onSubmit={handleCreateCard} isLoading={createCard.isPending || upsertVideoBriefing.isPending} editorColumns={editorColumns.map(c => ({ id: c.id, title: c.title }))} />
      )}

      {selectedCard && board && (
        <CardDetailModal 
          card={selectedCard} 
          isOpen={isCardDetailOpen} 
          onClose={() => { setIsCardDetailOpen(false); setSelectedCard(null); }} 
          isDesignBoard={isDesignBoard} 
          isVideoBoard={isVideoBoard} 
          onDelete={canDelete ? () => handleDeleteCard() : undefined}
          onArchive={canDelete ? () => handleArchiveCard() : undefined}
          boardId={board.id}
        />
      )}

      {/* Global quick-search (⌘K / /) */}
      <KanbanQuickSearch
        cards={cards}
        columns={visibleColumns}
        onSelect={handleCardClick}
      />

      {/* Justification Modal */}
      <JustificationModal
        isOpen={justificationModal.open}
        onClose={() => setJustificationModal({ open: false, card: null })}
        onSubmit={async (justification) => {
          if (justificationModal.card) {
            await addJustification.mutateAsync({
              taskId: justificationModal.card.id,
              justification,
            });
          }
        }}
        taskTitle={justificationModal.card?.title}
        existingJustification={justificationModal.card?.justification}
        isPending={addJustification.isPending}
      />
    </div>
  );
}
