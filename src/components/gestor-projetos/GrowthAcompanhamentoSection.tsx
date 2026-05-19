import { useMemo, useState, useCallback } from 'react';
import { Loader2, Users, CheckCircle2, ChevronDown, ChevronRight, Circle, Eye } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useGrowthGPAcompanhamento,
  useGrowthGPTasks,
  useAdsManagerNames,
  useCompleteGrowthGPTask,
  isGrowthV2Task,
} from '@/hooks/useGrowthGPKanban';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import { TAG_TORQUE_BLOQUEADO, BLOCKING_TAGS } from '@/components/client-tags/ClientTagsList';
import ClientTagBadge from '@/components/client-tags/ClientTagBadge';
import GrowthBlockingLabel from './GrowthBlockingLabel';
import GrowthCounterBadge from './GrowthCounterBadge';
import ClientViewModal from '@/components/client/ClientViewModal';
import type { GrowthGPClient, GrowthGPTask } from '@/hooks/useGrowthGPKanban';
import type { ClientTag } from '@/hooks/useClientTags';

// ── Unassigned group key ──
const UNASSIGNED = '__unassigned__';

export default function GrowthAcompanhamentoSection() {
  const { data: clients = [], isLoading } = useGrowthGPAcompanhamento();
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: tagsMap } = useClientTagsBatch(clientIds);
  const { data: tasksMap } = useGrowthGPTasks(clientIds);
  const completeTask = useCompleteGrowthGPTask();

  // Resolve ADS manager names
  const managerIds = useMemo(
    () => clients.map(c => c.assigned_ads_manager).filter(Boolean) as string[],
    [clients],
  );
  const { data: managerNames } = useAdsManagerNames(managerIds);

  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const toggleExpand = useCallback((clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  // Group clients by assigned_ads_manager
  const grouped = useMemo(() => {
    const byManager = new Map<string, GrowthGPClient[]>();

    for (const c of clients) {
      const key = c.assigned_ads_manager || UNASSIGNED;
      const list = byManager.get(key) || [];
      list.push(c);
      byManager.set(key, list);
    }

    // Sort groups: named managers first alphabetically, unassigned last
    const entries = [...byManager.entries()].sort((a, b) => {
      if (a[0] === UNASSIGNED) return 1;
      if (b[0] === UNASSIGNED) return -1;
      const nameA = managerNames?.get(a[0]) || '';
      const nameB = managerNames?.get(b[0]) || '';
      return nameA.localeCompare(nameB, 'pt-BR');
    });

    return entries;
  }, [clients, managerNames]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="mx-auto mb-2 opacity-50" size={32} />
        <p className="font-medium text-sm">Nenhum cliente Growth em acompanhamento</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-2">
        {grouped.map(([managerId, groupClients]) => {
          const managerName =
            managerId === UNASSIGNED
              ? 'Sem Gestor ADS'
              : managerNames?.get(managerId) || 'Gestor';
          const isCollapsed = collapsedGroups.has(managerId);

          return (
            <div key={managerId} className="space-y-1.5">
              {/* Manager group header */}
              <button
                onClick={() => toggleGroup(managerId)}
                className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <span className="text-muted-foreground shrink-0">
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </span>
                <Users size={12} className="text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                  {managerName}
                </span>
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] leading-none ml-auto shrink-0">
                  {groupClients.length}
                </Badge>
              </button>

              {/* Client cards */}
              {!isCollapsed && (
                <div className="space-y-2 pl-1">
                  {groupClients.map(client => {
                    const tags = tagsMap?.get(client.id) || [];
                    const tasks = tasksMap?.get(client.id) || [];
                    const isExpanded = expandedClients.has(client.id);

                    return (
                      <AcompanhamentoCard
                        key={client.id}
                        client={client}
                        tags={tags}
                        tasks={tasks}
                        isExpanded={isExpanded}
                        onToggleExpand={() => toggleExpand(client.id)}
                        onTaskComplete={(taskId) => completeTask.mutate({ taskId })}
                        isCompletingTask={completeTask.isPending}
                        onViewClient={setSelectedClientId}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedClientId && (
        <ClientViewModal
          key={selectedClientId}
          isOpen={true}
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </ScrollArea>
  );
}

// ── Acompanhamento card ─────────────────────────────────────────────────────

interface AcompanhamentoCardProps {
  client: GrowthGPClient;
  tags: ClientTag[];
  tasks: GrowthGPTask[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTaskComplete: (taskId: string) => void;
  isCompletingTask: boolean;
  onViewClient: (clientId: string) => void;
}

function AcompanhamentoCard({
  client,
  tags,
  tasks,
  isExpanded,
  onToggleExpand,
  onTaskComplete,
  isCompletingTask,
  onViewClient,
}: AcompanhamentoCardProps) {
  const displayName = client.razao_social || client.name;
  const hasTorqueBlock = tags.some(t => t.name === TAG_TORQUE_BLOQUEADO);
  const pendingTasks = tasks.filter(t => isGrowthV2Task(t) && t.status !== 'done');

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        hasTorqueBlock
          ? 'border-danger/30 bg-danger/5'
          : 'border-subtle bg-card hover:bg-muted/50',
      )}
    >
      <button
        onClick={onToggleExpand}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] gap-1 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onViewClient(client.id);
              }}
            >
              <Eye size={12} />
              Ver
            </Button>
          </div>

          {/* Counter badge */}
          {client.growth_counter_started_at && (
            <GrowthCounterBadge
              counterStartedAt={client.growth_counter_started_at}
              counterEndedAt={client.growth_counter_ended_at}
            />
          )}

          {/* TORQUE BLOQUEADO label */}
          {hasTorqueBlock && (
            <GrowthBlockingLabel text="TORQUE BLOQUEADO" variant="danger" />
          )}

          {/* Other tags */}
          {tags.filter(t => t.name !== TAG_TORQUE_BLOQUEADO).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags
                .filter(t => t.name !== TAG_TORQUE_BLOQUEADO)
                .map(tag => (
                  <ClientTagBadge
                    key={tag.id}
                    name={tag.name}
                    createdAt={tag.created_at}
                    expiresAt={tag.expires_at}
                    expiredAt={tag.expired_at}
                    size="sm"
                    blocking={BLOCKING_TAGS.has(tag.name)}
                    counterMode={tag.name === TAG_TORQUE_BLOQUEADO ? 'elapsed' : 'countdown'}
                  />
                ))}
            </div>
          )}

          {/* Task preview (collapsed) */}
          {!isExpanded && pendingTasks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Circle size={10} className="text-info shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {pendingTasks[0].title}
              </span>
              {pendingTasks.length > 1 && (
                <span className="text-[9px] text-muted-foreground/60 shrink-0">
                  +{pendingTasks.length - 1}
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      {/* Expanded: task list */}
      {isExpanded && pendingTasks.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-subtle/50 pt-2">
          {pendingTasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-info/5"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskComplete(task.id);
                }}
                disabled={isCompletingTask}
                className="shrink-0 group/check"
                title="Concluir tarefa"
              >
                <Circle
                  size={14}
                  className="text-info group-hover/check:text-success transition-colors"
                />
              </button>
              <span className="text-xs font-medium truncate">{task.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
