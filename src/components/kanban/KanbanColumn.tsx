import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
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
}

const colorMap: Record<string, string> = {
  slate: 'border-t-slate-400',
  info: 'border-t-info',
  warning: 'border-t-warning',
  purple: 'border-t-purple-500',
  success: 'border-t-success',
  danger: 'border-t-danger',
  primary: 'border-t-primary',
};

export default function KanbanColumn({ 
  column, 
  cards, 
  index, 
  onAddCard, 
  canAddCard, 
  onCardClick,
  onArchiveCard,
  onDeleteCard,
  onJustifyCard 
}: KanbanColumnProps) {
  const borderColor = colorMap[column.color || 'slate'] || 'border-t-border';

  return (
    <div 
      className={cn(
        "kanban-column min-w-[300px] max-w-[300px] flex flex-col",
        "bg-muted/30 rounded-2xl border border-border",
        "border-t-4",
        borderColor
      )}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
            {column.title}
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {cards.length}
          </span>
        </div>
      </div>

      {/* Cards Container */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 p-3 space-y-3 overflow-y-auto scrollbar-elegant min-h-[200px]",
              snapshot.isDraggingOver && "bg-primary/5"
            )}
          >
            {cards.map((card, cardIndex) => (
              <Draggable key={card.id} draggableId={card.id} index={cardIndex}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={cn(
                      snapshot.isDragging && "rotate-2 scale-105"
                    )}
                  >
                    <KanbanCardItem 
                      card={card} 
                      onClick={() => onCardClick?.(card)}
                      onArchive={onArchiveCard ? () => onArchiveCard(card) : undefined}
                      onDelete={onDeleteCard ? () => onDeleteCard(card) : undefined}
                      onJustify={onJustifyCard ? () => onJustifyCard(card) : undefined}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add Card Button */}
      {canAddCard && (
        <div className="p-3 border-t border-border">
          <button 
            onClick={onAddCard}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                     text-muted-foreground hover:text-foreground hover:bg-muted
                     transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Nova Tarefa
          </button>
        </div>
      )}
    </div>
  );
}
