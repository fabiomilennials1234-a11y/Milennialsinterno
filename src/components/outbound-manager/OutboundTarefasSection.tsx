import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOutboundTasks, useOutboundCreateTask, useOutboundUpdateTaskStatus, useOutboundUpdateTask, useOutboundArchiveTask, useOutboundDeleteTask, useAutoCreateProspectionTasks, isProspectionTask, getProspectionClientId, useAutoCreateWeeklyTasks, isWeeklyRevisaoTask, isWeeklyRelatorioTask, isWeeklyReuniaoTask, isAutoWeeklyTask } from '@/hooks/useOutboundManager';
import type { AdsTask } from '@/hooks/useAdsManager';
import {
  useOnboardingTasks,
  useUpdateOnboardingTaskStatus,
  useArchiveOnboardingTask,
  useDeleteOnboardingTask,
  useArchivedOnboardingTasks,
  useUnarchiveOnboardingTask,
  useCanArchiveTasks,
} from '@/hooks/useOnboardingTasks';

import { useCompleteOnboardingTaskWithAutomation } from '@/hooks/useOnboardingAutomation';
import { useAddJustification } from '@/hooks/useTaskJustification';
import { Plus, MoreHorizontal, Calendar, Target, Timer, Archive, CheckCircle, Trash2, ArchiveRestore, Eye, AlertTriangle, ChevronDown, BarChart3, FileText, Video } from 'lucide-react';
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
import OutboundCardDetailModal from './OutboundCardDetailModal';
import OutboundCardDescriptionPreview from './OutboundCardDescriptionPreview';
import OutboundProspectionAnalysisModal, { parseAnalysisFromDescription } from './OutboundProspectionAnalysisModal';
import OutboundWeeklyReportModal, { parseReportFromDescription } from './OutboundWeeklyReportModal';
import OutboundWeeklyReviewModal, { parseReviewFromDescription } from './OutboundWeeklyReviewModal';
import JustificationModal from '@/components/shared/JustificationModal';
import { toast } from 'sonner';

interface Props {
  type: 'daily' | 'weekly';
  compact?: boolean;
}

const STATUSES = [
  { id: 'todo', label: 'A fazer', headerClass: 'kanban-header-todo', borderClass: 'card-border-blue' },
  { id: 'doing', label: 'Fazendo', headerClass: 'kanban-header-doing', borderClass: 'card-border-orange' },
  { id: 'done', label: 'Feitas', headerClass: 'kanban-header-done', borderClass: 'card-border-green' },
];

// Labels legíveis para cada step do onboarding (usados no toast de conclusão)
const STEP_LABELS: Record<string, string> = {
  'call_1_marcada':            'Call #1 Marcada',
  'call_1_realizada':          'Call #1 Realizada',
  'criar_estrategia':          'Montar Lista de Prospecção',
  'brifar_criativos':          'Criar Copilot',
  'criativos_brifados':        'Copilot Configurado',
  'marcar_call_aprovacao':     'Marcar Call para Aprovação',
  'call_aprovada':             'Call Realizada e Aprovada',
  'subir_listagem_campanha':   'Subir Listagem e Criar Campanha',
  'iniciar_prospecoes':        'Iniciar Prospecções',
  'acompanhar_cliente':        'Acompanhar Cliente',
  'acompanhamento':            'Acompanhamento',
};

// Instant optimistic advancement: maps onboarding_task_type → the step/milestone the client
// should land on in OutboundOnboardingSection AFTER the task is completed.
const ONBOARDING_TASK_ADVANCEMENT: Record<string, { step: string; milestone: number }> = {
  'realizar_call_1':             { step: 'criar_estrategia',        milestone: 2 },
  'montar_lista_prospeccao':     { step: 'brifar_criativos',        milestone: 3 },
  'criar_copilot':               { step: 'marcar_call_aprovacao',   milestone: 4 },
  'marcar_call_aprovacao':       { step: 'call_aprovada',           milestone: 4 },
  'call_aprovada':               { step: 'subir_listagem_campanha', milestone: 5 },
  'subir_listagem_campanha':     { step: 'iniciar_prospecoes',      milestone: 5 },
  'iniciar_prospecoes':          { step: 'acompanhar_cliente',      milestone: 5 },
  'concluir_onboarding':         { step: 'acompanhamento',          milestone: 6 },
};

