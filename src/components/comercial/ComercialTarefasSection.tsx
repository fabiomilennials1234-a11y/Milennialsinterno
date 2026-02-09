import { useState } from 'react';
import { Plus, CheckCircle2, Circle, Clock, Trash2, MoreVertical } from 'lucide-react';
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
  ComercialTask 
} from '@/hooks/useComercialTasks';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface ComercialTarefasSectionProps {
  taskType: 'daily' | 'weekly';
}

const STATUS_COLUMNS = [
  { id: 'todo', label: 'A Fazer', color: 'bg-gray-100 dark:bg-gray-800' },
  { id: 'doing', label: 'Fazendo', color: 'bg-blue-50 dark:bg-blue-950/20' },
  { id: 'done', label: 'Feito', color: 'bg-green-50 dark:bg-green-950/20' },
];

function TaskCard({ task, onStatusChange, onDelete }: { 
  task: ComercialTask; 
  onStatusChange: (status: 'todo' | 'doing' | 'done') => void;
  onDelete: () => void;
}) {
  const statusIcon = {
    todo: <Circle size={14} className="text-gray-400" />,
    doing: <Clock size={14} className="text-blue-500" />,
    done: <CheckCircle2 size={14} className="text-green-500" />,
  };

  return (
    <div className="p-3 bg-card rounded-lg border border-subtle shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {statusIcon[task.status]}
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </p>
            {task.is_auto_generated && (
              <Badge variant="secondary" className="text-xs mt-1">Auto</Badge>
            )}
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
