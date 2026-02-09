import { useState } from 'react';
import { 
  useDepartmentTasks, 
  useCreateDepartmentTask, 
  useUpdateDepartmentTaskStatus,
  useArchiveDepartmentTask,
  useDeleteDepartmentTask,
  DepartmentTask
} from '@/hooks/useDepartmentTasks';
import { useAddJustification } from '@/hooks/useTaskJustification';
import { Plus, MoreHorizontal, Calendar, Trash2, Archive, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { fireCelebration } from '@/lib/confetti';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import JustificationModal from '@/components/shared/JustificationModal';

interface Props {
  department: string;
  type?: 'daily' | 'weekly';
}

const STATUSES = [
  { id: 'todo', label: 'A fazer', headerClass: 'kanban-header-todo', borderClass: 'card-border-blue' },
  { id: 'doing', label: 'Fazendo', headerClass: 'kanban-header-doing', borderClass: 'card-border-orange' },
  { id: 'done', label: 'Feitas', headerClass: 'kanban-header-done', borderClass: 'card-border-green' },
];

export default function DepartmentTarefasSection({ department, type = 'daily' }: Props) {
  const { data: tasks = [], isLoading } = useDepartmentTasks(department, type);
  const createTask = useCreateDepartmentTask(department);
  const updateStatus = useUpdateDepartmentTaskStatus(department);
  const archiveTask = useArchiveDepartmentTask(department);
  const deleteTask = useDeleteDepartmentTask(department);
  const addJustification = useAddJustification('department_tasks', ['department-tasks', department, type]);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [justificationModal, setJustificationModal] = useState<{ open: boolean; task?: DepartmentTask }>({ open: false });

  const handleAddTask = async (statusId: string) => {
    if (!newTaskTitle.trim()) return;
    await createTask.mutateAsync({
      title: newTaskTitle,
      task_type: type,
    });
    setNewTaskTitle('');
    setIsAdding(null);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as 'todo' | 'doing' | 'done';
    
    // Fire confetti when moving to done
    if (newStatus === 'done' && result.source.droppableId !== 'done') {
      fireCelebration();
    }
    
    updateStatus.mutate({ taskId, status: newStatus });
  };

  const handleStatusChange = (taskId: string, newStatus: 'todo' | 'doing' | 'done') => {
    if (newStatus === 'done') {
      fireCelebration();
    }
    updateStatus.mutate({ taskId, status: newStatus });
  };

  const getTasksByStatus = (status: string) => 
    tasks.filter(t => t.status === status);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {STATUSES.map(status => {
          const statusTasks = getTasksByStatus(status.id);
          const hasDoneTasks = status.id === 'done' && statusTasks.length > 0;
          
          return (
          <div key={status.id}>
            {/* Status Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={status.headerClass}>
                  {status.label}
                </span>
                <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
                  {statusTasks.length}
                </span>
              </div>
              
              {hasDoneTasks && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  onClick={() => {
                    statusTasks.forEach(task => archiveTask.mutate(task.id));
                  }}
                  disabled={archiveTask.isPending}
                >
                  <Archive size={12} />
                  Arquivar concluídas
                </Button>
              )}
            </div>

            {/* Tasks Droppable */}
            <Droppable droppableId={status.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'min-h-[60px] rounded-xl p-2 transition-all duration-200',
                    snapshot.isDraggingOver && 'bg-primary/10 ring-2 ring-primary/30'
                  )}
                >
                  <div className="space-y-2">
                    {getTasksByStatus(status.id).map((task, index) => {
                      const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
                      const isDone = task.status === 'done';
                      const hasJustification = !!(task as any).justification;
                      const needsJustification = isOverdue && !hasJustification;

                      return (
                        <Draggable 
                          key={task.id} 
                          draggableId={task.id} 
                          index={index}
                          isDragDisabled={isDone}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                'kanban-card p-4 group border-l-4',
                                status.borderClass,
                                isDone && 'opacity-60',
                                isOverdue && 'border-l-danger bg-danger/5',
                                snapshot.isDragging && 'dragging'
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-2">
                                  <p className={cn(
                                    "text-sm font-medium",
                                    isDone && "line-through text-muted-foreground"
                                  )}>
                                    {task.title}
                                  </p>
                                  
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}
                                  
                                  {task.due_date && (
                                    <div className={cn(
                                      "flex items-center gap-1.5 mt-2 text-xs",
                                      isOverdue ? "text-danger" : "text-muted-foreground"
                                    )}>
                                      <Calendar size={12} />
                                      <span>
                                        {format(new Date(task.due_date), 'dd/MM HH:mm', { locale: ptBR })}
                                        {isOverdue && ' (Atrasado!)'}
                                      </span>
                                    </div>
                                  )}

                                  {/* Justification section */}
                                  {isOverdue && (
                                    <div className="mt-2">
                                      {hasJustification ? (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-warning/10 text-warning text-xs rounded-md cursor-pointer">
                                                <AlertTriangle size={12} />
                                                <span className="font-medium">Justificado</span>
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs">
                                              <p className="text-xs">{(task as any).justification}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                       ) : null}

                                    </div>
                                  )}
                                </div>
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 -m-1 hover:bg-muted rounded-lg">
                                      <MoreHorizontal size={14} className="text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-popover border-subtle">
                                    {STATUSES.filter(s => s.id !== status.id).map(s => (
                                      <DropdownMenuItem
                                        key={s.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(task.id, s.id as 'todo' | 'doing' | 'done');
                                        }}
                                      >
                                        <div className={cn('w-2.5 h-2.5 rounded-full mr-2',
                                          s.id === 'todo' && 'bg-info',
                                          s.id === 'doing' && 'bg-warning',
                                          s.id === 'done' && 'bg-success'
                                        )} />
                                        Mover para {s.label}
                                      </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        archiveTask.mutate(task.id);
                                      }}
                                      className="text-muted-foreground"
                                    >
                                      <Archive size={14} className="mr-2" />
                                      Arquivar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteTask.mutate(task.id);
                                      }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 size={14} className="mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>

                  {/* Add Task Input */}
                  {isAdding === status.id ? (
                    <div className="mt-2 space-y-2">
                      <Input
                        placeholder="Nova tarefa..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTask(status.id);
                          if (e.key === 'Escape') setIsAdding(null);
                        }}
                        autoFocus
                        className="h-9"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAddTask(status.id)}
                          disabled={createTask.isPending}
                          className="flex-1"
                        >
                          Adicionar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsAdding(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    status.id === 'todo' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => setIsAdding(status.id)}
                      >
                        <Plus size={14} />
                        Adicionar tarefa
                      </Button>
                    )
                  )}
                </div>
              )}
            </Droppable>
          </div>
        );
        })}
      </div>

      {/* Justification Modal */}
      <JustificationModal
        isOpen={justificationModal.open}
        onClose={() => setJustificationModal({ open: false })}
        onSubmit={async (justification) => {
          if (justificationModal.task) {
            await addJustification.mutateAsync({
              taskId: justificationModal.task.id,
              justification,
            });
          }
        }}
        taskTitle={justificationModal.task?.title}
        existingJustification={(justificationModal.task as any)?.justification}
        isPending={addJustification.isPending}
      />
    </DragDropContext>
  );
}
