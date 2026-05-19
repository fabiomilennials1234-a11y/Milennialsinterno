import { useMemo, useState } from 'react';
import { Loader2, CheckCircle2, Phone, Users as UsersIcon, MessageSquare, Rocket, ArrowRight, Eye } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useGrowthGPNovosClientes,
  useGrowthGPTasks,
  useGrowthAdvanceStep,
  useCompleteGrowthGPTask,
  isGrowthV2Task,
} from '@/hooks/useGrowthGPKanban';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import { TAG_BLOQUEADO_CX } from '@/components/client-tags/ClientTagsList';
import ClientTagsList from '@/components/client-tags/ClientTagsList';
import GrowthBlockingLabel from './GrowthBlockingLabel';
import ClientViewModal from '@/components/client/ClientViewModal';
import { getOnboardingProgress } from '@/lib/growthOnboardingProgress';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fireCelebration } from '@/lib/confetti';
import type { GrowthGPClient, GrowthGPTask } from '@/hooks/useGrowthGPKanban';
import type { ClientTag } from '@/hooks/useClientTags';

interface Props {
  onTeamSelectionNeeded?: (clientId: string) => void;
}

// ── V1 steps (legacy: filter by getOnboardingProgress) ──────────────────────

const V1_STEPS = [
  {
    key: 'call_1',
    title: 'Realizar Call 1',
    emoji: '\u{1F4DE}',
    color: 'bg-purple',
    borderColor: 'border-l-purple',
    filter: (c: GrowthGPClient) => {
      const p = getOnboardingProgress(c);
      return !p.call1Complete;
    },
  },
  {
    key: 'equipe',
    title: 'Escolher Equipe',
    emoji: '\u{1F465}',
    color: 'bg-cyan-600',
    borderColor: 'border-l-cyan-500',
    filter: (c: GrowthGPClient) => {
      const p = getOnboardingProgress(c);
      return p.call1Complete && !p.teamSelected;
    },
  },
  {
    key: 'grupos',
    title: 'Adicionar nos Grupos',
    emoji: '\u{1F4AC}',
    color: 'bg-success',
    borderColor: 'border-l-success',
    filter: (c: GrowthGPClient) => {
      const p = getOnboardingProgress(c);
      return p.call1Complete && p.teamSelected && !p.addedToGroups;
    },
  },
] as const;

// ── V2 steps (filter by growth_gp_step directly) ──────────────────────────

interface V2StepDef {
  key: string;
  step: string;
  title: string;
  emoji: string;
  color: string;
  borderColor: string;
  nextStep: string | null;
  actionLabel: string | null;
  actionType: 'advance' | 'team_selection' | null;
}

