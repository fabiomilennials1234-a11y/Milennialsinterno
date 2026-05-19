import { useState, useMemo } from 'react';
import { useCrmDailyTasks, type CrmTaskGroup, type EnrichedCrmTask } from '@/hooks/useCrmDailyTasks';
import { useUpdateDepartmentTaskStatus } from '@/hooks/useDepartmentTasks';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import { TAG_ESPERAR_BRIEFING } from '@/components/client-tags/ClientTagsList';
import { CRM_PRODUTO_LABEL, CRM_PRODUTO_COLOR, CRM_STEP_LABEL, type CrmProduto } from '@/hooks/useCrmKanban';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, Clock, CalendarClock, Hourglass,
  CheckCircle2, Timer, Eye, ListChecks, ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CrmConfigViewModal from './CrmConfigViewModal';
import { useCrmConfiguracoes } from '@/hooks/useCrmKanban';

const GROUP_META: Record<CrmTaskGroup, {
  label: string;
  icon: typeof AlertTriangle;
  color: string;
  bgColor: string;
}> = {
  atrasadas: {
    label: 'Atrasadas',
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/5 border-destructive/20',
  },
  hoje: {
    label: 'Hoje',
    icon: CalendarClock,
    color: 'text-amber-700',
    bgColor: 'bg-amber-500/5 border-amber-500/20',
  },
  pendentes: {
    label: 'Pendentes',
    icon: Clock,
    color: 'text-blue-700',
    bgColor: 'bg-blue-500/5 border-blue-500/20',
  },
  aguardando: {
    label: 'Aguardando D+N',
    icon: Hourglass,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30 border-border',
  },
};

const GROUP_ORDER: CrmTaskGroup[] = ['atrasadas', 'hoje', 'pendentes', 'aguardando'];

/**
 * CRM daily tasks section with smart grouping:
 * Atrasadas > Hoje > Pendentes > Aguardando D+N
 *
 * Each task shows: produto badge, checklist progress, deadline status,
 * and click opens the config in the CRM modal.
 */
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const totalTasks = GROUP_ORDER.reduce((sum, g) => sum + grouped[g].length, 0);

  if (totalTasks === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 size={24} className="mx-auto mb-2 opacity-40" />
        <p className="text-xs">Nenhuma tarefa CRM pendente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {GROUP_ORDER.map(groupKey => {
        const tasks = grouped[groupKey];
        if (tasks.length === 0) return null;
        const meta = GROUP_META[groupKey];
        const Icon = meta.icon;

        return (
          <div key={groupKey} className="space-y-2">
            {/* Group header */}
            <div className={cn(
              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border',
              meta.bgColor
            )}>
              <Icon size={13} className={meta.color} />
              <span className={cn('text-[11px] font-bold uppercase tracking-wide', meta.color)}>
                {meta.label}
              </span>
              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                {tasks.length}
              </Badge>
            </div>

            {/* Tasks */}
            <div className="space-y-1.5">
              {tasks.map(enriched => {
                const briefingBlocked = isBlockedByBriefing(enriched.task.related_client_id);
                return (
                  <TaskCard
                    key={enriched.task.id}
                    enriched={enriched}
                    isBlockedByBriefing={briefingBlocked}
                    onComplete={() => {
                      updateStatus.mutate({
                        taskId: enriched.task.id,
                        status: 'done',
                        taskTitle: enriched.task.title,
                      });
                    }}
                    onOpenConfig={() => enriched.configId && setSelectedConfigId(enriched.configId)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {selectedConfig && (
        <CrmConfigViewModal
          isOpen={!!selectedConfig}
          onClose={() => setSelectedConfigId(null)}
          config={selectedConfig}
        />
      )}
    </div>
  );
}

function TaskCard({
  enriched,
  onComplete,
  onOpenConfig,
  isBlockedByBriefing = false,
}: {
  enriched: EnrichedCrmTask;
  onComplete: () => void;
  onOpenConfig: () => void;
  isBlockedByBriefing?: boolean;
}) {
  const { task, produto, checklistProgress, isBlockedDN, deadlineStatus, blockedUntil } = enriched;
  const clientName = task.clients?.razao_social || task.clients?.name || '';

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
    <div
      className={cn(
        'group flex items-start gap-2 p-2.5 rounded-lg border bg-card transition-all hover:shadow-sm',
        isBlockedDN && 'opacity-60',
        deadlineStatus === 'overdue' && 'border-l-2 border-l-zinc-800',
        deadlineStatus === 'critical' && 'border-l-2 border-l-destructive',
      )}
    >
      {/* Title area */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {task.title}
        </p>
        {clientName && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{clientName}</p>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {/* Produto badge */}
          {produto && (
            <Badge className={cn(
              'text-[9px] px-1.5 py-0 border',
              CRM_PRODUTO_COLOR[produto]
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
                : 'bg-muted text-muted-foreground'
            )}>
              <ListChecks size={10} />
              {checklistProgress.done}/{checklistProgress.total}
            </span>
          )}

          {/* Blocked D+N badge */}
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

          {/* Status badge */}
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] px-1.5 py-0',
              task.status === 'doing'
                ? 'border-blue-500/30 text-blue-600 bg-blue-500/5'
                : 'border-border text-muted-foreground'
            )}
          >
            {task.status === 'doing' ? 'Fazendo' : 'A fazer'}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {enriched.configId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenConfig}
            className="h-6 px-1.5 text-[10px] gap-0.5"
          >
            <Eye size={11} />
          </Button>
        )}
        {!isBlockedDN && !isBlockedByBriefing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onComplete}
            className="h-6 px-1.5 text-[10px] gap-0.5 text-emerald-600 hover:text-emerald-700"
          >
            <CheckCircle2 size={11} />
          </Button>
        )}
      </div>
    </div>
  );
}
