import { Droppable, Draggable } from '@hello-pangea/dnd';
import { AnimatePresence } from 'framer-motion';
import type { TechTask, TechTaskStatus } from '../types';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  column: TechTaskStatus;
  label: string;
  tasks: TechTask[];
  onOpenTask: (id: string) => void;
}

export function KanbanColumn({ column, label, tasks, onOpenTask }: KanbanColumnProps) {
  return (
    <div className="flex flex-col flex-1 min-w-[260px] max-w-[340px]">
      {/* Column header */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[var(--mtech-border)]">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mtech-text-muted)]">
          {label}
        </span>
        <span
          className="text-[11px] text-[var(--mtech-text-subtle)]"
          data-mono
        >
          {tasks.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={column}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex flex-col gap-2 flex-1 rounded-[var(--mtech-radius-md)] p-1 transition-colors"
            style={{
              minHeight: 120,
              background: snapshot.isDraggingOver
                ? 'var(--mtech-accent-muted)'
                : 'transparent',
            }}
          >
            <AnimatePresence initial={false}>
              {tasks.map((task, index) => (
                <Draggable key={task.id} draggableId={task.id} index={index}>
                  {(dragProvided) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                    >
                      <TaskCard
                        task={task}
                        onClick={() => onOpenTask(task.id)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
            </AnimatePresence>
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
