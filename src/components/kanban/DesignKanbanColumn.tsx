import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { KanbanColumn as KanbanColumnType, KanbanCard } from '@/hooks/useKanban';
import KanbanCardItem from './KanbanCardItem';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface DesignKanbanColumnProps {
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

// Design card statuses (subcategories within each designer column)
const DESIGN_STATUSES = [
  { id: 'a_fazer', label: 'A FAZER', color: 'bg-blue-500' },
  { id: 'fazendo', label: 'FAZENDO', color: 'bg-orange-500' },
  { id: 'arrumar', label: 'ARRUMAR', color: 'bg-red-500' },
  { id: 'para_aprovacao', label: 'PARA APROVAÇÃO', color: 'bg-purple-500' },
  { id: 'aprovado', label: 'APROVADO', color: 'bg-green-500' },
] as const;

const colorMap: Record<string, string> = {
  slate: 'border-t-slate-400',
  info: 'border-t-info',
  blue: 'border-t-blue-500',
  warning: 'border-t-warning',
  purple: 'border-t-purple-500',
  success: 'border-t-success',
  danger: 'border-t-danger',
  primary: 'border-t-primary',
  orange: 'border-t-orange-500',
  green: 'border-t-green-500',
};

export default function DesignKanbanColumn({ 
  column, 
  cards, 
  index, 
  onAddCard, 
  canAddCard, 
  onCardClick,
  onArchiveCard,
  onDeleteCard,
  onJustifyCard
}: DesignKanbanColumnProps) {
  const borderColor = colorMap[column.color || 'slate'] || 'border-t-border';
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (statusId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [statusId]: !prev[statusId]
    }));
  };

  // Group cards by their status
  const cardsByStatus = DESIGN_STATUSES.reduce((acc, status) => {
    acc[status.id] = cards.filter(card => card.status === status.id);
    return acc;
  }, {} as Record<string, KanbanCard[]>);

  // Cards without status go to "a_fazer" by default
  const unassignedCards = cards.filter(
    card => !card.status || !DESIGN_STATUSES.some(s => s.id === card.status)
  );
  if (unassignedCards.length > 0) {
    cardsByStatus['a_fazer'] = [...(cardsByStatus['a_fazer'] || []), ...unassignedCards];
  }

  return (
    <div 
      className={cn(
        "kanban-column min-w-[340px] max-w-[340px] flex flex-col",
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

      {/* Subcategories Container */}
      <div className="flex-1 overflow-y-auto scrollbar-elegant">
        {DESIGN_STATUSES.map((status) => {
          const statusCards = cardsByStatus[status.id] || [];
          const isCollapsed = collapsedSections[status.id];
          
          return (
            <div key={status.id} className="border-b border-border/50 last:border-b-0">
              {/* Status Header */}
              <button
                onClick={() => toggleSection(status.id)}
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
              )}
            </div>
          );
        })}
      </div>

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
            Nova Demanda
          </button>
        </div>
      )}
    </div>
  );
}
