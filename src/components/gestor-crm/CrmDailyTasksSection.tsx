import { useState, useMemo } from 'react';
import { useCrmDailyTasks, type CrmTaskGroup, type EnrichedCrmTask, type UrgencyBadge } from '@/hooks/useCrmDailyTasks';
import { useUpdateDepartmentTaskStatus } from '@/hooks/useDepartmentTasks';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import { TAG_ESPERAR_BRIEFING } from '@/components/client-tags/ClientTagsList';
import { CRM_PRODUTO_LABEL, CRM_PRODUTO_COLOR, type CrmProduto } from '@/hooks/useCrmKanban';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, Clock, Eye, ListChecks, ShieldAlert, Timer, CheckCircle2, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { fireCelebration } from '@/lib/confetti';
import CrmConfigViewModal from './CrmConfigViewModal';
import { useCrmConfiguracoes } from '@/hooks/useCrmKanban';

// ─── Column definitions ────────────────────────────────────

const COLUMNS: { id: CrmTaskGroup; label: string; headerClass: string; borderClass: string }[] = [
  { id: 'todo', label: 'A Fazer', headerClass: 'kanban-header-todo', borderClass: 'card-border-blue' },
  { id: 'doing', label: 'Fazendo', headerClass: 'kanban-header-doing', borderClass: 'card-border-orange' },
  { id: 'done', label: 'Feitas', headerClass: 'kanban-header-done', borderClass: 'card-border-green' },
];

// ─── Urgency badge config ──────────────────────────────────

