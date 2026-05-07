import { useState } from 'react';
import {
  useProjectTasks,
  useArchivedProjectTasks,
  useCreateProjectTask,
} from '@/hooks/useProjectTasks';
import {
  useUpdateDepartmentTaskStatus,
  useArchiveDepartmentTask,
  useUnarchiveDepartmentTask,
  useDeleteDepartmentTask,
  type DepartmentTask,
} from '@/hooks/useDepartmentTasks';
import { useAddJustification } from '@/hooks/useTaskJustification';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, MoreHorizontal, Calendar, Trash2, Archive, ArchiveRestore, Eye, AlertTriangle, User } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import JustificationModal from '@/components/shared/JustificationModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  projectId: string;
  type?: 'daily' | 'weekly';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  { id: 'todo', label: 'A fazer', headerClass: 'kanban-header-todo', borderClass: 'card-border-blue' },
  { id: 'doing', label: 'Fazendo', headerClass: 'kanban-header-doing', borderClass: 'card-border-orange' },
  { id: 'done', label: 'Feitas', headerClass: 'kanban-header-done', borderClass: 'card-border-green' },
] as const;

/** Roles allowed to archive or delete tasks (CEO, CTO, Sucesso do Cliente). */
const CAN_MANAGE_TASKS_ROLES = new Set(['ceo', 'cto', 'sucesso_cliente']);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectTarefasSection({ projectId, type = 'daily' }: Props) {
  const { data: tasks = [], isLoading } = useProjectTasks(projectId, type);
  const { data: archivedTasks = [] } = useArchivedProjectTasks(projectId, type);
  const { user } = useAuth();
  const createTask = useCreateProjectTask(projectId);
  const updateStatus = useUpdateDepartmentTaskStatus('devs');
  const archiveTask = useArchiveDepartmentTask('devs');
  const unarchiveTask = useUnarchiveDepartmentTask('devs');
  const deleteTask = useDeleteDepartmentTask('devs');
  const addJustification = useAddJustification('department_tasks', ['project-tasks', projectId, type]);
  const canManageTasks = !!user?.role && CAN_MANAGE_TASKS_ROLES.has(user.role);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [justificationModal, setJustificationModal] = useState<{ open: boolean; task?: DepartmentTask }>({ open: false });

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await createTask.mutateAsync({
      title: newTaskTitle,
      task_type: type,
    });
    setNewTaskTitle('');
    setIsAdding(null);
  };

  // Droppable IDs are compound: `${projectId}-${type}-${statusId}`
  // Extract the status (last segment) from the droppable ID.
  const extractStatus = (droppableId: string) =>
    droppableId.split('-').pop() as 'todo' | 'doing' | 'done';

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = extractStatus(result.destination.droppableId);
    const oldStatus = extractStatus(result.source.droppableId);

    if (newStatus === 'done' && oldStatus !== 'done') {
      fireCelebration();
    }

    updateStatus.mutate({ taskId, status: newStatus });
  };

  const handleStatusChange = (task: DepartmentTask, newStatus: 'todo' | 'doing' | 'done') => {
    if (newStatus === 'done') {
      fireCelebration();
    }
    updateStatus.mutate({ taskId: task.id, status: newStatus });
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
    <>
      {/* Button to view archived tasks */}
      {canManageTasks && archivedTasks.length > 0 && (
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => setShowArchivedModal(true)}
          >
            <Eye size={14} />
            Ver Arquivadas ({archivedTasks.length})
          </Button>
        </div>
      )}

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

                {hasDoneTasks && canManageTasks && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => {
                      statusTasks.forEach(task => archiveTask.mutate({ taskId: task.id, _source: task._source }));
                    }}
                    disabled={archiveTask.isPending}
                  >
                    <Archive size={12} />
                    Arquivar concluidas
                  </Button>
                )}
              </div>

              {/* Tasks Droppable */}
              <Droppable droppableId={`${projectId}-${type}-${status.id}`}>
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
                      {statusTasks.map((task, index) => {
                        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
                        const isDone = task.status === 'done';
                        const hasJustification = !!(task as any).justification;
                        const clientName = task.clients?.razao_social || task.clients?.name || null;

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

                                    {clientName && (
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <User size={11} className="text-muted-foreground shrink-0" />
                                        <span className="text-xs text-muted-foreground font-medium truncate">
                                          {clientName}
                                        </span>
                                      </div>
                                    )}

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
                                    {isOverdue && hasJustification && (
                                      <div className="mt-2">
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
                                            handleStatusChange(task, s.id as 'todo' | 'doing' | 'done');
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
                                      {canManageTasks && (
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          archiveTask.mutate({ taskId: task.id, _source: task._source });
                                        }}
                                        className="text-muted-foreground"
                                      >
                                        <Archive size={14} className="mr-2" />
                                        Arquivar
                                      </DropdownMenuItem>
                                      )}
                                      {canManageTasks && (
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteTask.mutate({ taskId: task.id, _source: task._source });
                                          }}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <Trash2 size={14} className="mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      )}
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
                            if (e.key === 'Enter') handleAddTask();
                            if (e.key === 'Escape') setIsAdding(null);
                          }}
                          autoFocus
                          className="h-9"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleAddTask}
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
            {archivedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma tarefa arquivada
              </p>
            ) : (
              archivedTasks.map(task => (
                <div
                  key={task.id}
                  className="p-4 bg-muted/30 rounded-xl border border-subtle"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      {task.clients && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cliente: {task.clients.razao_social || task.clients.name}
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
                      onClick={() => unarchiveTask.mutate(task.id)}
                      disabled={unarchiveTask.isPending}
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
    </>
  );
}
