import { useState, useMemo } from 'react';
import {
  useAllProjectTasks,
  useCreateAllProjectTask,
  type ProjectTaskWithName,
} from '@/hooks/useAllProjectTasks';
import {
  useUpdateDepartmentTaskStatus,
  useArchiveDepartmentTask,
  useDeleteDepartmentTask,
} from '@/hooks/useDepartmentTasks';
import { useTechProjects } from '../hooks/useTechProjects';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  Trash2,
  Archive,
  AlertTriangle,
  FolderKanban,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = [
  { id: 'todo', label: 'A fazer', headerClass: 'kanban-header-todo', borderClass: 'card-border-blue' },
  { id: 'doing', label: 'Fazendo', headerClass: 'kanban-header-doing', borderClass: 'card-border-orange' },
  { id: 'done', label: 'Feitas', headerClass: 'kanban-header-done', borderClass: 'card-border-green' },
] as const;

const CAN_MANAGE_TASKS_ROLES = new Set(['ceo', 'cto', 'sucesso_cliente']);

// ---------------------------------------------------------------------------
// Styles (mtech tokens)
// ---------------------------------------------------------------------------

const inputCls =
  'bg-[var(--mtech-input-bg)] border-[var(--mtech-input-border)] text-[var(--mtech-text)] placeholder:text-[var(--mtech-text-subtle)] focus-visible:ring-[var(--mtech-input-focus)] focus-visible:ring-1 focus-visible:ring-offset-0';
const selectContentCls =
  'bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border-strong)] text-[var(--mtech-text)] shadow-xl z-50';
const sectionTitleCls =
  'text-xs font-semibold text-[var(--mtech-text-muted)] uppercase tracking-wide';

// ---------------------------------------------------------------------------
// Sub-component: Kanban section (daily or weekly)
// ---------------------------------------------------------------------------

interface KanbanSectionProps {
  title: string;
  type: 'daily' | 'weekly';
  tasks: ProjectTaskWithName[];
  isLoading: boolean;
}

