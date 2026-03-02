import { useState } from 'react';
import { useOutboundAssignedClients, useOutboundClientOnboarding, useOutboundCompleteOnboarding } from '@/hooks/useOutboundManager';
import { Plus, Timer, Eye, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { differenceInDays } from 'date-fns';
import OutboundCardDetailModal from './OutboundCardDetailModal';
import OutboundInstructionCardModal from './OutboundInstructionCardModal';
import ClientViewModal from '@/components/client/ClientViewModal';
import OverdueInvoiceBadge from '@/components/shared/OverdueInvoiceBadge';
import ContractStatusBadge from '@/components/shared/ContractStatusBadge';
import ClientLabelBadge, { type ClientLabel } from '@/components/shared/ClientLabelBadge';

interface MilestoneCard {
  id: string;
  title: string;
  clientName?: string;
  description?: string;
  daysInMilestone?: number;
  taskId?: string;
  taskType?: string;
  isInstructionCard?: boolean;
  stepKey?: string;
}

// Conteúdo de instrução para cards especiais
const INSTRUCTION_CARD_CONTENT: Record<string, string> = {
  'm1-2': `**PÓS CALL 1, VOCÊ DEVE:**

1 - Solicitar estruturação DO CRM ao GESTOR DE CRM

**Enviar ao Cliente E anexar na descrição do grupo:**

📂 Link do drive para subir fotos e identidade visual: [DRIVE]

📅 Link para iniciarem o acompanhamento comercial: https://calendar.app.google/eTa4J8LbFMD4eFNy6`,
  'm2-2': `**O que enviar junto a estratégia? (Usar a exata ordem):**

⚠️ LEMBRE: ANEXE NA DESCRICAO TUDO A BAIXO NO GRUPO DO CLIENTE.

Segue as copys para aprovar.

[COPY ANÚNCIOS]
[COPY LP OU SITE INSTITUCIONAL]
PDF do Marco
Link do mapa mental: [Link]
[AUDIO Lembrando que ele precisa aprovar o material]`,
  'm3-2': `**IMPORTANTE – NÃO ESQUECER**

Após brifar os criativos, avisar o cliente que os materiais já foram brifados e informar o prazo de entrega previsto (Data X).`,
};

// Mapeamento de step para card ID
const STEP_TO_CARD_ID: Record<string, string> = {
  'call_1_marcada': 'm1-1',
  'call_1_realizada': 'm1-2',
  'criar_estrategia': 'm2-1',
  'brifar_criativos': 'm3-1',
  'criativos_brifados': 'm3-2',
  'marcar_call_aprovacao': 'm4-1',
  'call_aprovada': 'm4-2',
  'subir_listagem_campanha': 'm5-1',
  'iniciar_prospecoes': 'm5-2',
  'acompanhar_cliente': 'm5-3',
};

// Estrutura dos Marcos conforme especificado
const MILESTONE_CARDS: Record<number, MilestoneCard[]> = {
  1: [
    { id: 'm1-1', title: 'Call #1 Marcada', stepKey: 'call_1_marcada' },
    { id: 'm1-2', title: 'Call #1 Realizada (LER ESSE CARD)', isInstructionCard: true, stepKey: 'call_1_realizada' },
  ],
  2: [
    { id: 'm2-1', title: 'Montar Lista de Prospecção', stepKey: 'criar_estrategia' },
    { id: 'm2-2', title: '[ 2 ] Como Montar a Lista [LER ESSE CARD]', isInstructionCard: true },
  ],
  3: [
    { id: 'm3-1', title: 'Criar Copilot', stepKey: 'brifar_criativos' },
    { id: 'm3-2', title: '[3] Copilot Configurado [LER ESSE CARD]', isInstructionCard: true, stepKey: 'criativos_brifados' },
  ],
  4: [
    { id: 'm4-1', title: 'Marcar Call para Aprovação', stepKey: 'marcar_call_aprovacao' },
    { id: 'm4-2', title: 'Call Realizada e Aprovada', stepKey: 'call_aprovada' },
  ],
  5: [
    { id: 'm5-1', title: 'Subir Listagem e Criar Campanha [LER ESSE CARD]', isInstructionCard: true, stepKey: 'subir_listagem_campanha' },
    { id: 'm5-2', title: 'Iniciar Prospecções / Disparos de Mensagens', stepKey: 'iniciar_prospecoes' },
    { id: 'm5-3', title: 'Acompanhar Cliente', stepKey: 'acompanhar_cliente' },
  ],
};

const MILESTONES = [
  { number: 1, title: 'Call #1 [Marco 1]', maxDays: 3, emoji: '1️⃣', color: 'bg-info', borderColor: 'border-l-info' },
  { number: 2, title: 'Planejamento de Listas [Marco 2]', maxDays: 4, emoji: '2️⃣', color: 'bg-purple', borderColor: 'border-l-purple' },
  { number: 3, title: 'Criação e Configuração Copilot [Marco 3]', maxDays: 5, emoji: '3️⃣', color: 'bg-success', borderColor: 'border-l-success' },
  { number: 4, title: 'Call de Aprovação da Estratégia [Marco 4]', maxDays: 6, emoji: '4️⃣', color: 'bg-warning', borderColor: 'border-l-warning' },
  { number: 5, title: 'Início [Marco 5]', maxDays: 14, emoji: '5️⃣', color: 'bg-primary', borderColor: 'border-l-primary' },
];

export default function OutboundOnboardingSection() {
  const { data: clients = [] } = useOutboundAssignedClients();
  const { data: onboardingData = [] } = useOutboundClientOnboarding();
  const completeOnboarding = useOutboundCompleteOnboarding();
  const [selectedCard, setSelectedCard] = useState<MilestoneCard | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Retorna clientes que estão em um step específico dentro de um milestone
  const getClientsForStep = (stepKey: string, milestoneNumber: number) => {
    return clients.filter(client => {
      // Aceitar clientes em onboarding ou new_client (que já iniciaram processo)
      if (client.status !== 'onboarding' && client.status !== 'new_client') return false;
      const onboarding = onboardingData.find((o: any) => o.client_id === client.id);
      if (!onboarding) return false;
      const clientMilestone = onboarding.current_milestone || 1;
      const clientStep = onboarding.current_step;
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

                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-8 text-xs gap-2"
                                onClick={() => setSelectedClientId(client.id)}
                              >
                                <Eye size={14} />
                                Ver Cliente
                              </Button>

                              {milestone.number === 5 && (
                                <Button
                                  size="sm"
                                  className="flex-1 h-8 text-xs gap-1.5 bg-success hover:bg-success/90 text-white"
                                  disabled={completeOnboarding.isPending}
                                  onClick={() => completeOnboarding.mutate({ clientId: client.id, clientName: client.name })}
                                >
                                  <CheckCircle size={12} />
                                  {completeOnboarding.isPending ? 'Ativando...' : 'Concluir'}
                                </Button>
                              )}
                            </div>
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

      <OutboundCardDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        card={selectedCard ? { id: selectedCard.id, title: selectedCard.title, description: selectedCard.description } : null}
        listName={selectedCard?.clientName ? `Cliente: ${selectedCard.clientName}` : undefined}
      />

      <OutboundInstructionCardModal
        isOpen={isInstructionModalOpen}
        onClose={() => setIsInstructionModalOpen(false)}
        cardId={selectedCard?.id || null}
        cardTitle={selectedCard?.title || ''}
      />

      {selectedClientId && (
        <ClientViewModal
          isOpen={!!selectedClientId}
          onClose={() => setSelectedClientId(null)}
          clientId={selectedClientId}
        />
      )}
    </>
  );
}
