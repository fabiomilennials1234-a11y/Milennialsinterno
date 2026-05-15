import { useState, useMemo, useCallback } from 'react';
import { Loader2, CheckCircle2, ChevronRight, Circle, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  useGrowthGPNovosClientes,
  useGrowthGPTasks,
  useGrowthAdvanceStep,
  useCompleteGrowthGPTask,
  isGrowthV2Task,
} from '@/hooks/useGrowthGPKanban';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import { TAG_BLOQUEADO_CX, BLOCKING_TAGS } from '@/components/client-tags/ClientTagsList';
import ClientTagBadge from '@/components/client-tags/ClientTagBadge';
import GrowthBlockingLabel from './GrowthBlockingLabel';
import type { GrowthGPClient, GrowthGPTask } from '@/hooks/useGrowthGPKanban';
import type { ClientTag } from '@/hooks/useClientTags';

interface Props {
  onTeamSelectionNeeded?: (clientId: string) => void;
}

type TabValue = 'novos_clientes' | 'call_1' | 'transicao';

const TAB_CONFIG: { value: TabValue; label: string }[] = [
  { value: 'novos_clientes', label: 'Novos' },
  { value: 'call_1', label: 'Call 1' },
  { value: 'transicao', label: 'Equipe' },
];

export default function GrowthNovosClientesSection({ onTeamSelectionNeeded }: Props) {
  const { data: clients = [], isLoading } = useGrowthGPNovosClientes();
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: tasksMap } = useGrowthGPTasks(clientIds);
  const { data: tagsMap } = useClientTagsBatch(clientIds);
  const advanceStep = useGrowthAdvanceStep();
  const completeTask = useCompleteGrowthGPTask();

  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }, []);

  // Group clients by tab
  const grouped = useMemo(() => {
    const novos: GrowthGPClient[] = [];
    const call1: GrowthGPClient[] = [];
    const transicao: GrowthGPClient[] = [];

    for (const c of clients) {
      switch (c.growth_gp_step) {
        case 'novos_clientes':
          novos.push(c);
          break;
        case 'call_1_agendada':
        case 'call_1_realizada':
          call1.push(c);
          break;
        default:
          transicao.push(c);
      }
    }
    return { novos_clientes: novos, call_1: call1, transicao };
  }, [clients]);

  const counts: Record<TabValue, number> = {
    novos_clientes: grouped.novos_clientes.length,
    call_1: grouped.call_1.length,
    transicao: grouped.transicao.length,
  };

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
        <p className="font-medium text-sm">Nenhum cliente Growth em onboarding</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="novos_clientes" className="flex flex-col h-full">
        <TabsList className="w-full shrink-0 h-9 bg-muted/60">
          {TAB_CONFIG.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-1 text-[11px] gap-1 data-[state=active]:bg-card"
            >
              {tab.label}
              {counts[tab.value] > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 px-1 text-[9px] leading-none"
                >
                  {counts[tab.value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="novos_clientes" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-2 pt-3 pr-2">
              {grouped.novos_clientes.length === 0 ? (
                <EmptyState text="Nenhum cliente novo" />
              ) : (
                grouped.novos_clientes.map(client => (
                  <NovosClientesCard
                    key={client.id}
                    client={client}
                    tags={tagsMap?.get(client.id) || []}
                    tasks={tasksMap?.get(client.id) || []}
                    isExpanded={expandedClients.has(client.id)}
                    onToggleExpand={() => toggleExpand(client.id)}
                    onAdvance={(clientId) => {
                      advanceStep.mutate({ clientId, newStep: 'call_1_agendada' });
                    }}
                    isPending={advanceStep.isPending}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="call_1" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-2 pt-3 pr-2">
              {grouped.call_1.length === 0 ? (
                <EmptyState text="Nenhum cliente neste step" />
              ) : (
                grouped.call_1.map(client => (
                  <Call1Card
                    key={client.id}
                    client={client}
                    tags={tagsMap?.get(client.id) || []}
                    tasks={tasksMap?.get(client.id) || []}
                    isExpanded={expandedClients.has(client.id)}
                    onToggleExpand={() => toggleExpand(client.id)}
                    onTaskComplete={(taskId) => completeTask.mutate({ taskId })}
                    onTeamSelectionNeeded={onTeamSelectionNeeded}
                    isCompletingTask={completeTask.isPending}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="transicao" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-2 pt-3 pr-2">
              {grouped.transicao.length === 0 ? (
                <EmptyState text="Nenhum cliente em transicao" />
              ) : (
                grouped.transicao.map(client => (
                  <TransicaoCard
                    key={client.id}
                    client={client}
                    tags={tagsMap?.get(client.id) || []}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-xs text-muted-foreground/60 italic text-center py-6">
      {text}
    </p>
  );
}

// ── Novos Clientes card ─────────────────────────────────────────────────────

interface NovosClientesCardProps {
  client: GrowthGPClient;
  tags: ClientTag[];
  tasks: GrowthGPTask[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAdvance: (clientId: string) => void;
  isPending: boolean;
}

function NovosClientesCard({
  client,
  tags,
  tasks,
  isExpanded,
  onToggleExpand,
  onAdvance,
  isPending,
}: NovosClientesCardProps) {
  const displayName = client.razao_social || client.name;
  const hasCXBlock = tags.some(t => t.name === TAG_BLOQUEADO_CX);
  const pendingTasks = tasks.filter(t => isGrowthV2Task(t) && t.status !== 'done');

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        hasCXBlock
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
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{displayName}</p>

          {/* CX blocking label */}
          {hasCXBlock && (
            <div className="mt-2">
              <GrowthBlockingLabel
                text="BLOQUEADO: ESPERAR A LIGACAO DO CX"
                variant="danger"
              />
            </div>
          )}

          {/* Tag badges */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags
                .filter(t => t.name !== TAG_BLOQUEADO_CX)
                .map(tag => (
                  <ClientTagBadge
                    key={tag.id}
                    name={tag.name}
                    createdAt={tag.created_at}
                    expiresAt={tag.expires_at}
                    expiredAt={tag.expired_at}
                    size="sm"
                    blocking={BLOCKING_TAGS.has(tag.name)}
                  />
                ))}
            </div>
          )}

          {/* Auto-task preview (collapsed) */}
          {!isExpanded && pendingTasks.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Circle size={10} className="text-info shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {pendingTasks[0].title}
              </span>
            </div>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-subtle/50">
          {pendingTasks.length > 0 && (
            <div className="pt-2 space-y-1">
              {pendingTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Circle size={10} className="text-info shrink-0" />
                  <span className="truncate">{task.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Advance button -- only if CX block is dismissed */}
          {!hasCXBlock && (
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2 text-xs"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                onAdvance(client.id);
              }}
            >
              Avancar para Call 1
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Call 1 card ─────────────────────────────────────────────────────────────

interface Call1CardProps {
  client: GrowthGPClient;
  tags: ClientTag[];
  tasks: GrowthGPTask[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTaskComplete: (taskId: string) => void;
  onTeamSelectionNeeded?: (clientId: string) => void;
  isCompletingTask: boolean;
}

function Call1Card({
  client,
  tags,
  tasks,
  isExpanded,
  onToggleExpand,
  onTaskComplete,
  onTeamSelectionNeeded,
  isCompletingTask,
}: Call1CardProps) {
  const displayName = client.razao_social || client.name;
  const isRealized = client.growth_gp_step === 'call_1_realizada';
  const pendingTasks = tasks.filter(t => isGrowthV2Task(t) && t.status !== 'done');
  const activeTask = pendingTasks[0];

  return (
    <div className="rounded-xl border border-subtle bg-card hover:bg-muted/50 transition-all duration-200">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <Badge
              variant="secondary"
              className={cn(
                'text-[9px] shrink-0',
                isRealized
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/20',
              )}
            >
              {isRealized ? 'Call Realizada' : 'Call Agendada'}
            </Badge>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {tags.map(tag => (
                <ClientTagBadge
                  key={tag.id}
                  name={tag.name}
                  createdAt={tag.created_at}
                  expiresAt={tag.expires_at}
                  expiredAt={tag.expired_at}
                  size="sm"
                  blocking={BLOCKING_TAGS.has(tag.name)}
                />
              ))}
            </div>
          )}

          {/* Active task preview */}
          {!isExpanded && activeTask && (
            <div className="flex items-center gap-1.5 mt-2">
              <Circle size={10} className="text-info shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {activeTask.title}
              </span>
            </div>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-subtle/50 pt-2">
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

          {/* Team selection -- for call_1_realizada step */}
          {isRealized && onTeamSelectionNeeded && (
            <Button
              size="sm"
              className="w-full mt-1 text-xs bg-cyan-600 hover:bg-cyan-700"
              onClick={(e) => {
                e.stopPropagation();
                onTeamSelectionNeeded(client.id);
              }}
            >
              Escolher Equipe Growth
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Transicao card (awaiting team popup completion) ─────────────────────────

function TransicaoCard({
  client,
  tags,
}: {
  client: GrowthGPClient;
  tags: ClientTag[];
}) {
  const displayName = client.razao_social || client.name;

  return (
    <div className="rounded-xl border border-subtle bg-card p-3 space-y-2 opacity-60">
      <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <ClientTagBadge
              key={tag.id}
              name={tag.name}
              createdAt={tag.created_at}
              expiresAt={tag.expires_at}
              expiredAt={tag.expired_at}
              size="sm"
            />
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground italic">
        Aguardando designacao de equipe...
      </p>
    </div>
  );
}
