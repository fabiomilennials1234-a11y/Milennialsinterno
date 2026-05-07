import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAllProjectTasks,
  useCreateAllProjectTask,
  allProjectTaskKeys,
  type ProjectTaskWithName,
} from '@/hooks/useAllProjectTasks';
import {
  useUpdateDepartmentTaskStatus,
  useArchiveDepartmentTask,
  useDeleteDepartmentTask,
} from '@/hooks/useDepartmentTasks';
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
  Settings,
  Shield,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { ProjectTaskTemplatesModal } from './ProjectTaskTemplatesModal';
import { useProjectStepProgress, projectStepProgressKeys } from '../hooks/useProjectStepProgress';
import {
  useTechProjects,
  useUpdateTechProject,
  techProjectKeys,
} from '../hooks/useTechProjects';
import {
  PROJECT_STEP_LABEL,
  getNextProjectStep,
  isLastProjectStep,
  type ProjectStep,
} from '../lib/projectSteps';
import { toast } from 'sonner';
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
  const queryClient = useQueryClient();
  const { data: projects = [] } = useTechProjects();
  const createTask = useCreateAllProjectTask();
  const updateStatus = useUpdateDepartmentTaskStatus('devs');
  const archiveTask = useArchiveDepartmentTask('devs');
  const deleteTask = useDeleteDepartmentTask('devs');
  const canManageTasks = !!user?.role && CAN_MANAGE_TASKS_ROLES.has(user.role);

  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>('__none__');
  const [newTaskIsBlocking, setNewTaskIsBlocking] = useState(true);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed'),
    [projects],
  );

  const getTasksByStatus = (status: string) =>
    tasks.filter((t) => t.status === status);

  const droppablePrefix = `all-${type}`;

  // ── Optimistic update: move task in cache before server responds ──
  const optimisticStatusUpdate = useCallback(
    async (taskId: string, newStatus: 'todo' | 'doing' | 'done') => {
      // Cancel in-flight refetches so they don't overwrite optimistic data
      await queryClient.cancelQueries({ queryKey: allProjectTaskKeys.all });

      // Snapshot both caches for rollback
      const prevDaily = queryClient.getQueryData<ProjectTaskWithName[]>(
        allProjectTaskKeys.byType('daily'),
      );
      const prevWeekly = queryClient.getQueryData<ProjectTaskWithName[]>(
        allProjectTaskKeys.byType('weekly'),
      );

      // Optimistically update both caches (task lives in only one, but update both is safe)
      const updateCache = (old: ProjectTaskWithName[] | undefined) =>
        old?.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));

      queryClient.setQueryData(allProjectTaskKeys.byType('daily'), updateCache);
      queryClient.setQueryData(allProjectTaskKeys.byType('weekly'), updateCache);

      return { prevDaily, prevWeekly };
    },
    [queryClient],
  );

  const rollbackOptimistic = useCallback(
    (context: { prevDaily?: ProjectTaskWithName[]; prevWeekly?: ProjectTaskWithName[] } | undefined) => {
      if (context?.prevDaily !== undefined) {
        queryClient.setQueryData(allProjectTaskKeys.byType('daily'), context.prevDaily);
      }
      if (context?.prevWeekly !== undefined) {
        queryClient.setQueryData(allProjectTaskKeys.byType('weekly'), context.prevWeekly);
      }
    },
    [queryClient],
  );

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId.split('-').pop() as 'todo' | 'doing' | 'done';
    const oldStatus = result.source.droppableId.split('-').pop() as string;

    if (newStatus === oldStatus) return;

    if (newStatus === 'done' && oldStatus !== 'done') {
      fireCelebration();
    }

    const context = await optimisticStatusUpdate(taskId, newStatus);

    updateStatus.mutate(
      { taskId, status: newStatus },
      {
        onError: () => rollbackOptimistic(context),
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: allProjectTaskKeys.all });
        },
      },
    );
  };

  const handleStatusChange = async (task: ProjectTaskWithName, newStatus: 'todo' | 'doing' | 'done') => {
    if (newStatus === 'done') fireCelebration();

    const context = await optimisticStatusUpdate(task.id, newStatus);

    updateStatus.mutate(
      { taskId: task.id, status: newStatus },
      {
        onError: () => rollbackOptimistic(context),
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: allProjectTaskKeys.all });
        },
      },
    );
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    await createTask.mutateAsync({
      title: newTaskTitle,
      task_type: type,
      related_project_id: newTaskProjectId === '__none__' ? null : newTaskProjectId,
      is_blocking: newTaskIsBlocking,
    });
    setNewTaskTitle('');
    setNewTaskProjectId('__none__');
    setNewTaskIsBlocking(true);
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
                                          'text-sm font-medium text-[var(--mtech-text)] flex items-center gap-1',
                                          isDone && 'line-through text-[var(--mtech-text-subtle)]',
                                        )}
                                      >
                                        {task.related_project_id && task.is_blocking && (
                                          <Shield
                                            className="h-3 w-3 text-[var(--mtech-accent)] flex-shrink-0"
                                            title="Tarefa bloqueante"
                                          />
                                        )}
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
                              {/* Blocking toggle — only relevant for project-linked tasks */}
                              {newTaskProjectId !== '__none__' && (
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={newTaskIsBlocking}
                                    onClick={() => setNewTaskIsBlocking((v) => !v)}
                                    className={cn(
                                      'relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors',
                                      newTaskIsBlocking
                                        ? 'bg-[var(--mtech-accent)] border-[var(--mtech-accent)]'
                                        : 'bg-[var(--mtech-surface-elev)] border-[var(--mtech-border)]',
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'pointer-events-none block h-3 w-3 rounded-full bg-white shadow-sm transition-transform',
                                        newTaskIsBlocking ? 'translate-x-3' : 'translate-x-0',
                                      )}
                                    />
                                  </button>
                                  <span className="text-[10px] text-[var(--mtech-text-subtle)]">
                                    <Shield className="h-3 w-3 inline mr-0.5" />
                                    Bloqueante
                                  </span>
                                </label>
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
                                    setNewTaskIsBlocking(true);
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

const CAN_CONFIGURE_ROLES = new Set(['ceo', 'cto']);

export function ProjectTasksView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: dailyTasks = [], isLoading: dailyLoading } = useAllProjectTasks('daily');
  const { data: weeklyTasks = [], isLoading: weeklyLoading } = useAllProjectTasks('weekly');
  const { data: projects = [] } = useTechProjects();
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const updateProject = useUpdateTechProject();

  const canConfigure = !!user?.role && CAN_CONFIGURE_ROLES.has(user.role);
  const canManageTasks = !!user?.role && CAN_MANAGE_TASKS_ROLES.has(user.role);

  // Active projects for step progress tracking
  const activeProjects = useMemo(
    () =>
      projects
        .filter((p) => p.status === 'active' || p.status === 'planning')
        .map((p) => ({ id: p.id, name: p.name, currentStep: p.current_step })),
    [projects],
  );

  const { data: stepProgress = [] } = useProjectStepProgress(activeProjects);

  const handleAdvanceStep = (projectId: string, currentStep: string, projectName: string) => {
    const last = isLastProjectStep(currentStep);
    const nextStep = getNextProjectStep(currentStep);

    if (last) {
      updateProject.mutate(
        { id: projectId, patch: { status: 'completed' as const } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: allProjectTaskKeys.all });
            queryClient.invalidateQueries({ queryKey: techProjectKeys.all });
            queryClient.invalidateQueries({ queryKey: projectStepProgressKeys.all });
            toast.success(`Projeto "${projectName}" concluido!`);
          },
        },
      );
    } else if (nextStep) {
      const nextLabel = PROJECT_STEP_LABEL[nextStep as ProjectStep] ?? nextStep;
      updateProject.mutate(
        { id: projectId, patch: { current_step: nextStep } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: allProjectTaskKeys.all });
            queryClient.invalidateQueries({ queryKey: techProjectKeys.all });
            queryClient.invalidateQueries({ queryKey: projectStepProgressKeys.all });
            toast.success(`Projeto avancou para "${nextLabel}"`);
          },
        },
      );
    }
  };

  return (
    <div className="space-y-10">
      {/* Header with config button */}
      {canConfigure && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--mtech-border)] text-[11px] font-medium text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-text)] hover:border-[var(--mtech-border-strong)] transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar templates
          </button>
        </div>
      )}

      {/* Step progress per project */}
      {activeProjects.length > 0 && stepProgress.length > 0 && (
        <div className="space-y-3">
          <h3 className={sectionTitleCls}>Progresso por projeto</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activeProjects.map((project) => {
              const progress = stepProgress.find((p) => p.projectId === project.id);
              if (!progress) return null;

              const pct =
                progress.totalBlocking > 0
                  ? Math.round((progress.doneBlocking / progress.totalBlocking) * 100)
                  : 0;
              const stepLabel =
                PROJECT_STEP_LABEL[project.currentStep as ProjectStep] ?? project.currentStep;

              return (
                <div
                  key={project.id}
                  className="rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderKanban className="h-3.5 w-3.5 text-[var(--mtech-accent)] flex-shrink-0" />
                      <span className="text-sm font-medium text-[var(--mtech-text)] truncate">
                        {project.name}
                      </span>
                      <span className="text-[10px] text-[var(--mtech-text-subtle)] bg-[var(--mtech-surface-elev)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {stepLabel}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--mtech-text-muted)] flex-shrink-0 ml-2">
                      {progress.doneBlocking}/{progress.totalBlocking} bloqueantes
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-[var(--mtech-surface-elev)] overflow-hidden mb-3">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        progress.canAdvance
                          ? 'bg-emerald-500'
                          : 'bg-[var(--mtech-accent)]',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Advance button */}
                  {canManageTasks && (
                    <button
                      disabled={!progress.canAdvance || updateProject.isPending}
                      onClick={() =>
                        handleAdvanceStep(project.id, project.currentStep, project.name)
                      }
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all w-full justify-center',
                        progress.canAdvance
                          ? 'bg-[var(--mtech-accent)] text-[var(--mtech-bg)] hover:bg-[var(--mtech-accent)]/90 cursor-pointer'
                          : 'bg-[var(--mtech-surface-elev)] text-[var(--mtech-text-subtle)] cursor-not-allowed opacity-50',
                      )}
                    >
                      {progress.isLastStep ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Concluir Projeto
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-3.5 w-3.5" />
                          Avancar Etapa
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {canConfigure && (
        <ProjectTaskTemplatesModal
          open={showTemplatesModal}
          onOpenChange={setShowTemplatesModal}
        />
      )}
    </div>
  );
}
