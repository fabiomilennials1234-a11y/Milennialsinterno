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
      <div className="flex items-center justify-center h-64 text-[var(--mtech-text-muted)] text-sm">
        Carregando...
      </div>
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
