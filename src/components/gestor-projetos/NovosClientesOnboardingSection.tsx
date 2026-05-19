import { useMemo } from 'react';
import { Loader2, CheckCircle2, Phone, Users as UsersIcon, MessageSquare, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useGrowthGPNovosClientes,
  useGrowthAdvanceStep,
} from '@/hooks/useGrowthGPKanban';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import { TAG_BLOQUEADO_CX } from '@/components/client-tags/ClientTagsList';
import ClientTagsList from '@/components/client-tags/ClientTagsList';
import GrowthBlockingLabel from './GrowthBlockingLabel';
import { getOnboardingProgress } from '@/lib/growthOnboardingProgress';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fireCelebration } from '@/lib/confetti';
import type { GrowthGPClient } from '@/hooks/useGrowthGPKanban';
import type { ClientTag } from '@/hooks/useClientTags';

interface Props {
  onTeamSelectionNeeded?: (clientId: string) => void;
}

const STEPS = [
  {
    key: 'call_1',
    title: 'Realizar Call 1',
    emoji: '📞',
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
    emoji: '👥',
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
    emoji: '💬',
    color: 'bg-success',
    borderColor: 'border-l-success',
    filter: (c: GrowthGPClient) => {
      const p = getOnboardingProgress(c);
      return p.call1Complete && p.teamSelected && !p.addedToGroups;
    },
  },
] as const;

export default function NovosClientesOnboardingSection({ onTeamSelectionNeeded }: Props) {
  const { data: clients = [], isLoading } = useGrowthGPNovosClientes();
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: tagsMap } = useClientTagsBatch(clientIds);
  const advanceStep = useGrowthAdvanceStep();
  const queryClient = useQueryClient();

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

  const clientsByStep = useMemo(() => {
    const result: Record<string, GrowthGPClient[]> = {};
    for (const step of STEPS) {
      result[step.key] = clients.filter(step.filter);
    }
    return result;
  }, [clients]);

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
        <p className="font-medium text-sm">Nenhum cliente em onboarding</p>
      </div>
    );
  }

  const isPending = advanceStep.isPending || markAddedToGroups.isPending;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-1">
        {STEPS.map(step => {
          const stepClients = clientsByStep[step.key] || [];

          return (
            <div key={step.key} className="rounded-xl border border-subtle overflow-hidden bg-card shadow-apple">
              {/* Step header — colored like ADS onboarding */}
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

              {/* Client cards inside step */}
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
                      <StepClientCard
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
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ── Client card inside a step ──────────────────────────────────────────────

interface StepClientCardProps {
  client: GrowthGPClient;
  tags: ClientTag[];
  hasCXBlock: boolean;
  stepKey: string;
  borderColor: string;
  isPending: boolean;
  onAdvanceCall1: (clientId: string) => void;
  onTeamSelectionNeeded?: (clientId: string) => void;
  onMarkAddedToGroups: (clientId: string) => void;
}

function StepClientCard({
  client,
  tags,
  hasCXBlock,
  stepKey,
  borderColor,
  isPending,
  onAdvanceCall1,
  onTeamSelectionNeeded,
  onMarkAddedToGroups,
}: StepClientCardProps) {
  const displayName = client.razao_social || client.name;

  return (
    <div
      className={cn(
        'kanban-card p-3 border-l-[3px] space-y-2.5',
        borderColor,
        hasCXBlock && 'border-danger bg-danger/5',
      )}
    >
      {/* Client name */}
      <h4 className="text-sm font-medium text-foreground truncate">{displayName}</h4>

      {/* CX block */}
      {hasCXBlock && (
        <GrowthBlockingLabel text="BLOQUEADO: ESPERAR LIGAÇÃO DO CX" variant="danger" />
      )}

      {/* Tags */}
      <ClientTagsList
        tags={tags}
        size="sm"
        excludeNames={[TAG_BLOQUEADO_CX]}
        className="mt-0"
      />

      {/* Sub-step badge for call_1 */}
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

      {/* Action button per step */}
      {stepKey === 'call_1' && !hasCXBlock && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs gap-2"
          disabled={isPending}
          onClick={() => onAdvanceCall1(client.id)}
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
          onClick={() => onTeamSelectionNeeded(client.id)}
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
          onClick={() => onMarkAddedToGroups(client.id)}
        >
          <MessageSquare size={12} />
          Confirmar: Equipe nos Grupos
        </Button>
      )}
    </div>
  );
}