export default function OutboundTarefasSection({ type, compact }: Props) {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useOutboundTasks(type);
  const { data: onboardingTasks = [] } = useOnboardingTasks();
  const { data: archivedOnboardingTasks = [] } = useArchivedOnboardingTasks();
  const createTask = useOutboundCreateTask();
  const updateStatus = useOutboundUpdateTaskStatus();
  const updateTask = useOutboundUpdateTask();
  const archiveTask = useOutboundArchiveTask();
  const deleteTask = useOutboundDeleteTask();
  const updateOnboardingStatus = useUpdateOnboardingTaskStatus();
  const completeOnboardingWithAutomation = useCompleteOnboardingTaskWithAutomation();
  const archiveOnboardingTask = useArchiveOnboardingTask();
  const deleteOnboardingTask = useDeleteOnboardingTask();
  const unarchiveOnboardingTask = useUnarchiveOnboardingTask();
  const canArchive = useCanArchiveTasks();
  const addOutboundJustification = useAddJustification('outbound_tasks', ['outbound-tasks', type]);
  const addOnboardingJustification = useAddJustification('onboarding_tasks', ['onboarding-tasks']);

  // Auto-create tasks for each assigned client
  useAutoCreateProspectionTasks();
  useAutoCreateWeeklyTasks();

  // State for prospection analysis modal (daily)
  const [analysisTask, setAnalysisTask] = useState<AdsTask | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

  // State for weekly modals
  const [weeklyTask, setWeeklyTask] = useState<AdsTask | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Instantly advance the client in the Onboarding pipeline via optimistic cache update.
  const advanceClientOnboardingInstantly = (completedTask: AdsTask) => {
    const clientTag = completedTask.tags?.find(tag => tag.startsWith('client_id:'));
    const typeTag = completedTask.tags?.find(tag => tag.startsWith('onboarding_task_type:'));
    if (!clientTag || !typeTag) return;

    const clientId = clientTag.replace('client_id:', '');
    const taskType = typeTag.replace('onboarding_task_type:', '');
    const advancement = ONBOARDING_TASK_ADVANCEMENT[taskType];
    if (!advancement) return;

    // Optimistic update: immediately reflect the new step in OutboundOnboardingSection
    queryClient.setQueryData(['client-onboarding', undefined], (old: any[]) => {
      if (!old) return old;
      return old.map((item: any) =>
        item.client_id === clientId
          ? { ...item, current_step: advancement.step, current_milestone: advancement.milestone }
          : item
      );
    });
  };

  // ─── Auto-scroll durante drag ───────────────────────────────────────────
  const isDraggingRef = useRef(false);
  const mouseYRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const dragScrollContainerRef = useRef<HTMLElement | null>(null);
  const dndWrapperRef = useRef<HTMLDivElement>(null);

  const findScrollParent = (el: Element | null): HTMLElement | null => {
    if (!el || el === document.body) return null;
    const oy = window.getComputedStyle(el).overflowY;
    if (oy === 'auto' || oy === 'scroll') return el as HTMLElement;
    return findScrollParent(el.parentElement);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { mouseYRef.current = e.clientY; };
    const onTouchMove = (e: TouchEvent) => { mouseYRef.current = e.touches[0].clientY; };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const startAutoScroll = () => {
    const loop = () => {
      const container = dragScrollContainerRef.current;
      if (!isDraggingRef.current || !container) return;
      const rect = container.getBoundingClientRect();
      const y = mouseYRef.current;
      const ZONE = 80, MAX = 14;
      const dTop = y - rect.top;
      const dBot = rect.bottom - y;
      let speed = 0;
      if (dTop < ZONE && dTop > 0) speed = -((ZONE - dTop) / ZONE) * MAX;
      else if (dBot < ZONE && dBot > 0) speed = ((ZONE - dBot) / ZONE) * MAX;
      if (speed !== 0) container.scrollTop += speed;
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  };

  const handleDragStartScroll = () => {
    isDraggingRef.current = true;
    if (dndWrapperRef.current) {
      dragScrollContainerRef.current = findScrollParent(dndWrapperRef.current.parentElement);
    }
    startAutoScroll();
  };

  const handleDragEndAll = (result: DropResult) => {
    isDraggingRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    handleDragEnd(result);
  };
  // ─────────────────────────────────────────────────────────────────────────

  const [showAllDone, setShowAllDone] = useState(false);
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

  // Task types that have a visible outbound_task entry in Tarefas Diárias.
  // The corresponding onboarding_tasks must be hidden to avoid duplicates.
  const HIDDEN_ONBOARDING_TASK_TYPES = [
    'marcar_call_1',
    'realizar_call_1',
    'apresentar_estrategia',
    'brifar_criativos',
    'brifar_otimizacoes_pendentes',
    'configurar_conta_anuncios',
    'certificar_consultoria',
    'publicar_campanha',
  ];

  // Filter onboarding tasks by status (only for daily view).
  const pendingOnboardingTasks = type === 'daily'
    ? onboardingTasks.filter(t => t.status === 'pending' && !HIDDEN_ONBOARDING_TASK_TYPES.includes(t.task_type))
    : [];

  const doingOnboardingTasks = type === 'daily'
    ? onboardingTasks.filter(t => t.status === 'doing' && !HIDDEN_ONBOARDING_TASK_TYPES.includes(t.task_type))
    : [];

  // Filter done onboarding tasks (for display in "Feitas" column)
  const doneOnboardingTasks = type === 'daily'
    ? onboardingTasks.filter(t => t.status === 'done' && !HIDDEN_ONBOARDING_TASK_TYPES.includes(t.task_type))
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
        if (mappedStatus === 'done') {
          // Use automation hook to trigger next task creation + client advancement
          const task = onboardingTasks.find(t => t.id === actualId);
          if (task) {
            completeOnboardingWithAutomation.mutate({
              taskId: actualId,
              taskType: task.task_type,
              clientId: task.client_id,
              clientName: task.client?.name || 'Cliente',
            });
          }
        } else {
          updateOnboardingStatus.mutate({ taskId: actualId, status: mappedStatus });
        }
      }
      return;
    }

    // Regular task - fire confetti when moving to done
    if (newStatus === 'done' && result.source.droppableId !== 'done') {
      fireCelebration();
      const completedTask = tasks.find(t => t.id === taskId);
      if (completedTask) {
        advanceClientOnboardingInstantly(completedTask);
        // Toast rico: se é tarefa de onboarding, mostrar para onde o cliente avançou
        const typeTag = completedTask.tags?.find(t => t.startsWith('onboarding_task_type:'));
        if (typeTag) {
          const taskType = typeTag.replace('onboarding_task_type:', '');
          const advancement = ONBOARDING_TASK_ADVANCEMENT[taskType];
          if (advancement) {
            const stepLabel = STEP_LABELS[advancement.step] || advancement.step;
            toast.success(`🎉 ${completedTask.title}`, {
              description: `Cliente movido para → ${stepLabel}`,
              duration: 4000,
            });
          } else {
            toast.success(`🎉 ${completedTask.title} concluída!`);
          }
        } else {
          toast.success(`🎉 ${completedTask.title} concluída!`);
        }
      }
    }

    updateStatus.mutate({ id: taskId, status: newStatus, task_type: type });
  };

  const handleStatusChange = (taskId: string, newStatus: string, isOnboarding?: boolean, onboardingTask?: any) => {
    if (isOnboarding) {
      const statusMap: Record<string, 'pending' | 'doing' | 'done'> = {
        'todo': 'pending',
        'doing': 'doing',
        'done': 'done'
      };
      const mappedStatus = statusMap[newStatus];
      if (mappedStatus) {
        if (mappedStatus === 'done' && onboardingTask) {
          // Use automation hook to trigger next task creation + client advancement
          completeOnboardingWithAutomation.mutate({
            taskId,
            taskType: onboardingTask.task_type,
            clientId: onboardingTask.client_id,
            clientName: onboardingTask.client?.name || 'Cliente',
          });
        } else {
          updateOnboardingStatus.mutate({ taskId, status: mappedStatus });
        }
      }
      return;
    }

    // Fire confetti when completing a task
    if (newStatus === 'done') {
      fireCelebration();
      const completedTask = tasks.find(t => t.id === taskId);
      if (completedTask) {
        advanceClientOnboardingInstantly(completedTask);
        const typeTag = completedTask.tags?.find(t => t.startsWith('onboarding_task_type:'));
        if (typeTag) {
          const taskType = typeTag.replace('onboarding_task_type:', '');
          const advancement = ONBOARDING_TASK_ADVANCEMENT[taskType];
          if (advancement) {
            toast.success(`🎉 ${completedTask.title}`, {
              description: `Cliente movido para → ${STEP_LABELS[advancement.step] || advancement.step}`,
              duration: 4000,
            });
          } else {
            toast.success(`🎉 ${completedTask.title} concluída!`);
          }
        } else {
          toast.success(`🎉 ${completedTask.title} concluída!`);
        }
      }
    }

    updateStatus.mutate({ id: taskId, status: newStatus, task_type: type });
  };

  const handleTaskClick = (task: AdsTask) => {
    if (isProspectionTask(task)) {
      setAnalysisTask(task);
      setIsAnalysisModalOpen(true);
      return;
    }
    if (isWeeklyRelatorioTask(task)) {
      setWeeklyTask(task);
      setIsReportModalOpen(true);
      return;
    }
    if (isWeeklyRevisaoTask(task)) {
      setWeeklyTask(task);
      setIsReviewModalOpen(true);
      return;
    }
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

      <div ref={dndWrapperRef}>
      <DragDropContext onDragEnd={handleDragEndAll} onDragStart={handleDragStartScroll}>
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
                  <span
                    key={statusTasks.length + onboardingTasksForColumn.length}
                    className="badge-count text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full"
                  >
                    {statusTasks.length + onboardingTasksForColumn.length}
                  </span>
                </div>

                {hasDoneTasks && (
                  <div className="flex items-center gap-2">
                    {/* Ver mais / ver menos para feitas */}
                    {statusTasks.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={() => setShowAllDone(v => !v)}
                      >
                        <ChevronDown size={12} className={cn('transition-transform', showAllDone && 'rotate-180')} />
                        {showAllDone ? 'Ocultar' : `Ver todas (${statusTasks.length})`}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={() => {
                        statusTasks.forEach(task => handleArchiveTask(task.id));
                        if (canArchive) {
                          onboardingTasksForColumn.forEach(task => archiveOnboardingTask.mutate(task.id));
                        }
                      }}
                      disabled={archiveTask.isPending || archiveOnboardingTask.isPending}
                    >
                      <Archive size={12} />
                      Arquivar concluídas
                    </Button>
                  </div>
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
                      {/* Empty state */}
                      {statusTasks.length === 0 && onboardingTasksForColumn.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center select-none">
                          <span className="text-3xl mb-2 opacity-40">
                            {status.id === 'todo' ? '📋' : status.id === 'doing' ? '⚡' : '✅'}
                          </span>
                          <p className="text-xs text-muted-foreground opacity-60">
                            {status.id === 'done' ? 'Nenhuma tarefa concluída' : 'Nenhuma tarefa aqui'}
                          </p>
                        </div>
                      )}

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

                      {/* Regular Tasks — done column collapses to 5 items */}
                      {(status.id === 'done' && !showAllDone
                        ? getTasksByStatus(status.id).slice(-5)
                        : getTasksByStatus(status.id)
                      ).map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index + getOnboardingTasksForColumn(status.id).length}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => handleTaskClick(task)}
                              className={cn(
                                'kanban-card p-4 group',
                                isProspectionTask(task) ? 'border-l-4 border-l-purple-500'
                                  : isWeeklyRevisaoTask(task) ? 'border-l-4 border-l-blue-500'
                                  : isWeeklyRelatorioTask(task) ? 'border-l-4 border-l-orange-500'
                                  : isWeeklyReuniaoTask(task) ? 'border-l-4 border-l-emerald-500'
                                  : status.borderClass,
                                snapshot.isDragging && 'dragging'
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 pr-2">
                                  {isProspectionTask(task) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide bg-purple-500/10 text-purple-400">
                                      <BarChart3 size={10} />
                                      Análise Diária
                                    </span>
                                  )}
                                  {isWeeklyRevisaoTask(task) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide bg-blue-500/10 text-blue-400">
                                      <Target size={10} />
                                      Segunda — Revisão
                                    </span>
                                  )}
                                  {isWeeklyRelatorioTask(task) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide bg-orange-500/10 text-orange-400">
                                      <FileText size={10} />
                                      Sexta — Relatório
                                    </span>
                                  )}
                                  {isWeeklyReuniaoTask(task) && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide bg-emerald-500/10 text-emerald-400">
                                      <Video size={10} />
                                      Quinzenal — Reunião
                                    </span>
                                  )}
                                  {task.priority && !isProspectionTask(task) && (
                                    <span className={cn(
                                      'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide',
                                      task.priority === 'urgente' && 'bg-danger text-white',
                                      task.priority === 'prioridade' && 'bg-warning text-white'
                                    )}>
                                      {task.priority}
                                    </span>
                                  )}
                                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                                  {!isProspectionTask(task) && !isAutoWeeklyTask(task) && <OutboundCardDescriptionPreview text={task.description} />}

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
      </div>

      {/* Card Detail Modal */}
      <OutboundCardDetailModal
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

      {/* Prospection Analysis Modal */}
      <OutboundProspectionAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        clientName={
          analysisTask?.title?.replace('Análise de Prospecção — ', '') || 'Cliente'
        }
        initialData={parseAnalysisFromDescription(analysisTask?.description || undefined)}
        isSaving={updateTask.isPending}
        onSave={async (data) => {
          if (analysisTask) {
            await updateTask.mutateAsync({
              id: analysisTask.id,
              description: JSON.stringify(data),
            });
            setAnalysisTask(prev => prev ? { ...prev, description: JSON.stringify(data) } : null);
            setIsAnalysisModalOpen(false);
          }
        }}
      />

      {/* Weekly Report Modal (Relatório Interno - Sexta) */}
      <OutboundWeeklyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        clientName={weeklyTask?.title?.replace('Relatório Interno — ', '') || 'Cliente'}
        initialData={parseReportFromDescription(weeklyTask?.description || undefined)}
        isSaving={updateTask.isPending}
        onSave={async (data) => {
          if (weeklyTask) {
            await updateTask.mutateAsync({
              id: weeklyTask.id,
              description: JSON.stringify(data),
            });
            setWeeklyTask(prev => prev ? { ...prev, description: JSON.stringify(data) } : null);
            setIsReportModalOpen(false);
          }
        }}
      />

      {/* Weekly Review Modal (Revisão de Metas - Segunda) */}
      <OutboundWeeklyReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        clientName={weeklyTask?.title?.replace('Revisão de Metas — ', '') || 'Cliente'}
        initialData={parseReviewFromDescription(weeklyTask?.description || undefined)}
        isSaving={updateTask.isPending}
        onSave={async (data) => {
          if (weeklyTask) {
            await updateTask.mutateAsync({
              id: weeklyTask.id,
              description: JSON.stringify(data),
            });
            setWeeklyTask(prev => prev ? { ...prev, description: JSON.stringify(data) } : null);
            setIsReviewModalOpen(false);
          }
        }}
      />

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
              await addOutboundJustification.mutateAsync({
                taskId: justificationModal.task.id,
                justification,
              });
            }
          }
        }}
        taskTitle={justificationModal.task?.title}
        existingJustification={justificationModal.task?.justification}
        isPending={addOutboundJustification.isPending || addOnboardingJustification.isPending}
      />
    </>
  );
}
