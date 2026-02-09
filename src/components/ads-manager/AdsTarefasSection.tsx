import { useState } from 'react';
import { useAdsTasks, useCreateTask, useUpdateTaskStatus, useUpdateTask, useArchiveTask, useDeleteTask, AdsTask } from '@/hooks/useAdsManager';
import { 
  useOnboardingTasks, 
  useUpdateOnboardingTaskStatus, 
  useArchiveOnboardingTask, 
  useDeleteOnboardingTask,
  useArchivedOnboardingTasks,
  useUnarchiveOnboardingTask,
  useCanArchiveTasks
} from '@/hooks/useOnboardingTasks';

import { useAddJustification } from '@/hooks/useTaskJustification';
import { Plus, MoreHorizontal, Calendar, Target, Timer, Archive, CheckCircle, Trash2, ArchiveRestore, Eye, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { fireCelebration } from '@/lib/confetti';
import { format, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import AdsCardDetailModal from './AdsCardDetailModal';
import AdsCardDescriptionPreview from './AdsCardDescriptionPreview';
import JustificationModal from '@/components/shared/JustificationModal';

interface Props {
  type: 'daily' | 'weekly';
  compact?: boolean;
}

const STATUSES = [
  { id: 'todo', label: 'A fazer', headerClass: 'kanban-header-todo', borderClass: 'card-border-blue' },
  { id: 'doing', label: 'Fazendo', headerClass: 'kanban-header-doing', borderClass: 'card-border-orange' },
  { id: 'done', label: 'Feitas', headerClass: 'kanban-header-done', borderClass: 'card-border-green' },
];

export default function AdsTarefasSection({ type, compact }: Props) {
  const { data: tasks = [], isLoading } = useAdsTasks(type);
  const { data: onboardingTasks = [] } = useOnboardingTasks();
  const { data: archivedOnboardingTasks = [] } = useArchivedOnboardingTasks();
  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const updateTask = useUpdateTask();
  const archiveTask = useArchiveTask();
  const deleteTask = useDeleteTask();
  const updateOnboardingStatus = useUpdateOnboardingTaskStatus();
  const archiveOnboardingTask = useArchiveOnboardingTask();
  const deleteOnboardingTask = useDeleteOnboardingTask();
  const unarchiveOnboardingTask = useUnarchiveOnboardingTask();
  const canArchive = useCanArchiveTasks();
  const addAdsJustification = useAddJustification('ads_tasks', ['ads-tasks', type]);
  const addOnboardingJustification = useAddJustification('onboarding_tasks', ['onboarding-tasks']);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<AdsTask | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [justificationModal, setJustificationModal] = useState<{ 
    open: boolean; 
    task?: any; 
    isOnboarding?: boolean;
  }>({ open: false });

  // Filter onboarding tasks by status (only for daily view)
  const pendingOnboardingTasks = type === 'daily' 
    ? onboardingTasks.filter(t => t.status === 'pending')
    : [];
  
  const doingOnboardingTasks = type === 'daily'
    ? onboardingTasks.filter(t => t.status === 'doing')
    : [];
  
  // Filter done onboarding tasks (for display in "Feitas" column)
  const doneOnboardingTasks = type === 'daily'
    ? onboardingTasks.filter(t => t.status === 'done')
    : [];

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
    const newStatus = result.destination.droppableId;
    
    // Check if it's an onboarding task
    if (taskId.startsWith('onboarding-')) {
      const actualId = taskId.replace('onboarding-', '');
      const statusMap: Record<string, 'pending' | 'doing' | 'done'> = {
        'todo': 'pending',
        'doing': 'doing',
        'done': 'done'
      };
      const mappedStatus = statusMap[newStatus];
      if (mappedStatus) {
        // Backend trigger handles automation (client movement + task creation)
        updateOnboardingStatus.mutate({ taskId: actualId, status: mappedStatus });
      }
      return;
    }
    
    // Regular task - fire confetti when moving to done
    if (newStatus === 'done' && result.source.droppableId !== 'done') {
      fireCelebration();
    }
    
    updateStatus.mutate({ id: taskId, status: newStatus, task_type: type });
  };

  const handleStatusChange = (taskId: string, newStatus: string, isOnboarding?: boolean, task?: any) => {
    if (isOnboarding) {
      const statusMap: Record<string, 'pending' | 'doing' | 'done'> = {
        'todo': 'pending',
        'doing': 'doing',
        'done': 'done'
      };
      const mappedStatus = statusMap[newStatus];
      if (mappedStatus) {
        // Backend trigger handles automation (client movement + task creation)
        updateOnboardingStatus.mutate({ taskId, status: mappedStatus });
      }
      return;
    }
    
    // Fire confetti when completing a task
    if (newStatus === 'done') {
      fireCelebration();
    }
    
    updateStatus.mutate({ id: taskId, status: newStatus, task_type: type });
  };

  const handleTaskClick = (task: AdsTask) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (data: { description?: string; title?: string; tags?: string[]; dueDate?: string }) => {
    if (selectedTask) {
      const updateData: { id: string; description?: string; title?: string; tags?: string[]; due_date?: string | null } = {
        id: selectedTask.id,
      };
      if (data.description !== undefined) updateData.description = data.description;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.dueDate !== undefined) updateData.due_date = data.dueDate || null;
      
      await updateTask.mutateAsync(updateData);
      // Update local state to reflect the change immediately
      setSelectedTask(prev => prev ? { 
        ...prev, 
        ...data,
        due_date: data.dueDate ?? prev.due_date,
        tags: data.tags ?? prev.tags
      } : null);
    }
  };

  const getTasksByStatus = (status: string) => 
    tasks.filter(t => t.status === status);

  // Get onboarding tasks that should show in each column
  const getOnboardingTasksForColumn = (status: string) => {
    if (type !== 'daily') return [];
    
    if (status === 'todo') {
      return pendingOnboardingTasks;
    }
    if (status === 'doing') {
      return doingOnboardingTasks;
    }
    if (status === 'done') {
      return doneOnboardingTasks;
    }
    return [];
  };

  const handleArchiveTask = (taskId: string) => {
    archiveTask.mutate({ id: taskId, task_type: type });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask.mutate({ id: taskId, task_type: type });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (compact) {
    const todoCount = getTasksByStatus('todo').length + pendingOnboardingTasks.length;
    const doingCount = getTasksByStatus('doing').length;
    const doneCount = getTasksByStatus('done').length + doneOnboardingTasks.length;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {STATUSES.map(status => (
            <div key={status.id} className="p-3 bg-card rounded-xl border border-subtle">
              <div className={cn('w-3 h-3 rounded-full mx-auto mb-2', 
                status.id === 'todo' && 'bg-info',
                status.id === 'doing' && 'bg-warning',
                status.id === 'done' && 'bg-success'
              )} />
              <p className="text-lg font-semibold text-foreground">
                {status.id === 'todo' ? todoCount : status.id === 'doing' ? doingCount : doneCount}
              </p>
              <p className="text-xs text-muted-foreground">{status.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Button to view archived tasks - only for daily view and users with permission */}
      {type === 'daily' && canArchive && archivedOnboardingTasks.length > 0 && (
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => setShowArchivedModal(true)}
          >
            <Eye size={14} />
            Ver Arquivadas ({archivedOnboardingTasks.length})
          </Button>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {STATUSES.map(status => {
            const statusTasks = getTasksByStatus(status.id);
            const onboardingTasksForColumn = getOnboardingTasksForColumn(status.id);
            const hasDoneTasks = status.id === 'done' && (statusTasks.length > 0 || onboardingTasksForColumn.length > 0);
            
            return (
            <div key={status.id}>
              {/* Status Header - Colorido */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={status.headerClass}>
                    {status.label}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
                    {statusTasks.length + onboardingTasksForColumn.length}
                  </span>
                </div>
                
                {hasDoneTasks && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => {
                      // Archive regular tasks
                      statusTasks.forEach(task => handleArchiveTask(task.id));
                      // Archive onboarding tasks if user has permission
                      if (canArchive) {
                        onboardingTasksForColumn.forEach(task => archiveOnboardingTask.mutate(task.id));
                      }
                    }}
                    disabled={archiveTask.isPending || archiveOnboardingTask.isPending}
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
                      {/* Onboarding Tasks */}
                      {getOnboardingTasksForColumn(status.id).map((task, index) => {
                        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status === 'pending';
                        const clientDays = task.client?.created_at 
                          ? differenceInDays(new Date(), new Date(task.client.created_at))
                          : 0;
                        const isDone = task.status === 'done';

                        return (
                          <Draggable 
                            key={`onboarding-${task.id}`} 
                            draggableId={`onboarding-${task.id}`} 
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
                                  isDone ? 'border-l-success bg-success/5' : 'border-l-primary',
                                  isOverdue && !isDone && 'border-l-danger bg-danger/5',
                                  snapshot.isDragging && 'dragging'
                                )}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0 pr-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={cn(
                                        "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide",
                                        isDone ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                                      )}>
                                        {isDone ? <CheckCircle size={10} /> : <Target size={10} />}
                                        {isDone ? 'Concluída' : 'Onboarding'}
                                      </span>
                                      {!isDone && (
                                        <span className={cn(
                                          "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded",
                                          clientDays > 3 ? "bg-warning/10 text-warning" : "bg-info/10 text-info"
                                        )}>
                                          <Timer size={10} />
                                          {clientDays}d
                                        </span>
                                      )}
                                    </div>
                                    <p className={cn(
                                      "text-sm font-medium",
                                      isDone ? "text-muted-foreground line-through" : "text-foreground"
                                    )}>{task.title}</p>
                                    {task.client && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        Cliente: {task.client.name}
                                      </p>
                                    )}
                                    
                                    {task.due_date && !isDone && (
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

                                    {/* Justification for overdue onboarding tasks */}
                                    {isOverdue && !isDone && (
                                      <div className="mt-2">
                                        {(task as any).justification ? (
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

                                    {task.completed_at && isDone && (
                                      <div className="flex items-center gap-1.5 mt-2 text-xs text-success">
                                        <CheckCircle size={12} />
                                        <span>
                                          Concluída em {format(new Date(task.completed_at), 'dd/MM HH:mm', { locale: ptBR })}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {!isDone && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 -m-1 hover:bg-muted rounded-lg">
                                          <MoreHorizontal size={14} className="text-muted-foreground" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="bg-popover border-subtle">
                                        {STATUSES.filter(s => {
                                          // Map onboarding status to column status for filtering
                                          const currentStatus = task.status === 'pending' ? 'todo' : task.status === 'doing' ? 'doing' : 'done';
                                          return s.id !== currentStatus;
                                        }).map(s => (
                                          <DropdownMenuItem
                                            key={s.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStatusChange(task.id, s.id, true, task);
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
                                        {canArchive && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                archiveOnboardingTask.mutate(task.id);
                                              }}
                                              className="text-muted-foreground"
                                            >
                                              <Archive size={14} className="mr-2" />
                                              Arquivar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteOnboardingTask.mutate(task.id);
                                              }}
                                              className="text-destructive focus:text-destructive"
                                            >
                                              <Trash2 size={14} className="mr-2" />
                                              Excluir
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}

                      {/* Regular Tasks */}
                      {getTasksByStatus(status.id).map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index + getOnboardingTasksForColumn(status.id).length}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => handleTaskClick(task)}
                              className={cn(
                                'kanban-card p-4 group',
                                status.borderClass,
                                snapshot.isDragging && 'dragging'
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-2">
                                  {task.priority && (
                                    <span className={cn(
                                      'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide',
                                      task.priority === 'urgente' && 'bg-danger text-white',
                                      task.priority === 'prioridade' && 'bg-warning text-white'
                                    )}>
                                      {task.priority}
                                    </span>
                                  )}
                                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                                  <AdsCardDescriptionPreview text={task.description} />
                                  
                                  {task.due_date && (
                                    <div className={cn(
                                      "flex items-center gap-1.5 mt-3 text-xs",
                                      isPast(new Date(task.due_date)) && task.status !== 'done' ? "text-danger" : "text-muted-foreground"
                                    )}>
                                      <Calendar size={12} />
                                      <span>
                                        {new Date(task.due_date).toLocaleDateString('pt-BR')}
                                        {isPast(new Date(task.due_date)) && task.status !== 'done' && ' (Atrasado!)'}
                                      </span>
                                    </div>
                                  )}

                                  {/* Justification for overdue regular tasks */}
                                  {task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done' && (
                                    <div className="mt-2">
                                      {(task as any).justification ? (
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
                                    {STATUSES.filter(s => s.id !== task.status).map(s => (
                                      <DropdownMenuItem
                                        key={s.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(task.id, s.id);
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
                                        handleArchiveTask(task.id);
                                      }}
                                      className="text-muted-foreground"
                                    >
                                      <Archive size={14} className="mr-2" />
                                      Arquivar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTask(task.id);
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
                      ))}
                    </div>
                    {provided.placeholder}

                    {/* Add Card UI */}
                    {isAdding === status.id ? (
                      <div className="mt-2 space-y-2">
                        <Input
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          placeholder="Título do cartão..."
                          className="input-apple text-sm"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddTask(status.id);
                            if (e.key === 'Escape') setIsAdding(null);
                          }}
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="btn-cta text-xs px-3 py-1.5 h-auto"
                            onClick={() => handleAddTask(status.id)}
                            disabled={createTask.isPending}
                          >
                            {createTask.isPending ? 'Adicionando...' : 'Adicionar'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-xs px-3 py-1.5 h-auto text-muted-foreground"
                            onClick={() => setIsAdding(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAdding(status.id)}
                        className="w-full mt-2 p-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl flex items-center gap-2 transition-colors"
                      >
                        <Plus size={14} />
                        <span>Adicionar cartão</span>
                      </button>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
          })}
        </div>
      </DragDropContext>

      {/* Card Detail Modal */}
      <AdsCardDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        card={selectedTask ? {
          id: selectedTask.id,
          title: selectedTask.title,
          description: selectedTask.description || '',
          tags: selectedTask.tags || [],
          dueDate: selectedTask.due_date || '',
          createdAt: selectedTask.created_at,
        } : null}
        onSave={handleSaveTask}
        listName={STATUSES.find(s => s.id === selectedTask?.status)?.label}
      />

      {/* Archived Tasks Modal */}
      <Dialog open={showArchivedModal} onOpenChange={setShowArchivedModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive size={18} />
              Tarefas Arquivadas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {archivedOnboardingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma tarefa arquivada
              </p>
            ) : (
              archivedOnboardingTasks.map(task => (
                <div
                  key={task.id}
                  className="p-4 bg-muted/30 rounded-xl border border-subtle"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-muted text-muted-foreground">
                          <Target size={10} />
                          Onboarding
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      {task.client && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cliente: {task.client.name}
                        </p>
                      )}
                      {task.archived_at && (
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Arquivada em: {format(new Date(task.archived_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs shrink-0"
                      onClick={() => unarchiveOnboardingTask.mutate(task.id)}
                      disabled={unarchiveOnboardingTask.isPending}
                    >
                      <ArchiveRestore size={14} />
                      Desarquivar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Justification Modal */}
      <JustificationModal
        isOpen={justificationModal.open}
        onClose={() => setJustificationModal({ open: false })}
        onSubmit={async (justification) => {
          if (justificationModal.task) {
            if (justificationModal.isOnboarding) {
              await addOnboardingJustification.mutateAsync({
                taskId: justificationModal.task.id,
                justification,
              });
            } else {
              await addAdsJustification.mutateAsync({
                taskId: justificationModal.task.id,
                justification,
              });
            }
          }
        }}
        taskTitle={justificationModal.task?.title}
        existingJustification={justificationModal.task?.justification}
        isPending={addAdsJustification.isPending || addOnboardingJustification.isPending}
      />
    </>
  );
}
