import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, ChevronsLeft, ChevronsRight, SlidersHorizontal, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KanbanColumn as KanbanColumnType, KanbanCard } from '@/hooks/useKanban';
import KanbanCardItem from './KanbanCardItem';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
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
  focusedCardId?: string | null;
}

const dotColorMap: Record<string, string> = {
  slate: 'bg-muted-foreground/50',
  info: 'bg-info',
  warning: 'bg-warning',
  purple: 'bg-purple-500',
  success: 'bg-success',
  danger: 'bg-danger',
  primary: 'bg-primary',
};

// Detecta emoji/ícone no início do título (ex: "📞 Janela de Ligação").
function splitLeadingEmoji(title: string): { emoji: string | null; rest: string } {
  // Regex que pega cluster de emoji no início.
  const match = title.match(/^(\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*)\s*(.*)/u);
  if (match) return { emoji: match[1], rest: match[2] || title };
  return { emoji: null, rest: title };
}

export default function KanbanColumn({
  column,
  cards,
  index,
  onAddCard,
  canAddCard,
  onCardClick,
  onArchiveCard,
  onDeleteCard,
  onJustifyCard,
  isCollapsed = false,
  onToggleCollapse,
  focusedCardId,
}: KanbanColumnProps) {
  const dotColor = dotColorMap[column.color || 'slate'] || 'bg-muted-foreground/50';
  const { emoji, rest } = splitLeadingEmoji(column.title);

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className={cn(
          "kanban-column kanban-column-collapsed flex flex-col items-center justify-start py-3 gap-2",
          "bg-card rounded-2xl border border-border/70",
          "hover:bg-muted/40 transition-colors"
        )}
        title={`Expandir ${column.title}`}
      >
        <ChevronsRight size={14} className="text-muted-foreground shrink-0" strokeWidth={2.25} />
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
        <span className="kanban-column-title-vertical text-[12px] font-semibold tracking-[-0.01em] text-foreground/90 flex-1 py-2">
          {rest}
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
        "kanban-column min-w-[320px] max-w-[320px] flex flex-col",
        "bg-card rounded-2xl border border-border/70"
      )}
    >
      {/* Column Header — rico, estilo lista de pipeline */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
          {emoji && (
            <span className="text-[14px] leading-none select-none" aria-hidden>
              {emoji}
            </span>
          )}
          <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-foreground truncate">
            {rest}
          </h3>
          <span className="text-[12px] font-medium text-muted-foreground/70 tabular-nums ml-0.5">
            {cards.length}
          </span>

          {/* Ações à direita — sempre visíveis, discretas */}
          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            <button
              className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Filtrar nesta coluna"
              aria-label="Filtrar"
              onClick={(e) => e.stopPropagation()}
            >
              <SlidersHorizontal size={13} strokeWidth={2.25} />
            </button>
            {canAddCard && (
              <button
                onClick={onAddCard}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Adicionar card"
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
                title="Recolher coluna"
                aria-label="Recolher"
              >
                <ChevronsLeft size={13} strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards Container */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 px-3 pb-3 pt-1 space-y-2.5 overflow-y-auto scrollbar-elegant min-h-[200px] transition-colors kanban-scroll-fade",
              snapshot.isDraggingOver && "kanban-droppable-active"
            )}
          >
            <AnimatePresence initial={false}>
              {cards.map((card, cardIndex) => (
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
                          isFocused={focusedCardId === card.id}
                        />
                      </motion.div>
                    </div>
                  )}
                </Draggable>
              ))}
            </AnimatePresence>
            {provided.placeholder}
            {cards.length === 0 && snapshot.isDraggingOver && (
              <div className="kanban-drop-placeholder" />
            )}
            {cards.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50 select-none">
                <div className="w-8 h-8 rounded-lg border border-dashed border-border mb-2" />
                <p className="text-[11px]">Nenhum card aqui</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
