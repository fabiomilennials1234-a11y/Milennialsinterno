import { useState, useMemo, useCallback } from 'react';
import { Loader2, CheckCircle2, ChevronRight, ChevronDown, Circle, Check, Users as UsersIcon, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useGrowthGPNovosClientes,
  useGrowthAdvanceStep,
  useCompleteGrowthGPTask,
} from '@/hooks/useGrowthGPKanban';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import { TAG_BLOQUEADO_CX, BLOCKING_TAGS } from '@/components/client-tags/ClientTagsList';
import ClientTagBadge from '@/components/client-tags/ClientTagBadge';
import GrowthBlockingLabel from './GrowthBlockingLabel';
import { getOnboardingProgress } from '@/lib/growthOnboardingProgress';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fireCelebration } from '@/lib/confetti';
import type { GrowthGPClient } from '@/hooks/useGrowthGPKanban';

interface Props {
  onTeamSelectionNeeded?: (clientId: string) => void;
}

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

  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }, []);

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

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 pr-2">
        {clients.map(client => {
          const tags = tagsMap?.get(client.id) || [];
          const hasCXBlock = tags.some(t => t.name === TAG_BLOQUEADO_CX);
          const isExpanded = expandedClients.has(client.id);
          const progress = getOnboardingProgress(client);

          return (
            <OnboardingCard
              key={client.id}
              client={client}
              progress={progress}
              hasCXBlock={hasCXBlock}
              tags={tags}
              isExpanded={isExpanded}
              onToggleExpand={() => toggleExpand(client.id)}
              onAdvanceCall1={(clientId) => {
                if (client.growth_gp_step === 'novos_clientes') {
                  advanceStep.mutate({ clientId, newStep: 'call_1_agendada' });
                } else if (client.growth_gp_step === 'call_1_agendada') {
                  advanceStep.mutate({ clientId, newStep: 'call_1_realizada' });
                }
              }}
              onTeamSelectionNeeded={onTeamSelectionNeeded}
              onMarkAddedToGroups={(clientId) => markAddedToGroups.mutate(clientId)}
              isPending={advanceStep.isPending || markAddedToGroups.isPending}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ done, label, num }: { done: boolean; label: string; num: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors shrink-0',
          done
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-muted text-muted-foreground border border-subtle',
        )}
      >
        {done ? <Check size={10} /> : num}
      </div>
      <span
        className={cn(
          'text-xs transition-colors',
          done ? 'text-emerald-400 line-through' : 'text-foreground',
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────

import type { OnboardingProgress } from '@/lib/growthOnboardingProgress';
import type { ClientTag } from '@/hooks/useClientTags';

interface OnboardingCardProps {
  client: GrowthGPClient;
  progress: OnboardingProgress;
  hasCXBlock: boolean;
  tags: ClientTag[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAdvanceCall1: (clientId: string) => void;
  onTeamSelectionNeeded?: (clientId: string) => void;
  onMarkAddedToGroups: (clientId: string) => void;
  isPending: boolean;
}

function OnboardingCard({
  client,
  progress,
  hasCXBlock,
  tags,
  isExpanded,
  onToggleExpand,
  onAdvanceCall1,
  onTeamSelectionNeeded,
  onMarkAddedToGroups,
  isPending,
}: OnboardingCardProps) {
  const displayName = client.razao_social || client.name;
  const completedCount = [progress.call1Complete, progress.teamSelected, progress.addedToGroups].filter(Boolean).length;

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
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {completedCount}/3
            </span>
          </div>

          {hasCXBlock && (
            <div className="mt-2">
              <GrowthBlockingLabel text="BLOQUEADO: ESPERAR A LIGACAO DO CX" variant="danger" />
            </div>
          )}

          {/* Compact step preview when collapsed */}
          {!isExpanded && (
            <div className="flex items-center gap-3 mt-2">
              <div className={cn('w-2 h-2 rounded-full', progress.call1Complete ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
              <div className={cn('w-2 h-2 rounded-full', progress.teamSelected ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
              <div className={cn('w-2 h-2 rounded-full', progress.addedToGroups ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
            </div>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-subtle/50 pt-3">
          {/* Step 1 */}
          <div className="space-y-2">
            <StepIndicator done={progress.call1Complete} label="Realizar Call 1" num={1} />
            {!progress.call1Complete && !hasCXBlock && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs ml-7"
                disabled={isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvanceCall1(client.id);
                }}
              >
                {client.growth_gp_step === 'novos_clientes'
                  ? 'Agendar Call 1'
                  : client.growth_gp_step === 'call_1_agendada'
                    ? 'Marcar Call 1 Realizada'
                    : 'Avançar Call 1'}
              </Button>
            )}
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <StepIndicator done={progress.teamSelected} label="Escolher Equipe" num={2} />
            {!progress.teamSelected && progress.call1Complete && onTeamSelectionNeeded && (
              <Button
                size="sm"
                className="w-full text-xs ml-7 bg-cyan-600 hover:bg-cyan-700"
                disabled={isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  onTeamSelectionNeeded(client.id);
                }}
              >
                Escolher Equipe Growth
              </Button>
            )}
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <StepIndicator done={progress.addedToGroups} label="Adicionar Equipe nos Grupos" num={3} />
            {!progress.addedToGroups && progress.teamSelected && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs ml-7"
                disabled={isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAddedToGroups(client.id);
                }}
              >
                Confirmar: Equipe Adicionada nos Grupos
              </Button>
            )}
          </div>

          {/* Tags */}
          {tags.filter(t => t.name !== TAG_BLOQUEADO_CX).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
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
        </div>
      )}
    </div>
  );
}