function KanbanSection({ title, type, tasks, isLoading }: KanbanSectionProps) {
  const { user } = useAuth();
  const { data: projects = [] } = useTechProjects();
  const createTask = useCreateAllProjectTask();
  const updateStatus = useUpdateDepartmentTaskStatus('devs');
  const archiveTask = useArchiveDepartmentTask('devs');
  const deleteTask = useDeleteDepartmentTask('devs');
  const canManageTasks = !!user?.role && CAN_MANAGE_TASKS_ROLES.has(user.role);

  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>('__none__');

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed'),
    [projects],
  );

  const getTasksByStatus = (status: string) =>
    tasks.filter((t) => t.status === status);

  const droppablePrefix = `all-${type}`;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId.split('-').pop() as 'todo' | 'doing' | 'done';
    const oldStatus = result.source.droppableId.split('-').pop() as string;

    if (newStatus === 'done' && oldStatus !== 'done') {
      fireCelebration();
    }

    updateStatus.mutate({ taskId, status: newStatus });
  };

  const handleStatusChange = (task: ProjectTaskWithName, newStatus: 'todo' | 'doing' | 'done') => {
    if (newStatus === 'done') fireCelebration();
    updateStatus.mutate({ taskId: task.id, status: newStatus });
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await createTask.mutateAsync({
      title: newTaskTitle,
      task_type: type,
      related_project_id: newTaskProjectId === '__none__' ? null : newTaskProjectId,
    });
    setNewTaskTitle('');
    setNewTaskProjectId('__none__');
    setIsAdding(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className={sectionTitleCls}>{title}</h3>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-[var(--mtech-surface-elev)] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className={sectionTitleCls + ' mb-4'}>{title}</h3>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUSES.map((status) => {
            const statusTasks = getTasksByStatus(status.id);
            const hasDoneTasks = status.id === 'done' && statusTasks.length > 0;

            return (
              <div key={status.id} className="min-w-0">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={status.headerClass}>{status.label}</span>
                    <span className="text-[10px] text-[var(--mtech-text-subtle)] font-medium bg-[var(--mtech-surface-elev)] px-1.5 py-0.5 rounded-full">
                      {statusTasks.length}
                    </span>
                  </div>

                  {hasDoneTasks && canManageTasks && (
                    <button
                      className="text-[10px] text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-text-muted)] transition-colors"
                      onClick={() => {
                        statusTasks.forEach((task) =>
                          archiveTask.mutate({ taskId: task.id, _source: task._source }),
                        );
                      }}
                      disabled={archiveTask.isPending}
                    >
                      <Archive className="h-3 w-3 inline mr-1" />
                      Arquivar
                    </button>
                  )}
                </div>

                {/* Droppable column */}
                <Droppable droppableId={`${droppablePrefix}-${status.id}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'min-h-[80px] rounded-xl p-2 transition-all duration-200',
                        snapshot.isDraggingOver && 'bg-[var(--mtech-accent)]/10 ring-2 ring-[var(--mtech-accent)]/30',
                      )}
                    >
                      <div className="space-y-2">
                        {statusTasks.map((task, index) => {
                          const isOverdue =
                            task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
                          const isDone = task.status === 'done';

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
                                    'rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-3 group border-l-4 transition-all',
                                    status.borderClass,
                                    isDone && 'opacity-60',
                                    isOverdue && 'border-l-[var(--mtech-danger)] bg-[var(--mtech-danger)]/5',
                                    snapshot.isDragging && 'shadow-lg ring-2 ring-[var(--mtech-accent)]/20',
                                  )}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-2">
                                      <p
                                        className={cn(
                                          'text-sm font-medium text-[var(--mtech-text)]',
                                          isDone && 'line-through text-[var(--mtech-text-subtle)]',
                                        )}
                                      >
                                        {task.title}
                                      </p>

                                      {/* Project badge */}
                                      {task.project_name && (
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                          <FolderKanban className="h-3 w-3 text-[var(--mtech-accent)] flex-shrink-0" />
                                          <span className="text-[10px] text-[var(--mtech-accent)] font-medium truncate">
                                            {task.project_name}
                                          </span>
                                        </div>
                                      )}

                                      {task.due_date && (
                                        <div
                                          className={cn(
                                            'flex items-center gap-1.5 mt-1.5 text-[10px]',
                                            isOverdue
                                              ? 'text-[var(--mtech-danger)]'
                                              : 'text-[var(--mtech-text-subtle)]',
                                          )}
                                        >
                                          <Calendar className="h-3 w-3" />
                                          <span>
                                            {format(new Date(task.due_date), 'dd/MM HH:mm', {
                                              locale: ptBR,
                                            })}
                                            {isOverdue && ' (Atrasado!)'}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Actions menu */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1 hover:bg-[var(--mtech-surface-elev)] rounded-md">
                                          <MoreHorizontal className="h-3.5 w-3.5 text-[var(--mtech-text-subtle)]" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className={selectContentCls}>
                                        {STATUSES.filter((s) => s.id !== status.id).map((s) => (
                                          <DropdownMenuItem
                                            key={s.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStatusChange(task, s.id as 'todo' | 'doing' | 'done');
                                            }}
                                          >
                                            <div
                                              className={cn(
                                                'w-2 h-2 rounded-full mr-2',
                                                s.id === 'todo' && 'bg-blue-500',
                                                s.id === 'doing' && 'bg-orange-500',
                                                s.id === 'done' && 'bg-green-500',
                                              )}
                                            />
                                            Mover para {s.label}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuSeparator />
                                        {canManageTasks && (
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              archiveTask.mutate({
                                                taskId: task.id,
                                                _source: task._source,
                                              });
                                            }}
                                            className="text-[var(--mtech-text-subtle)]"
                                          >
                                            <Archive className="h-3.5 w-3.5 mr-2" />
                                            Arquivar
                                          </DropdownMenuItem>
                                        )}
                                        {canManageTasks && (
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              deleteTask.mutate({
                                                taskId: task.id,
                                                _source: task._source,
                                              });
                                            }}
                                            className="text-red-500 focus:text-red-500"
                                          >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
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

                      {/* Add task — only on "A fazer" column */}
                      {status.id === 'todo' && (
                        <>
                          {isAdding ? (
                            <div className="mt-3 space-y-2 p-2 rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]">
                              <Input
                                placeholder="Titulo da tarefa..."
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddTask();
                                  if (e.key === 'Escape') setIsAdding(false);
                                }}
                                autoFocus
                                className={`${inputCls} h-8 text-sm`}
                              />
                              {type === 'daily' && (
                                <Select
                                  value={newTaskProjectId}
                                  onValueChange={setNewTaskProjectId}
                                >
                                  <SelectTrigger className={`${inputCls} h-8 text-xs`}>
                                    <SelectValue placeholder="Vincular a projeto (opcional)" />
                                  </SelectTrigger>
                                  <SelectContent className={selectContentCls}>
                                    <SelectItem value="__none__">Sem projeto</SelectItem>
                                    {activeProjects.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={handleAddTask}
                                  disabled={createTask.isPending || !newTaskTitle.trim()}
                                  className="bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 h-7 px-3 text-[11px] font-semibold flex-1"
                                >
                                  {createTask.isPending ? 'Criando...' : 'Adicionar'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setIsAdding(false);
                                    setNewTaskTitle('');
                                    setNewTaskProjectId('__none__');
                                  }}
                                  className="h-7 px-2 text-[var(--mtech-text-subtle)]"
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-[var(--mtech-radius-md)] border border-dashed border-[var(--mtech-border)] text-[11px] text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-accent)] hover:border-[var(--mtech-accent)]/30 transition-colors"
                              onClick={() => setIsAdding(true)}
                            >
                              <Plus className="h-3 w-3" />
                              Adicionar tarefa
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProjectTasksView() {
  const { data: dailyTasks = [], isLoading: dailyLoading } = useAllProjectTasks('daily');
  const { data: weeklyTasks = [], isLoading: weeklyLoading } = useAllProjectTasks('weekly');

  return (
    <div className="space-y-10">
      <KanbanSection
        title="Tarefas Diarias"
        type="daily"
        tasks={dailyTasks}
        isLoading={dailyLoading}
      />

      <KanbanSection
        title="Tarefas Semanais"
        type="weekly"
        tasks={weeklyTasks}
        isLoading={weeklyLoading}
      />
    </div>
  );
}