const URGENCY_META: Record<Exclude<UrgencyBadge, null>, { label: string; className: string }> = {
  atrasado: { label: 'ATRASADO', className: 'bg-red-500/15 text-red-500 border-red-500/30' },
  hoje: { label: 'HOJE', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  dn: { label: 'D+N', className: 'bg-muted text-muted-foreground border-border' },
};

// ─── Main component ────────────────────────────────────────

export default function CrmDailyTasksSection() {
  const { grouped, isLoading, enrichedTasks } = useCrmDailyTasks();
  const { data: allConfigs = [] } = useCrmConfiguracoes();
  const updateStatus = useUpdateDepartmentTaskStatus('gestor_crm');
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  // Briefing tag awareness
  const clientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const et of enrichedTasks) {
      if (et.task.related_client_id) ids.add(et.task.related_client_id);
    }
    return [...ids];
  }, [enrichedTasks]);
  const { data: tagsByClient } = useClientTagsBatch(clientIds);

  const isBlockedByBriefing = (clientId?: string | null): boolean => {
    if (!clientId) return false;
    const tags = tagsByClient?.get(clientId);
    return !!tags?.some(t => t.name === TAG_ESPERAR_BRIEFING && !t.dismissed_at);
  };

  const selectedConfig = selectedConfigId
    ? (allConfigs as Record<string, unknown>[]).find((c) => c.id === selectedConfigId) || null
    : null;

  // ─── Drag handler ──────────────────────────────────────────

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as CrmTaskGroup;
    if (newStatus === result.source.droppableId) return;

    if (newStatus === 'done' && result.source.droppableId !== 'done') {
      fireCelebration();
    }

    updateStatus.mutate({ taskId, status: newStatus });
  };

  // ─── Render ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const totalTasks = COLUMNS.reduce((sum, col) => sum + grouped[col.id].length, 0);

  if (totalTasks === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 size={24} className="mx-auto mb-2 opacity-40" />
        <p className="text-xs">Nenhuma tarefa CRM pendente</p>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {COLUMNS.map(col => {
            const colTasks = grouped[col.id];

            return (
              <div key={col.id}>
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={col.headerClass}>
                      {col.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'min-h-[60px] rounded-xl p-2 transition-all duration-200',
                        snapshot.isDraggingOver && 'bg-primary/10 ring-2 ring-primary/30',
                      )}
                    >
                      <div className="space-y-2">
                        {colTasks.map((enriched, index) => {
                          const isDone = enriched.task.status === 'done';
                          const briefingBlocked = isBlockedByBriefing(enriched.task.related_client_id);

                          return (
                            <Draggable
                              key={enriched.task.id}
                              draggableId={enriched.task.id}
                              index={index}
                            >
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={cn(
                                    'kanban-card p-3 group border-l-4',
                                    col.borderClass,
                                    isDone && 'opacity-60',
                                    dragSnapshot.isDragging && 'dragging',
                                  )}
                                >
                                  <TaskCardContent
                                    enriched={enriched}
                                    isBlockedByBriefing={briefingBlocked}
                                    currentStatus={col.id}
                                    onMove={(newStatus) => {
                                      if (newStatus === 'done' && col.id !== 'done') {
                                        fireCelebration();
                                      }
                                      updateStatus.mutate({ taskId: enriched.task.id, status: newStatus });
                                    }}
                                    onOpenConfig={() => enriched.configId && setSelectedConfigId(enriched.configId)}
                                  />
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {selectedConfig && (
        <CrmConfigViewModal
          isOpen={!!selectedConfig}
          onClose={() => setSelectedConfigId(null)}
          config={selectedConfig}
        />
      )}
    </>
  );
}

// ─── Task Card Content (inner, not wrapped by Draggable) ───

function TaskCardContent({
  enriched,
  isBlockedByBriefing = false,
  currentStatus,
  onMove,
  onOpenConfig,
}: {
  enriched: EnrichedCrmTask;
  isBlockedByBriefing?: boolean;
  currentStatus: CrmTaskGroup;
  onMove: (newStatus: CrmTaskGroup) => void;
  onOpenConfig: () => void;
}) {
  const { task, produto, checklistProgress, isBlockedDN, blockedUntil, deadlineStatus, urgencyBadge } = enriched;
  const clientName = task.clients?.razao_social || task.clients?.name || '';
  const isDone = task.status === 'done';

  // Deadline status icon
  const deadlineIcon = (() => {
    switch (deadlineStatus) {
      case 'overdue': return <AlertTriangle size={10} className="text-zinc-900" />;
      case 'critical': return <AlertTriangle size={10} className="text-destructive" />;
      case 'warning': return <Clock size={10} className="text-warning" />;
      default: return null;
    }
  })();

  return (
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0 pr-2">
        {/* Title */}
        <p className={cn(
          'text-sm font-medium text-foreground leading-snug line-clamp-2',
          isDone && 'line-through text-muted-foreground',
        )}>
          {task.title}
        </p>

        {/* Client name */}
        {clientName && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{clientName}</p>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {/* Urgency badge */}
          {urgencyBadge && (
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] px-1.5 py-0 font-bold uppercase tracking-wide',
                URGENCY_META[urgencyBadge].className,
              )}
              data-testid={`urgency-${urgencyBadge}`}
            >
              {URGENCY_META[urgencyBadge].label}
            </Badge>
          )}

          {/* Produto badge */}
          {produto && (
            <Badge className={cn(
              'text-[9px] px-1.5 py-0 border',
              CRM_PRODUTO_COLOR[produto],
            )}>
              {CRM_PRODUTO_LABEL[produto]}
            </Badge>
          )}

          {/* Deadline status */}
          {deadlineIcon}

          {/* Checklist progress */}
          {checklistProgress && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1 py-0.5 rounded',
              checklistProgress.done === checklistProgress.total
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-muted text-muted-foreground',
            )}>
              <ListChecks size={10} />
              {checklistProgress.done}/{checklistProgress.total}
            </span>
          )}

          {/* Blocked D+N badge (separate from urgency) */}
          {isBlockedDN && blockedUntil && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 gap-0.5 border-amber-500/30 text-amber-600 bg-amber-500/5"
            >
              <Timer size={9} />
              D+N
            </Badge>
          )}

          {/* Briefing block badge */}
          {isBlockedByBriefing && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-danger/10 border border-danger/20 rounded animate-pulse">
              <ShieldAlert size={9} className="text-danger shrink-0" />
              <span className="text-[9px] font-bold text-danger uppercase tracking-wider">
                Aguardando Briefing
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <button className="p-1.5 -m-1 hover:bg-muted rounded-lg" aria-label="Ações da tarefa">
              <MoreHorizontal size={14} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-subtle">
            {COLUMNS.filter(c => c.id !== currentStatus).map(c => (
              <DropdownMenuItem
                key={c.id}
                onClick={(e) => { e.stopPropagation(); onMove(c.id); }}
              >
                <div className={cn('w-2.5 h-2.5 rounded-full mr-2',
                  c.id === 'todo' && 'bg-info',
                  c.id === 'doing' && 'bg-warning',
                  c.id === 'done' && 'bg-success'
                )} />
                Mover para {c.label}
              </DropdownMenuItem>
            ))}
            {enriched.configId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onOpenConfig(); }}
                >
                  <Eye size={14} className="mr-2" />
                  Ver configuração
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
