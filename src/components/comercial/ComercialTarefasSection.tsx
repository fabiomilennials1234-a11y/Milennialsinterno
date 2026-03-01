import { useState } from 'react';
import { Plus, CheckCircle2, Circle, Clock, Trash2, Archive, MoreVertical, AlertTriangle, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useComercialTasks,
  useCreateComercialTask,
  useUpdateComercialTaskStatus,
  useDeleteComercialTask,
  useArchiveComercialTask,
  ComercialTask
} from '@/hooks/useComercialTasks';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';

interface ComercialTarefasSectionProps {
  taskType: 'daily' | 'weekly';
}

const STATUS_COLUMNS = [
  { id: 'todo', label: 'A Fazer', color: 'bg-gray-100 dark:bg-gray-800' },
  { id: 'doing', label: 'Fazendo', color: 'bg-blue-50 dark:bg-blue-950/20' },
  { id: 'done', label: 'Feito', color: 'bg-green-50 dark:bg-green-950/20' },
];

function getDeadlineInfo(dueDate?: string, status?: string) {
  if (!dueDate || status === 'done') return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffHours <= 0) {
    const overdueHours = Math.abs(diffHours);
    const overdueDays = Math.floor(overdueHours / 24);
    return {
      label: overdueDays > 0 ? `Atrasada ${overdueDays}d` : `Atrasada ${overdueHours}h`,
      isOverdue: true,
      isUrgent: true,
    };
  }
  if (diffHours <= 6) {
    return { label: `${diffHours}h restantes`, isOverdue: false, isUrgent: true };
  }
  if (diffHours <= 24) {
    return { label: `${diffHours}h restantes`, isOverdue: false, isUrgent: false };
  }
  const diffDays = Math.ceil(diffHours / 24);
  return { label: `${diffDays}d restantes`, isOverdue: false, isUrgent: false };
}

function TaskCard({ task, onStatusChange, onDelete, onArchive }: {
  task: ComercialTask;
  onStatusChange: (status: 'todo' | 'doing' | 'done') => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const statusIcon = {
    todo: <Circle size={14} className="text-gray-400" />,
    doing: <Clock size={14} className="text-blue-500" />,
    done: <CheckCircle2 size={14} className="text-green-500" />,
  };

  const deadlineInfo = task.is_auto_generated ? getDeadlineInfo(task.due_date, task.status) : null;

  return (
    <div className={cn(
      "p-3 bg-card rounded-lg border shadow-sm",
      deadlineInfo?.isOverdue ? "border-destructive/60 bg-destructive/5" : "border-subtle"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {statusIcon[task.status]}
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {task.is_auto_generated && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Auto</Badge>
              )}
              {deadlineInfo && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 gap-0.5",
                    deadlineInfo.isOverdue
                      ? "border-destructive text-destructive bg-destructive/10 animate-pulse"
                      : deadlineInfo.isUrgent
                      ? "border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/20"
                      : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {deadlineInfo.isOverdue ? (
                    <AlertTriangle size={8} className="mr-0.5" />
                  ) : (
                    <Timer size={8} className="mr-0.5" />
                  )}
                  {deadlineInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {task.status !== 'todo' && (
              <DropdownMenuItem onClick={() => onStatusChange('todo')}>
                <Circle size={12} className="mr-2" /> A Fazer
              </DropdownMenuItem>
            )}
            {task.status !== 'doing' && (
              <DropdownMenuItem onClick={() => onStatusChange('doing')}>
                <Clock size={12} className="mr-2" /> Fazendo
              </DropdownMenuItem>
            )}
            {task.status !== 'done' && (
              <DropdownMenuItem onClick={() => onStatusChange('done')}>
                <CheckCircle2 size={12} className="mr-2" /> Feito
              </DropdownMenuItem>
            )}
            {!task.is_auto_generated && (
              <DropdownMenuItem onClick={onArchive}>
                <Archive size={12} className="mr-2" /> Arquivar
              </DropdownMenuItem>
            )}
            {!task.is_auto_generated && (
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 size={12} className="mr-2" /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function ComercialTarefasSection({ taskType }: ComercialTarefasSectionProps) {
  const { data: tasks = [], isLoading } = useComercialTasks(taskType);
  const createTask = useCreateComercialTask();
  const updateStatus = useUpdateComercialTaskStatus();
  const deleteTask = useDeleteComercialTask();
  const archiveTask = useArchiveComercialTask();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    await createTask.mutateAsync({
      title: newTaskTitle,
      task_type: taskType,
      status: 'todo',
    });
    
    setNewTaskTitle('');
    setIsAdding(false);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as 'todo' | 'doing' | 'done';
    
    updateStatus.mutate({ taskId, status: newStatus });
  };

  const getTasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add Task */}
      {isAdding ? (
        <div className="flex gap-2">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Título da tarefa..."
            className="h-8 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            autoFocus
          />
          <Button size="sm" onClick={handleAddTask} disabled={createTask.isPending}>
            <Plus size={14} />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setIsAdding(true)}
        >
          <Plus size={14} className="mr-1" />
          Nova Tarefa
        </Button>
      )}

      {/* Kanban Columns */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {STATUS_COLUMNS.map((column) => (
            <div key={column.id} className={`p-2 rounded-lg ${column.color}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{column.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {getTasksByStatus(column.id).length}
                </Badge>
              </div>
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[40px] space-y-2 ${snapshot.isDraggingOver ? 'bg-primary/5 rounded' : ''}`}
                  >
                    {getTasksByStatus(column.id).map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <TaskCard
                              task={task}
                              onStatusChange={(status) => updateStatus.mutate({ taskId: task.id, status })}
                              onDelete={() => deleteTask.mutate(task.id)}
                              onArchive={() => archiveTask.mutate(task.id)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