const V2_STEPS: V2StepDef[] = [
  {
    key: 'v2_novos_clientes',
    step: 'novos_clientes',
    title: 'Novos Clientes',
    emoji: '\u{1F195}',
    color: 'bg-blue-600',
    borderColor: 'border-l-blue-500',
    nextStep: 'realizar_call_1',
    actionLabel: 'Avancar para Call 1',
    actionType: 'advance',
  },
  {
    key: 'v2_realizar_call_1',
    step: 'realizar_call_1',
    title: 'Realizar Call 1',
    emoji: '\u{1F4DE}',
    color: 'bg-purple',
    borderColor: 'border-l-purple',
    nextStep: 'escolher_equipe',
    actionLabel: 'Avancar para Escolher Equipe',
    actionType: 'advance',
  },
  {
    key: 'v2_escolher_equipe',
    step: 'escolher_equipe',
    title: 'Escolher Equipe',
    emoji: '\u{1F465}',
    color: 'bg-cyan-600',
    borderColor: 'border-l-cyan-500',
    nextStep: null,
    actionLabel: 'Escolher Equipe Growth',
    actionType: 'team_selection',
  },
  {
    key: 'v2_alinhar_projeto',
    step: 'alinhar_projeto',
    title: 'Alinhar Projeto',
    emoji: '\u{1F3AF}',
    color: 'bg-amber-600',
    borderColor: 'border-l-amber-500',
    nextStep: null,
    actionLabel: null,
    actionType: null,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function NovosClientesOnboardingSection({ onTeamSelectionNeeded }: Props) {
  const { data: clients = [], isLoading } = useGrowthGPNovosClientes();
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: tagsMap } = useClientTagsBatch(clientIds);
  const { data: tasksMap } = useGrowthGPTasks(clientIds);
  const advanceStep = useGrowthAdvanceStep();
  const completeTask = useCompleteGrowthGPTask();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const markAddedToGroups = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .update({ growth_team_added_to_groups: true } as never)
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: (_data, clientId) => {
      fireCelebration();
      queryClient.invalidateQueries({ queryKey: ['growth-gp-novos'] });
      queryClient.invalidateQueries({ queryKey: ['growth-gp-acompanhamento'] });

      const client = clients.find(c => c.id === clientId);
      if (client) {
        const progress = getOnboardingProgress({
          ...client,
          growth_team_added_to_groups: true,
        });
        if (progress.allComplete) {
          advanceStep.mutate({ clientId, newStep: 'acompanhamento_gestores' });
        }
      }

      toast.success('Equipe adicionada nos grupos!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao marcar grupos', { description: error.message });
    },
  });

  // Split clients by flow version
  const { v1Clients, v2Clients } = useMemo(() => {
    const v1: GrowthGPClient[] = [];
    const v2: GrowthGPClient[] = [];
    for (const c of clients) {
      if (c.growth_flow_version === 2) {
        v2.push(c);
      } else {
        v1.push(c);
      }
    }
    return { v1Clients: v1, v2Clients: v2 };
  }, [clients]);

  // V1: group by old progress-based steps
  const v1ByStep = useMemo(() => {
    const result: Record<string, GrowthGPClient[]> = {};
    for (const step of V1_STEPS) {
      result[step.key] = v1Clients.filter(step.filter);
    }
    return result;
  }, [v1Clients]);

  // V2: group by growth_gp_step
  const v2ByStep = useMemo(() => {
    const result: Record<string, GrowthGPClient[]> = {};
    for (const step of V2_STEPS) {
      result[step.key] = v2Clients.filter(c => c.growth_gp_step === step.step);
    }
    return result;
  }, [v2Clients]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPending = advanceStep.isPending || markAddedToGroups.isPending || completeTask.isPending;
  const hasV1 = v1Clients.length > 0;
  const hasV2 = v2Clients.length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-1">
        {/* ── V2 Steps (always visible) ── */}
        {V2_STEPS.map(step => {
          const stepClients = v2ByStep[step.key] || [];

          return (
            <div key={step.key} className="rounded-xl border border-subtle overflow-hidden bg-card shadow-apple">
              <div className={cn('px-3.5 py-2.5', step.color)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{step.emoji}</span>
                    <span className="font-semibold text-xs text-white">{step.title}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-5 px-1.5 text-[10px] bg-white/20 text-white border-0"
                  >
                    {stepClients.length}
                  </Badge>
                </div>
              </div>

              <div className="p-2.5 space-y-2 bg-card overflow-hidden">
                {stepClients.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/50 italic text-center py-3">
                    Nenhum cliente nesta etapa
                  </p>
                ) : (
                  stepClients.map(client => {
                    const tags = tagsMap?.get(client.id) || [];
                    const tasks = tasksMap?.get(client.id) || [];
                    const hasCXBlock = tags.some(t => t.name === TAG_BLOQUEADO_CX);

                    return (
                      <V2StepClientCard
                        key={client.id}
                        client={client}
                        tags={tags}
                        tasks={tasks}
                        hasCXBlock={hasCXBlock}
                        stepDef={step}
                        isPending={isPending}
                        onAdvance={(clientId, nextStep) => {
                          advanceStep.mutate({ clientId, newStep: nextStep });
                        }}
                        onTeamSelectionNeeded={onTeamSelectionNeeded}
                        onTaskComplete={(taskId) => completeTask.mutate({ taskId })}
                        onViewClient={setSelectedClientId}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        {/* ── V1 Steps (legacy) ── */}
        {hasV1 && (
          <>
            {hasV2 && (
              <div className="flex items-center gap-2 px-1 py-1">
                <div className="h-px flex-1 bg-subtle" />
                <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-medium">Fluxo anterior</span>
                <div className="h-px flex-1 bg-subtle" />
              </div>
            )}
            {V1_STEPS.map(step => {
              const stepClients = v1ByStep[step.key] || [];

              return (
                <div key={step.key} className="rounded-xl border border-subtle overflow-hidden bg-card shadow-apple">
                  <div className={cn('px-3.5 py-2.5', step.color)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{step.emoji}</span>
                        <span className="font-semibold text-xs text-white">{step.title}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="h-5 min-w-5 px-1.5 text-[10px] bg-white/20 text-white border-0"
                      >
                        {stepClients.length}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-2.5 space-y-2 bg-card">
                    {stepClients.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/50 italic text-center py-3">
                        Nenhum cliente nesta etapa
                      </p>
                    ) : (
                      stepClients.map(client => {
                        const tags = tagsMap?.get(client.id) || [];
                        const hasCXBlock = tags.some(t => t.name === TAG_BLOQUEADO_CX);

                        return (
                          <V1StepClientCard
                            key={client.id}
                            client={client}
                            tags={tags}
                            hasCXBlock={hasCXBlock}
                            stepKey={step.key}
                            borderColor={step.borderColor}
                            isPending={isPending}
                            onAdvanceCall1={(clientId) => {
                              if (client.growth_gp_step === 'novos_clientes') {
                                advanceStep.mutate({ clientId, newStep: 'call_1_agendada' });
                              } else if (client.growth_gp_step === 'call_1_agendada') {
                                advanceStep.mutate({ clientId, newStep: 'call_1_realizada' });
                              }
                            }}
                            onTeamSelectionNeeded={onTeamSelectionNeeded}
                            onMarkAddedToGroups={(clientId) => markAddedToGroups.mutate(clientId)}
                            onViewClient={setSelectedClientId}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Empty state removed — V2 sections always visible with per-step empty state */}
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

// ── V2 Client card ────────────────────────────────────────────────────────────

interface V2StepClientCardProps {
  client: GrowthGPClient;
  tags: ClientTag[];
  tasks: GrowthGPTask[];
  hasCXBlock: boolean;
  stepDef: V2StepDef;
  isPending: boolean;
  onAdvance: (clientId: string, nextStep: string) => void;
  onTeamSelectionNeeded?: (clientId: string) => void;
  onTaskComplete: (taskId: string) => void;
  onViewClient: (clientId: string) => void;
}

function V2StepClientCard({
  client,
  tags,
  tasks,
  hasCXBlock,
  stepDef,
  isPending,
  onAdvance,
  onTeamSelectionNeeded,
  onTaskComplete,
  onViewClient,
}: V2StepClientCardProps) {
  const displayName = client.razao_social || client.name;
  const pendingTasks = tasks.filter(t => isGrowthV2Task(t) && t.status !== 'done');

  return (
    <div
      className={cn(
        'kanban-card p-3 border-l-[3px] space-y-2.5 cursor-pointer overflow-hidden min-w-0',
        stepDef.borderColor,
        hasCXBlock && 'border-danger bg-danger/5',
      )}
      onClick={() => onViewClient(client.id)}
    >
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-foreground truncate">{displayName}</h4>
        <Eye size={12} className="shrink-0 text-muted-foreground" />
      </div>

      {hasCXBlock && (
        <GrowthBlockingLabel text="BLOQUEADO: ESPERAR LIGACAO DO CX" variant="danger" />
      )}

      <ClientTagsList
        tags={tags}
        size="sm"
        excludeNames={[TAG_BLOQUEADO_CX]}
        className="mt-0"
      />

      {pendingTasks.length > 0 && (
        <div className="space-y-1">
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
                disabled={isPending}
                className="shrink-0 group/check"
                title="Concluir tarefa"
              >
                <div className="w-3.5 h-3.5 rounded-full border-2 border-info group-hover/check:border-success group-hover/check:bg-success/20 transition-colors" />
              </button>
              <span className="text-xs font-medium truncate">{task.title}</span>
            </div>
          ))}
        </div>
      )}

      {!hasCXBlock && stepDef.actionType === 'advance' && stepDef.nextStep && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-2"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation();
            onAdvance(client.id, stepDef.nextStep!);
          }}
        >
          <ArrowRight size={12} />
          {stepDef.actionLabel}
        </Button>
      )}

      {!hasCXBlock && stepDef.actionType === 'team_selection' && onTeamSelectionNeeded && (
        <Button
          size="sm"
          className="w-full h-8 text-xs gap-2 bg-cyan-600 hover:bg-cyan-700"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation();
            onTeamSelectionNeeded(client.id);
          }}
        >
          <UsersIcon size={12} />
          {stepDef.actionLabel}
        </Button>
      )}
    </div>
  );
}

// ── V1 Client card (legacy — unchanged logic) ─────────────────────────────────

interface V1StepClientCardProps {
  client: GrowthGPClient;
  tags: ClientTag[];
  hasCXBlock: boolean;
  stepKey: string;
  borderColor: string;
  isPending: boolean;
  onAdvanceCall1: (clientId: string) => void;
  onTeamSelectionNeeded?: (clientId: string) => void;
  onMarkAddedToGroups: (clientId: string) => void;
  onViewClient: (clientId: string) => void;
}

function V1StepClientCard({
  client,
  tags,
  hasCXBlock,
  stepKey,
  borderColor,
  isPending,
  onAdvanceCall1,
  onTeamSelectionNeeded,
  onMarkAddedToGroups,
  onViewClient,
}: V1StepClientCardProps) {
  const displayName = client.razao_social || client.name;

  return (
    <div
      className={cn(
        'kanban-card p-3 border-l-[3px] space-y-2.5 cursor-pointer overflow-hidden min-w-0',
        borderColor,
        hasCXBlock && 'border-danger bg-danger/5',
      )}
      onClick={() => onViewClient(client.id)}
    >
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-foreground truncate">{displayName}</h4>
        <Eye size={12} className="shrink-0 text-muted-foreground" />
      </div>

      {hasCXBlock && (
        <GrowthBlockingLabel text="BLOQUEADO: ESPERAR LIGACAO DO CX" variant="danger" />
      )}

      <ClientTagsList
        tags={tags}
        size="sm"
        excludeNames={[TAG_BLOQUEADO_CX]}
        className="mt-0"
      />

      {stepKey === 'call_1' && (
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className={cn(
              'text-[9px]',
              client.growth_gp_step === 'call_1_agendada'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {client.growth_gp_step === 'novos_clientes'
              ? 'Aguardando Agendamento'
              : 'Call Agendada'}
          </Badge>
        </div>
      )}

      {stepKey === 'call_1' && !hasCXBlock && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-2"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation();
            onAdvanceCall1(client.id);
          }}
        >
          <Phone size={12} />
          {client.growth_gp_step === 'novos_clientes'
            ? 'Agendar Call 1'
            : 'Marcar Call Realizada'}
        </Button>
      )}

      {stepKey === 'equipe' && onTeamSelectionNeeded && (
        <Button
          size="sm"
          className="w-full h-8 text-xs gap-2 bg-cyan-600 hover:bg-cyan-700"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation();
            onTeamSelectionNeeded(client.id);
          }}
        >
          <UsersIcon size={12} />
          Escolher Equipe Growth
        </Button>
      )}

      {stepKey === 'grupos' && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-2"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation();
            onMarkAddedToGroups(client.id);
          }}
        >
          <MessageSquare size={12} />
          Confirmar: Equipe nos Grupos
        </Button>
      )}
    </div>
  );
}
