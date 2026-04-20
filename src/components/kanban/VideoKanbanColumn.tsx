import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, SlidersHorizontal, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KanbanColumn as KanbanColumnType, KanbanCard } from '@/hooks/useKanban';
import KanbanCardItem from './KanbanCardItem';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { VIDEO_STATUSES } from '@/hooks/useVideoKanban';

interface VideoKanbanColumnProps {
  column: KanbanColumnType;
  cards: KanbanCard[];
  index: number;
  onAddCard?: () => void;
  canAddCard?: boolean;
  onCardClick?: (card: KanbanCard) => void;
  onArchiveCard?: (card: KanbanCard) => void;
  onDeleteCard?: (card: KanbanCard) => void;
  onJustifyCard?: (card: KanbanCard) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const dotColorMap: Record<string, string> = {
  slate: 'bg-muted-foreground/50',
  info: 'bg-info',
  blue: 'bg-info',
  warning: 'bg-warning',
  purple: 'bg-purple-500',
  success: 'bg-success',
  danger: 'bg-danger',
  primary: 'bg-primary',
  orange: 'bg-warning',
  green: 'bg-success',
};

const toSentence = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export default function VideoKanbanColumn({
  column,
  cards,
  index,
  onAddCard,
  canAddCard,
  onCardClick,
  onArchiveCard,
  onDeleteCard,
  onJustifyCard,
  isCollapsed: isColumnCollapsed = false,
  onToggleCollapse,
}: VideoKanbanColumnProps) {
  const dotColor = dotColorMap[column.color || 'slate'] || 'bg-muted-foreground/50';
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (statusId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [statusId]: !prev[statusId]
    }));
  };

  const cardsByStatus = VIDEO_STATUSES.reduce((acc, status) => {
    acc[status.id] = cards.filter(card => card.status === status.id);
    return acc;
  }, {} as Record<string, KanbanCard[]>);

  const unassignedCards = cards.filter(
    card => !card.status || !VIDEO_STATUSES.some(s => s.id === card.status)
  );
  if (unassignedCards.length > 0) {
    cardsByStatus['a_fazer'] = [...(cardsByStatus['a_fazer'] || []), ...unassignedCards];
  }

  if (isColumnCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className={cn(
          "kanban-column kanban-column-collapsed flex flex-col items-center justify-start py-3 gap-2",
          "bg-muted/30 rounded-2xl border border-border",
          "hover:bg-muted/50 transition-colors"
        )}
        title={`Expandir ${column.title}`}
      >
        <ChevronsRight size={14} className="text-muted-foreground shrink-0" strokeWidth={2.25} />
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
        <span className="kanban-column-title-vertical text-[12px] font-semibold tracking-[-0.01em] text-foreground/90 flex-1 py-2">
          {column.title}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground/80 tabular-nums">
          {cards.length}
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "kanban-column min-w-[340px] max-w-[340px] flex flex-col",
        "bg-muted/30 rounded-2xl border border-border"
      )}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
          <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-foreground truncate">
            {column.title}
          </h3>
          <span className="text-[12px] font-medium text-muted-foreground/70 tabular-nums ml-0.5">
            {cards.length}
          </span>
          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            <button
              className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Filtrar"
              aria-label="Filtrar"
              onClick={(e) => e.stopPropagation()}
            >
              <SlidersHorizontal size={13} strokeWidth={2.25} />
            </button>
            {canAddCard && (
              <button
                onClick={onAddCard}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Adicionar"
                aria-label="Adicionar"
              >
                <Plus size={14} strokeWidth={2.5} />
              </button>
            )}
            <button
              className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Mais ações"
              aria-label="Mais"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal size={14} strokeWidth={2.25} />
            </button>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Recolher"
                aria-label="Recolher"
              >
                <ChevronsLeft size={13} strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-elegant kanban-scroll-fade">
        {VIDEO_STATUSES.map((status) => {
          const statusCards = cardsByStatus[status.id] || [];
          const isSectionCollapsed = collapsedSections[status.id];

          return (
            <div key={status.id} className="border-b border-border/40 last:border-b-0">
              <button
                onClick={() => toggleSection(status.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors"
              >
                {isSectionCollapsed ? (
                  <ChevronRight size={13} className="text-muted-foreground/70 shrink-0" />
                ) : (
                  <ChevronDown size={13} className="text-muted-foreground/70 shrink-0" />
                )}
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.color)} />
                <span className="text-[12px] font-medium text-foreground/80">
                  {toSentence(status.label)}
                </span>
                <span className="ml-auto text-[11px] font-medium text-muted-foreground/70 tabular-nums">
                  {statusCards.length}
                </span>
              </button>

              {!isSectionCollapsed && (
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
                      <AnimatePresence initial={false}>
                        {statusCards.map((card, cardIndex) => (
                          <Draggable key={card.id} draggableId={card.id} index={cardIndex}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(snapshot.isDragging && "kanban-card-dragging")}
                              >
                                <motion.div
                                  layout="position"
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.6 }}
                                >
                                  <KanbanCardItem
                                    card={card}
                                    onClick={() => onCardClick?.(card)}
                                    onArchive={onArchiveCard ? () => onArchiveCard(card) : undefined}
                                    onDelete={onDeleteCard ? () => onDeleteCard(card) : undefined}
                                    onJustify={onJustifyCard ? () => onJustifyCard(card) : undefined}
                                  />
                                </motion.div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </AnimatePresence>
                      {provided.placeholder}
                      {statusCards.length === 0 && snapshot.isDraggingOver && (
                        <div className="kanban-drop-placeholder" />
                      )}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          );
        })}
      </div>

      {canAddCard && (
        <div className="p-3 border-t border-border/60">
          <button
            onClick={onAddCard}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                     text-[12px] font-medium text-muted-foreground
                     hover:text-foreground hover:bg-muted/60
                     transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} />
            Nova demanda
          </button>
        </div>
      )}
    </div>
  );
}
