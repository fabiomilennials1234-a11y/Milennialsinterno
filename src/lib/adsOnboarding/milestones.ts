// Single source of truth for the ADS onboarding kanban structure.
//
// Both AdsOnboardingSection (which renders these cards) and the
// onboardingMembership predicate (which decides whether a client renders
// in onboarding, so AdsNovoClienteSection can subtract them) consume THIS
// module. Do not duplicate these shapes elsewhere — the duplicate-card bug
// came precisely from two independent predicates over the same client list.

export interface MilestoneCard {
  id: string;
  title: string;
  clientName?: string;
  description?: string;
  daysInMilestone?: number;
  taskId?: string;
  taskType?: string;
  isInstructionCard?: boolean;
  /** When present, clients sitting at this (milestone, stepKey) render under the card. */
  stepKey?: string;
}

// Conteúdo de instrução para cards especiais
export const INSTRUCTION_CARD_CONTENT: Record<string, string> = {
  'm2-5': `**O que enviar junto a estratégia? (Usar a exata ordem):**

LEMBRE: ANEXE NA DESCRICAO TUDO A BAIXO NO GRUPO DO CLIENTE.

Segue as copys para aprovar.

[COPY ANUNCIOS]
[COPY LP OU SITE INSTITUCIONAL]
PDF do Marco
Link do mapa mental: [Link]
[AUDIO Lembrando que ele precisa aprovar o material]`,
  'm3-2': `**IMPORTANTE -- NAO ESQUECER**

Apos brifar os criativos, avisar o cliente que os materiais ja foram brifados e informar o prazo de entrega previsto (Data X).`,
};

// Mapeamento de step para card ID
export const STEP_TO_CARD_ID: Record<string, string> = {
  'dar_boas_vindas': 'm2-1',
  'criar_estrategia': 'm2-2',
  'marcar_apresentacao_estrategia': 'm2-3',
  'realizar_apresentacao_estrategia': 'm2-4',
  'brifar_criativos': 'm3-1',
  'criativos_brifados': 'm3-2',
  'elencar_otimizacoes': 'm4-1',
  'configurar_conta_anuncios': 'm5-1',
  'marcar_call_apresentacao_torque': 'm5-2',
  'esperando_criativos': 'm5-3',
};

// Estrutura dos Marcos conforme especificado
// Marco 1 (Call #1) removido — Call 1 agora e responsabilidade do GP
export const MILESTONE_CARDS: Record<number, MilestoneCard[]> = {
  2: [
    { id: 'm2-1', title: 'Dar Boas Vindas', stepKey: 'dar_boas_vindas' },
    { id: 'm2-2', title: 'Criar Estratégia', stepKey: 'criar_estrategia' },
    { id: 'm2-3', title: 'Marcar Apresentação Estratégia', stepKey: 'marcar_apresentacao_estrategia' },
    { id: 'm2-4', title: 'Realizar Apresentação Estratégia', stepKey: 'realizar_apresentacao_estrategia' },
    { id: 'm2-5', title: 'Estratégia Apresentada [LER ESSE CARD]', isInstructionCard: true },
  ],
  3: [
    { id: 'm3-1', title: 'Brifar Criativos', stepKey: 'brifar_criativos' },
    { id: 'm3-2', title: '[3] Criativos Brifados [LER ESSE CARD]', isInstructionCard: true, stepKey: 'criativos_brifados' },
  ],
  4: [
    { id: 'm4-1', title: 'Elencar Otimizações Pendentes', stepKey: 'elencar_otimizacoes' },
  ],
  5: [
    { id: 'm5-1', title: 'Configurar Conta de Anúncios', stepKey: 'configurar_conta_anuncios' },
    { id: 'm5-2', title: 'Marcar Call Apresentação Torque', stepKey: 'marcar_call_apresentacao_torque' },
    { id: 'm5-3', title: 'Publicar campanha', stepKey: 'esperando_criativos' },
  ],
};

export interface Milestone {
  number: number;
  title: string;
  maxDays: number;
  emoji: string;
  color: string;
  borderColor: string;
}

export const MILESTONES: Milestone[] = [
  { number: 2, title: 'Estratégia PRO+ [Marco 2]', maxDays: 7, emoji: '2️⃣', color: 'bg-purple', borderColor: 'border-l-purple' },
  { number: 3, title: 'Criativos PRO+ [Marco 3]', maxDays: 5, emoji: '3️⃣', color: 'bg-success', borderColor: 'border-l-success' },
  { number: 4, title: 'Otimizações PRO+ [Marco 4]', maxDays: 6, emoji: '4️⃣', color: 'bg-warning', borderColor: 'border-l-warning' },
  { number: 5, title: 'Início [Marco 5]', maxDays: 14, emoji: '5️⃣', color: 'bg-primary', borderColor: 'border-l-primary' },
];
