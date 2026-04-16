import { useState, useCallback, useMemo } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTechTasks } from '../hooks/useTechTasks';
import { useTechTimer } from '../hooks/useTechTimer';
import { KANBAN_COLUMNS, STATUS_LABEL_PT } from '../lib/statusLabels';
import { canDragToColumn } from '../lib/permissions';
import { KanbanColumn } from '../components/KanbanColumn';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import type { TechTask, TechTaskStatus } from '../types';

export function KanbanTab() {
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useTechTasks();
  const timer = useTechTimer();

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Group tasks by status into kanban columns
  const tasksByColumn = useMemo(() => {
    const map: Record<TechTaskStatus, TechTask[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    };
    for (const task of tasks) {
      map[task.status]?.push(task);
    }
    return map;
  }, [tasks]);

  // Handle drag-and-drop transitions
  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const sourceCol = source.droppableId as TechTaskStatus;
      const destCol = destination.droppableId as TechTaskStatus;
      const task = tasks.find((t) => t.id === draggableId);
      if (!task) return;

      // Permission check
      if (
        !canDragToColumn(
          user?.id ?? null,
          user?.role ?? null,
          task,
          [], // collaborator IDs — not loaded inline; permissions degrade gracefully
          destCol,
          sourceCol,
        )
      ) {
        return;
      }

      // Map column transitions to RPC calls
      if (sourceCol === 'TODO' && destCol === 'IN_PROGRESS') {
        timer.start.mutate(draggableId);
      } else if (sourceCol === 'IN_PROGRESS' && destCol === 'REVIEW') {
        timer.sendToReview.mutate(draggableId);
      } else if (sourceCol === 'REVIEW' && destCol === 'DONE') {
        timer.approve.mutate(draggableId);
      } else if (sourceCol === 'REVIEW' && destCol === 'IN_PROGRESS') {
        timer.reject.mutate(draggableId);
      }
    },
    [tasks, user, timer],
  );

  const handleOpenTask = useCallback((id: string) => {
    setOpenTaskId(id);
  }, []);

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-20 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
          <div className="h-8 w-28 rounded-md bg-[var(--mtech-surface-elev)] animate-pulse" />
        </div>
        <div className="flex gap-5">
          {[0, 1, 2, 3].map((col) => (
            <div key={col} className="flex-1 min-w-[260px] max-w-[340px]">
              <div className="h-4 w-16 rounded bg-[var(--mtech-surface-elev)] animate-pulse mb-4" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 - col % 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-3 space-y-2"
                  >
                    <div className="h-3 w-14 rounded-full bg-[var(--mtech-surface-elev)] animate-pulse" />
                    <div className="h-4 w-3/4 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-[var(--mtech-text)]">Kanban</h2>
        <Button
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 font-semibold gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nova Task
        </Button>
      </div>

      {/* Kanban board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-5 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col}
              column={col}
              label={STATUS_LABEL_PT[col]}
              tasks={tasksByColumn[col]}
              onOpenTask={handleOpenTask}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Modals */}
      <TaskFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          open={!!openTaskId}
          onOpenChange={(open) => {
            if (!open) setOpenTaskId(null);
          }}
        />
      )}
    </>
  );
}
