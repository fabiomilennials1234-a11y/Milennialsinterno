import { useState, useMemo } from 'react';
import { useAssignedClients, useClientOnboarding } from '@/hooks/useAdsManager';
import { useClientTagsBatch } from '@/hooks/useClientTags';
import { Plus, Timer, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { differenceInDays } from 'date-fns';
import AdsCardDetailModal from './AdsCardDetailModal';
import AdsInstructionCardModal from './AdsInstructionCardModal';
import ClientViewModal from '@/components/client/ClientViewModal';
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ContractStatusBadge from '@/components/shared/ContractStatusBadge';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';
import ClientTagsList, { TAG_TORQUE_BLOQUEADO } from '@/components/client-tags/ClientTagsList';
import { FunilBadge } from '@/components/crm/FunilBadge';
import { MILESTONE_CARDS, MILESTONES, type MilestoneCard } from '@/lib/adsOnboarding/milestones';
import { clientRendersInOnboarding, type OnboardingRecord } from '@/lib/adsOnboarding/onboardingMembership';

export default function AdsOnboardingSection() {
  const { data: clients = [] } = useAssignedClients();
  const { data: onboardingData = [] } = useClientOnboarding();
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: tagsByClient } = useClientTagsBatch(clientIds);
  const [selectedCard, setSelectedCard] = useState<MilestoneCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Retorna clientes que estão em um step específico dentro de um milestone.
  // Membership ("renders in onboarding?") delega ao predicado compartilhado
  // — a mesma fonte da verdade que AdsNovoClienteSection usa para subtrair,
  // garantindo exclusão mútua entre as duas colunas.
  const getClientsForStep = (stepKey: string, milestoneNumber: number) => {
    const records = (onboardingData as unknown as OnboardingRecord[]) ?? [];
    return clients.filter(client => {
      if (!clientRendersInOnboarding(client, records)) return false;
      const onboarding = records.find(o => o.client_id === client.id);
      const clientMilestone = onboarding?.current_milestone || 1;
      const clientStep = onboarding?.current_step;
      return clientMilestone === milestoneNumber && clientStep === stepKey;
    });
  };

  const handleCardClick = (card: MilestoneCard) => {
    setSelectedCard(card);
    if (card.isInstructionCard) {
      setIsInstructionModalOpen(true);
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
        {MILESTONES.map(milestone => {
          const milestoneCards = MILESTONE_CARDS[milestone.number] || [];
          
          return (
            <div key={milestone.number} className="w-[280px] flex-shrink-0 flex flex-col bg-card rounded-2xl border border-subtle overflow-hidden shadow-apple">
              {/* Column Header - Colorido */}
              <div className={cn('px-4 py-3', milestone.color)}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{milestone.emoji}</span>
                  <span className="font-semibold text-sm text-white">{milestone.title}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-white/20 text-white rounded-full">
                    ⏰ MAX: {milestone.maxDays} Dias
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-apple bg-card">
                {milestoneCards.map(card => {
                  // Pega os clientes que estão neste step específico
                  const clientsInStep = card.stepKey 
                    ? getClientsForStep(card.stepKey, milestone.number) 
                    : [];

                  return (
                    <div key={card.id} className="space-y-2">
                      {/* Card de título/instrução */}
                      <div
                        onClick={() => handleCardClick(card)}
                        className={cn(
                          'kanban-card p-3 group border-l-[3px] cursor-pointer transition-all',
                          milestone.borderColor,
                          card.isInstructionCard && 'bg-gradient-to-r from-primary/5 to-warning/5 border-l-warning hover:shadow-lg hover:scale-[1.02]'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {card.isInstructionCard && (
                            <span className="text-warning text-lg">📖</span>
                          )}
                          <h4 className={cn(
                            "text-sm font-medium group-hover:text-primary transition-colors",
                            card.isInstructionCard ? "text-warning" : "text-foreground"
                          )}>
                            {card.title}
                          </h4>
                        </div>
                        {card.isInstructionCard && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Clique para ver instruções
                          </p>
                        )}
                      </div>

                      {/* Clientes que estão neste step */}
                      {clientsInStep.map(client => {
                        const daysInOnboarding = client.onboarding_started_at
                          ? differenceInDays(new Date(), new Date(client.onboarding_started_at))
                          : differenceInDays(new Date(), new Date(client.created_at));
                        const isOverdue = daysInOnboarding > milestone.maxDays;

                        return (
                          <div
                            key={client.id}
                            className={cn('kanban-card p-3 border-l-[3px] space-y-2 ml-3', milestone.borderColor, isOverdue && 'border-danger bg-danger/5')}
                          >
                            {/* Overdue Invoice Badge */}
                            <OverdueInvoiceBadge clientId={client.id} className="w-full justify-center" />
                            {/* Contract Status Badge */}
                            <ContractStatusBadge clientId={client.id} className="w-full justify-center" />
                            
                            {isOverdue && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-danger">
                                ⚠️ Atrasado — {daysInOnboarding - milestone.maxDays}d além do prazo
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <h4 className="text-sm font-medium text-foreground truncate">{client.name}</h4>
                                <ClientLabelBadge
                                  label={((client.client_label ?? null) as ClientLabel)}
                                  size="sm"
                                  className="shrink-0"
                                />
                              </div>
                              <span className={cn(
                                'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium',
                                isOverdue ? 'bg-danger text-white' : 'bg-info text-white'
                              )}>
                                <Timer size={10} />{daysInOnboarding} dias
                              </span>
                            </div>

                            <ClientTagsList
                              tags={tagsByClient?.get(client.id) ?? []}
                              size="sm"
                              excludeNames={[TAG_TORQUE_BLOQUEADO]}
                              className="mt-0"
                            />

                            {/* ADR 0010 — funil read-only no milestone criar_estrategia,
                                onde o ADS pensa a estratégia de aquisição. */}
                            {card.stepKey === 'criar_estrategia' && (
                              <FunilBadge funil={(client as { funil?: 'A' | 'B' | null }).funil ?? null} size="sm" />
                            )}

                            <Button
                              size="sm" 
                              variant="outline"
                              className="w-full h-8 text-xs gap-2"
                              onClick={() => setSelectedClientId(client.id)}
                            >
                              <Eye size={14} />
                              Ver Cliente
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <button className="w-full p-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl flex items-center gap-2 transition-colors border-2 border-dashed border-transparent hover:border-muted">
                  <Plus size={14} />Adicionar cartão
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AdsCardDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        card={selectedCard ? { id: selectedCard.id, title: selectedCard.title, description: selectedCard.description } : null}
        listName={selectedCard?.clientName ? `Cliente: ${selectedCard.clientName}` : undefined}
      />

      <AdsInstructionCardModal
        isOpen={isInstructionModalOpen}
        onClose={() => setIsInstructionModalOpen(false)}
        cardId={selectedCard?.id || null}
        cardTitle={selectedCard?.title || ''}
      />

      {selectedClientId && (
        <ClientViewModal
          key={selectedClientId}
          isOpen={true}
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </>
  );
}
