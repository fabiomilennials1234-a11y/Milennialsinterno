import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDataScope } from '@/hooks/useDataScope';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { resolveTaskOwner } from './utils/resolveTaskOwner';

// =============================================================
// Gestor de CRM — Hook central
//
// Espelha o padrão de `useMktplaceKanban.ts`, mas com 3 state-machines
// INDEPENDENTES (uma por produto: v8, automation, copilot).
//
// Convenção de status do cliente no kanban (campo `clients.crm_status`):
//   null            → não está no fluxo do CRM
//   'novo'          → entrou em "Novos clientes"
//   'boas_vindas'   → tarefa de boas-vindas em andamento (Boas-vindas)
//   'acompanhamento'→ cliente em acompanhamento diário (dia em crm_daily_tracking)
//   'finalizado'    → sinalização opcional caso TODAS as configurações tenham terminado
//
// Os cards das 3 colunas de configuração (V8/Automation/Copilot) NÃO dependem
// do `crm_status` do cliente — eles vivem em `crm_configuracoes`, uma linha
// por (cliente, produto). Isso mantém os fluxos 100% independentes.
// =============================================================

// ================= PRODUTOS E ROTULAGEM =================

export type CrmProduto = 'v8' | 'automation' | 'copilot';

export const CRM_PRODUTO_LABEL: Record<CrmProduto, string> = {
  v8: 'V8',
  automation: 'Automation',
  copilot: 'Copilot',
};

export const CRM_PRODUTO_COLOR: Record<CrmProduto, string> = {
  v8: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  automation: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  copilot: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

export const CRM_PRODUTOS_VALIDOS: readonly CrmProduto[] = ['v8', 'automation', 'copilot'] as const;

// ================= HIERARQUIA DE PRODUTOS =================
// Copilot > Automation > V8. Produto mais alto subsume os inferiores
// (state-machines de Automation/Copilot já incluem os steps do V8).
// Quando cliente tem múltiplos produtos, cria config APENAS para o mais alto.

export const CRM_PRODUCT_HIERARCHY: Record<CrmProduto, number> = {
  v8: 1,
  automation: 2,
  copilot: 3,
};

/**
 * Retorna o produto mais alto na hierarquia dentre os informados.
 * Copilot > Automation > V8.
 *
 * @throws se o array estiver vazio
 */
export function getHighestProduct(products: CrmProduto[]): CrmProduto {
  if (products.length === 0) throw new Error('Nenhum produto informado');
  return products.reduce((highest, current) =>
    CRM_PRODUCT_HIERARCHY[current] > CRM_PRODUCT_HIERARCHY[highest] ? current : highest
  );
}

/**
 * Prazo máximo (em dias) para concluir TODA a configuração do produto,
 * contando a partir de `crm_configuracoes.created_at`. Todas as tarefas
 * geradas para uma mesma configuração compartilham esse prazo (é o prazo
 * global do produto, não por etapa).
 *
 * Ao passar do prazo, a tarefa atual aparece automaticamente na coluna
 * "Justificativa" (via DepartmentJustificativaSection) onde o gestor
 * registra o motivo do atraso.
 */
export const CRM_CONFIG_DEADLINE_DAYS: Record<CrmProduto, number> = {
  v8: 7,
  automation: 7,
  copilot: 10,
};

/** Calcula o due_date ISO (UTC) de uma configuração com base em createdAt + prazo do produto. */
export function getConfigDueDate(createdAtISO: string, produto: CrmProduto): string {
  const d = new Date(createdAtISO);
  d.setDate(d.getDate() + CRM_CONFIG_DEADLINE_DAYS[produto]);
  return d.toISOString();
}

// ================= STATE MACHINES POR PRODUTO =================

// Cada state-machine é uma lista ORDENADA de steps. Ao concluir a tarefa
// associada ao step atual, o cliente avança para o próximo step e uma nova
// tarefa é criada. Ao concluir o último step ('call_pos_venda'), a flag
// `is_finalizado` vira true e o card vai para "CRMs Finalizados".

export const V8_STEPS = [
  'receber_briefing',
  'estruturar_funil',
  'criar_campos',
  'cadastrar_usuarios',
  'importar_leads',
  'agendar_call_apresentacao',
  'conectar_meta_ads',
  'call_apresentacao_treinamento',
  'monitorar_adocao',
  'cobrar_feedback',
  'aplicar_ajustes',
  'call_pos_venda',
] as const;

export const AUTOMATION_STEPS = [
  'receber_briefing',
  'estruturar_funil',
  'mapear_fluxos_chatbot',
  'configurar_boas_vindas',
  'configurar_atendimento_humano',
  'testar_fluxos',
  'conectar_whatsapp',
  'conectar_meta_ads',
  'agendar_call_apresentacao',
  'apresentar_funil_crm',
  'demonstrar_chatbot',
  'monitorar_adocao',
  'cobrar_feedback',
  'aplicar_ajustes',
  'call_pos_venda',
] as const;

export const COPILOT_STEPS = [
  'receber_briefing',
  'treinar_ia',
  'agendar_call_apresentacao',
  'realizar_call_apresentacao',
  'validacao_cliente',
  'finalizar_configuracoes',
  'solicitar_testes',
  'cobrar_feedback',
  'aplicar_ajustes',
  'call_validacao_final',
  'ativar_sistema',
  'call_pos_venda',
] as const;

export type V8Step = typeof V8_STEPS[number];
export type AutomationStep = typeof AUTOMATION_STEPS[number];
export type CopilotStep = typeof COPILOT_STEPS[number];
export type CrmConfigStep = V8Step | AutomationStep | CopilotStep;

export const CRM_STEPS_BY_PRODUTO: Record<CrmProduto, readonly string[]> = {
  v8: V8_STEPS,
  automation: AUTOMATION_STEPS,
  copilot: COPILOT_STEPS,
};

// Label humano por step
export const CRM_STEP_LABEL: Record<string, string> = {
  // Compartilhados entre produtos
  receber_briefing: 'Receber briefing do treinador comercial',
  agendar_call_apresentacao: 'Agendar call de apresentação com cliente',
  cobrar_feedback: 'Cobrar feedback do cliente',
  aplicar_ajustes: 'Aplicar ajustes (prazo 2 dias)',
  call_pos_venda: 'Call de pós-venda',
  conectar_meta_ads: 'Conectar Meta Ads ao CRM',
  monitorar_adocao: 'Monitorar adoção nos primeiros dias',
  // V8 específicos
  estruturar_funil: 'Estruturar etapas do funil no CRM',
  criar_campos: 'Criar campos personalizados',
  cadastrar_usuarios: 'Cadastrar usuários da equipe',
  importar_leads: 'Importar base de leads',
  call_apresentacao_treinamento: 'Call de apresentação e treinamento',
  // Copilot específicos
  treinar_ia: 'Treinar a IA no CRM (Copilot)',
  realizar_call_apresentacao: 'Realizar call de apresentação',
  validacao_cliente: 'Validação do cliente',
  finalizar_configuracoes: 'Finalizar configurações pós-aprovação',
  solicitar_testes: 'Solicitar testes ao cliente',
  call_validacao_final: 'Call de validação final',
  ativar_sistema: 'Ativar sistema',
  // Automation específicos
  mapear_fluxos_chatbot: 'Mapear fluxos do chatbot',
  configurar_boas_vindas: 'Configurar mensagem de boas-vindas / Follow-up',
  configurar_atendimento_humano: 'Configurar direcionamento para atendimento humano',
  testar_fluxos: 'Testar todos os fluxos internamente',
  conectar_whatsapp: 'Conectar WhatsApp ao CRM',
  apresentar_funil_crm: 'Apresentar funil e estrutura do CRM',
  demonstrar_chatbot: 'Demonstrar fluxo completo do chatbot',
};

// Nome da tarefa gerada ao entrar em cada step (por produto).
// Prefixo [V8] / [Automation] / [Copilot] identifica inequivocamente o
// produto quando o mesmo cliente tem mais de uma configuração ativa.
export const CRM_TASK_TITLE: Record<CrmProduto, Record<string, (name: string) => string>> = {
  v8: {
    receber_briefing: (n) => `[V8] Receber Briefing ${n}`,
    estruturar_funil: (n) => `[V8] Estruturar Funil CRM ${n}`,
    criar_campos: (n) => `[V8] Criar Campos Personalizados ${n}`,
    cadastrar_usuarios: (n) => `[V8] Cadastrar Usuários ${n}`,
    importar_leads: (n) => `[V8] Importar Leads ${n}`,
    agendar_call_apresentacao: (n) => `[V8] Agendar Call Apresentação ${n}`,
    conectar_meta_ads: (n) => `[V8] Conectar Meta Ads ${n}`,
    call_apresentacao_treinamento: (n) => `[V8] Call Apresentação e Treinamento ${n}`,
    monitorar_adocao: (n) => `[V8] Monitorar Adoção ${n}`,
    cobrar_feedback: (n) => `[V8] Cobrar Feedback ${n}`,
    aplicar_ajustes: (n) => `[V8] Aplicar Ajustes ${n}`,
    call_pos_venda: (n) => `[V8] Call Pós-Venda ${n}`,
  },
  automation: {
    receber_briefing: (n) => `[Automation] Receber Briefing ${n}`,
    estruturar_funil: (n) => `[Automation] Estruturar Funil CRM ${n}`,
    mapear_fluxos_chatbot: (n) => `[Automation] Mapear Fluxos Chatbot ${n}`,
    configurar_boas_vindas: (n) => `[Automation] Configurar Boas-Vindas ${n}`,
    configurar_atendimento_humano: (n) => `[Automation] Configurar Atendimento Humano ${n}`,
    testar_fluxos: (n) => `[Automation] Testar Fluxos ${n}`,
    conectar_whatsapp: (n) => `[Automation] Conectar WhatsApp ${n}`,
    conectar_meta_ads: (n) => `[Automation] Conectar Meta Ads ${n}`,
    agendar_call_apresentacao: (n) => `[Automation] Agendar Call Apresentação ${n}`,
    apresentar_funil_crm: (n) => `[Automation] Apresentar Funil CRM ${n}`,
    demonstrar_chatbot: (n) => `[Automation] Demonstrar Chatbot ${n}`,
    monitorar_adocao: (n) => `[Automation] Monitorar Adoção ${n}`,
    cobrar_feedback: (n) => `[Automation] Cobrar Feedback ${n}`,
    aplicar_ajustes: (n) => `[Automation] Aplicar Ajustes ${n}`,
    call_pos_venda: (n) => `[Automation] Call Pós-Venda ${n}`,
  },
  copilot: {
    receber_briefing: (n) => `[Copilot] Receber Briefing ${n}`,
    treinar_ia: (n) => `[Copilot] Treinar IA ${n}`,
    agendar_call_apresentacao: (n) => `[Copilot] Agendar Call Apresentação ${n}`,
    realizar_call_apresentacao: (n) => `[Copilot] Realizar Call Apresentação ${n}`,
    validacao_cliente: (n) => `[Copilot] Validação do Cliente ${n}`,
    finalizar_configuracoes: (n) => `[Copilot] Finalizar Configurações ${n}`,
    solicitar_testes: (n) => `[Copilot] Solicitar Testes ${n}`,
    cobrar_feedback: (n) => `[Copilot] Cobrar Feedback ${n}`,
    aplicar_ajustes: (n) => `[Copilot] Aplicar Ajustes ${n}`,
    call_validacao_final: (n) => `[Copilot] Call Validação Final ${n}`,
    ativar_sistema: (n) => `[Copilot] Ativar Sistema ${n}`,
    call_pos_venda: (n) => `[Copilot] Call Pós-Venda ${n}`,
  },
};

// ================= FASES (AGRUPAMENTO VISUAL) =================

export interface CrmPhase {
  id: string;
  label: string;
  steps: string[];
}

export const CRM_PHASES_BY_PRODUTO: Record<CrmProduto, CrmPhase[]> = {
  copilot: [
    { id: 'preparacao', label: 'Fase 1 — Preparação interna', steps: ['receber_briefing', 'treinar_ia', 'agendar_call_apresentacao'] },
    { id: 'apresentacao', label: 'Fase 2 — Apresentação e aprovação', steps: ['realizar_call_apresentacao', 'validacao_cliente'] },
    { id: 'ajustes', label: 'Fase 3 — Ajustes finos', steps: ['finalizar_configuracoes', 'solicitar_testes', 'cobrar_feedback', 'aplicar_ajustes'] },
    { id: 'entrega', label: 'Fase 4 — Entrega e ativação', steps: ['call_validacao_final', 'ativar_sistema'] },
    { id: 'pos_venda', label: 'Fase 5 — Pós-venda', steps: ['call_pos_venda'] },
  ],
  v8: [
    { id: 'preparacao', label: 'Fase 1 — Preparação interna', steps: ['receber_briefing', 'estruturar_funil', 'criar_campos', 'cadastrar_usuarios', 'importar_leads', 'agendar_call_apresentacao'] },
    { id: 'meta', label: 'Fase 2 — Integração com Meta Ads', steps: ['conectar_meta_ads'] },
    { id: 'apresentacao', label: 'Fase 3 — Apresentação e treinamento', steps: ['call_apresentacao_treinamento'] },
    { id: 'acompanhamento', label: 'Fase 4 — Acompanhamento e adoção', steps: ['monitorar_adocao', 'cobrar_feedback', 'aplicar_ajustes', 'call_pos_venda'] },
  ],
  automation: [
    { id: 'preparacao', label: 'Fase 1 — Preparação interna', steps: ['receber_briefing', 'estruturar_funil', 'mapear_fluxos_chatbot'] },
    { id: 'chatbot', label: 'Fase 2 — Construção dos fluxos de chatbot', steps: ['configurar_boas_vindas', 'configurar_atendimento_humano', 'testar_fluxos'] },
    { id: 'integracoes', label: 'Fase 3 — Integrações', steps: ['conectar_whatsapp', 'conectar_meta_ads'] },
    { id: 'apresentacao', label: 'Fase 4 — Apresentação e treinamento', steps: ['agendar_call_apresentacao', 'apresentar_funil_crm', 'demonstrar_chatbot'] },
    { id: 'acompanhamento', label: 'Fase 5 — Acompanhamento e adoção', steps: ['monitorar_adocao', 'cobrar_feedback', 'aplicar_ajustes', 'call_pos_venda'] },
  ],
};

/** Retorna o próximo step da máquina do produto ou `null` se já é o último */
export function getNextStep(produto: CrmProduto, current: string): string | null {
  const steps = CRM_STEPS_BY_PRODUTO[produto];
  const idx = steps.indexOf(current);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1];
}

/** True se `current` é o último step da state-machine do produto ('call_pos_venda') */
export function isLastStep(produto: CrmProduto, current: string): boolean {
  const steps = CRM_STEPS_BY_PRODUTO[produto];
  return steps[steps.length - 1] === current;
}

// ================= DIAS DA SEMANA =================

const DAY_MAP: Record<number, string> = {
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
};

/**
 * Retorna o dia útil atual (segunda..sexta). Sábado e domingo
 * caem em 'sexta' para não deixar o cliente órfão.
 */
export function getCurrentWeekday(): string {
  const day = new Date().getDay(); // 0=dom, 1=seg, ..., 6=sab
  return DAY_MAP[day] || 'sexta';
}

export const CRM_DAYS = [
  { id: 'segunda', label: 'SEG' },
  { id: 'terca', label: 'TER' },
  { id: 'quarta', label: 'QUA' },
  { id: 'quinta', label: 'QUI' },
  { id: 'sexta', label: 'SEX' },
];

// ================= TASK TITLE: BOAS-VINDAS =================

export function welcomeTaskTitle(clientName: string): string {
  return `Dar boas-vindas ${clientName} e se apresentar`;
}

// ================= HOOKS DE LEITURA =================

/** Todos os clientes que estão no fluxo do Gestor de CRM (crm_status NOT NULL). */
export function useCrmKanbanClients() {
  const { user } = useAuth();
  // gestor_crm operacional padrão filtra. Mas user com page_grant 'gestor-crm'
  // (ex: cargo cross-funcional) ou admin enxergam tudo.
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');

  return useQuery({
    queryKey: ['crm-kanban-clients', user?.id, user?.role, scopeKey],
    queryFn: async () => {
      let query = (supabase as any)
        .from('clients')
        .select('id, name, razao_social, contracted_products, torque_crm_products, monthly_value, crm_status, crm_entered_at, assigned_crm, assigned_ads_manager, assigned_comercial, assigned_mktplace, client_label')
        .eq('archived', false)
        .not('assigned_crm', 'is', null)
        .not('crm_status', 'is', null)
        .order('crm_entered_at', { ascending: true });

      if (!seesAll && user?.role === 'gestor_crm') {
        query = query.eq('assigned_crm', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isReady && !!user?.id,
  });
}

/** Clientes novos (crm_status='novo') — alimenta a coluna "Novos clientes". */
export function useCrmNovosClientes() {
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');

  return useQuery({
    queryKey: ['crm-novos-clientes', user?.id, user?.role, scopeKey],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, name, razao_social, contracted_products, torque_crm_products, monthly_value, crm_status, crm_entered_at, assigned_crm, assigned_ads_manager, assigned_comercial, assigned_mktplace')
        .eq('crm_status' as any, 'novo')
        .eq('archived', false)
        .not('assigned_crm' as any, 'is', null)
        .order('crm_entered_at' as any, { ascending: true });

      if (!seesAll && user?.role === 'gestor_crm') {
        query = query.eq('assigned_crm' as any, user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isReady && !!user?.id,
  });
}

/** Clientes em estado "Boas-vindas" (tarefa criada, aguardando conclusão). */
export function useCrmBoasVindasClientes() {
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');

  return useQuery({
    queryKey: ['crm-boasvindas-clientes', user?.id, user?.role, scopeKey],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id, name, razao_social, contracted_products, torque_crm_products, monthly_value, crm_status, crm_entered_at, assigned_crm')
        .eq('crm_status' as any, 'boas_vindas')
        .eq('archived', false)
        .not('assigned_crm' as any, 'is', null)
        .order('crm_entered_at' as any, { ascending: true });

      if (!seesAll && user?.role === 'gestor_crm') {
        query = query.eq('assigned_crm' as any, user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isReady && !!user?.id,
  });
}

/** Tracking diário (acompanhamento seg-sex). */
export function useCrmTracking() {
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');

  return useQuery({
    queryKey: ['crm-tracking', user?.id, user?.role, scopeKey],
    queryFn: async () => {
      let query = (supabase as any)
        .from('crm_daily_tracking')
        .select('*, clients:client_id(id, name, razao_social, contracted_products, torque_crm_products, monthly_value, client_label)')
        .order('last_moved_at', { ascending: true });

      if (!seesAll && user?.role === 'gestor_crm') {
        query = query.eq('gestor_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isReady && !!user?.id,
  });
}

/**
 * Lookup rápido: IDs de clientes que TÊM documentação registrada HOJE
 * (data do servidor). Usado para marcar como "atrasado" qualquer cliente
 * em acompanhamento que ainda não foi tocado hoje.
 */
export function useCrmTodayDocumentedClients() {
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');

  return useQuery({
    queryKey: ['crm-today-documented', user?.id, user?.role, scopeKey],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      let query = (supabase as any)
        .from('crm_daily_documentation')
        .select('client_id')
        .eq('documentation_date', today);

      if (!seesAll && user?.role === 'gestor_crm') {
        query = query.eq('gestor_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      const ids = new Set<string>();
      (data || []).forEach((row: any) => {
        if (row.client_id) ids.add(row.client_id);
      });
      return ids;
    },
    enabled: isReady && !!user?.id,
    // Re-verifica a cada 60s caso o dia vire
    refetchInterval: 60_000,
  });
}

/** Documentação diária. */
export function useCrmDocumentation() {
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');

  return useQuery({
    queryKey: ['crm-documentation', user?.id, user?.role, scopeKey],
    queryFn: async () => {
      let query = (supabase as any)
        .from('crm_daily_documentation')
        .select('*, clients:client_id(id, name, razao_social)')
        .order('documentation_date', { ascending: false });

      if (!seesAll && user?.role === 'gestor_crm') {
        query = query.eq('gestor_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isReady && !!user?.id,
  });
}

/**
 * Configurações (linha por produto por cliente). Filtra por produto
 * e por flag de finalização quando informadas.
 */
export function useCrmConfiguracoes(opts: { produto?: CrmProduto; finalizado?: boolean } = {}) {
  const { user } = useAuth();
  const { produto, finalizado } = opts;
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');

  return useQuery({
    queryKey: ['crm-configuracoes', user?.id, user?.role, produto ?? 'all', finalizado ?? 'any', scopeKey],
    queryFn: async () => {
      let query = (supabase as any)
        .from('crm_configuracoes')
        .select('*, clients:client_id(id, name, razao_social, contracted_products, torque_crm_products, monthly_value, client_label)')
        .order('created_at', { ascending: true });

      if (produto) query = query.eq('produto', produto);
      if (typeof finalizado === 'boolean') query = query.eq('is_finalizado', finalizado);

      if (!seesAll && user?.role === 'gestor_crm') {
        query = query.eq('gestor_id', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isReady && !!user?.id,
  });
}

/** Perfis (para exibir nome do responsável). */
export function useCrmProfiles() {
  return useQuery({
    queryKey: ['crm-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name');
      if (error) throw error;
      return data || [];
    },
  });
}

// ================= HELPERS DE ETIQUETAS =================

/** Retorna os produtos Torque CRM (v8/automation/copilot) normalizados. */
export function getTorqueCrmProducts(client: { torque_crm_products?: string[] | null }): CrmProduto[] {
  const raw = (client.torque_crm_products as string[] | null) || [];
  return raw.filter((p): p is CrmProduto => CRM_PRODUTOS_VALIDOS.includes(p as CrmProduto));
}

/** True se o cliente está no fluxo do CRM (tem assigned_crm e crm_status). */
export function isInCrmFlow(client: { assigned_crm?: string | null; crm_status?: string | null }): boolean {
  return !!client.assigned_crm && !!client.crm_status;
}

// ================= MUTATIONS — BOAS-VINDAS & ACOMPANHAMENTO =================

/**
 * Cria a tarefa de boas-vindas e move o cliente para `crm_status='boas_vindas'`.
 * Idempotente: não cria duplicada se já existe tarefa de boas-vindas para o cliente.
 */
export function useCreateCrmWelcomeTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ clientId, clientName, gestorId }: {
      clientId: string;
      clientName: string;
      gestorId: string;
    }) => {
      if (!gestorId) throw new Error('Gestor de CRM não atribuído');
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Deduplicação: procura tarefa de boas-vindas existente para o cliente
      const title = welcomeTaskTitle(clientName);
      const { data: existing } = await supabase
        .from('department_tasks')
        .select('id')
        .eq('related_client_id', clientId)
        .eq('department', 'gestor_crm')
        .eq('archived', false)
        .eq('title', title)
        .limit(1);

      if (existing && existing.length > 0) {
        // Só garante que o cliente esteja em 'boas_vindas'
        await (supabase as any)
          .from('clients')
          .update({ crm_status: 'boas_vindas' })
          .eq('id', clientId)
          .eq('crm_status', 'novo');
        return;
      }

      // Cria tarefa com user_id = assigned_crm do cliente (fallback ao logado).
      // RLS de department_tasks libera via page_grant gestor-crm; o user_id
      // controla VISIBILIDADE do dono certo (fix do bug de tasks invisíveis
      // pro gestor real quando criadas em massa pelo CEO).
      const ownerId = await resolveTaskOwner(clientId, 'assigned_crm', user.id);
      const { error: taskError } = await supabase.from('department_tasks').insert({
        user_id: ownerId,
        title,
        task_type: 'daily',
        status: 'todo',
        priority: 'high',
        department: 'gestor_crm',
        related_client_id: clientId,
      } as any);
      if (taskError) throw taskError;

      // Move cliente para 'boas_vindas'
      const { error: updErr } = await supabase
        .from('clients')
        .update({ crm_status: 'boas_vindas' } as any)
        .eq('id', clientId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-novos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['crm-boasvindas-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['crm-kanban-clients'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao criar tarefa de boas-vindas', { description: err.message });
    },
  });
}

/**
 * Ao concluir a tarefa de boas-vindas, move o cliente para `acompanhamento`
 * e cria a entrada em `crm_daily_tracking` no dia útil real da conclusão.
 */
export function useConcluirCrmBoasVindas() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      // Pega gestor responsável
      const { data: clientRow, error: fetchErr } = await supabase
        .from('clients')
        .select('id, assigned_crm' as any)
        .eq('id', clientId)
        .single();
      if (fetchErr) throw fetchErr;
      const gestorId = (clientRow as any)?.assigned_crm || user?.id;

      const weekday = getCurrentWeekday();

      // Atualiza status
      const { error: updErr } = await supabase
        .from('clients')
        .update({ crm_status: 'acompanhamento' } as any)
        .eq('id', clientId);
      if (updErr) throw updErr;

      // Cria/atualiza entrada em crm_daily_tracking
      await (supabase as any).from('crm_daily_tracking').upsert({
        client_id: clientId,
        gestor_id: gestorId,
        current_day: weekday,
        last_moved_at: new Date().toISOString(),
        is_delayed: false,
      }, { onConflict: 'client_id' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-boasvindas-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['crm-kanban-clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-tracking'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao concluir boas-vindas', { description: err.message });
    },
  });
}

/** Move cliente entre dias da semana no acompanhamento. */
export function useMoveClientCrm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, newDay }: { clientId: string; newDay: string }) => {
      const { error } = await (supabase as any)
        .from('crm_daily_tracking')
        .update({
          current_day: newDay,
          last_moved_at: new Date().toISOString(),
          is_delayed: false,
        })
        .eq('client_id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tracking'] });
    },
  });
}

// ================= MUTATIONS — CONFIGURAÇÕES & AUTO-TAREFA =================

/**
 * Cria uma linha em `crm_configuracoes` para cada produto informado (V8/Automation/Copilot).
 * Cada linha recebe o step inicial `receber_briefing` e UMA tarefa automática com o
 * título do step inicial do próprio produto. Idempotente por UNIQUE(client_id, produto):
 * se já existe configuração para esse (cliente, produto), mantém a existente e NÃO
 * duplica tarefa.
 */
export function useCreateCrmConfiguracoes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      clientId,
      clientName,
      gestorId,
      produtos,
      formDataByProduto,
    }: {
      clientId: string;
      clientName: string;
      gestorId: string;
      produtos: CrmProduto[];
      /** Dados do formulário específicos por produto (JSON livre) */
      formDataByProduto: Partial<Record<CrmProduto, Record<string, unknown>>>;
    }) => {
      if (!gestorId) throw new Error('Gestor de CRM não atribuído');
      if (!produtos.length) throw new Error('Selecione ao menos um produto');
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Safety net: hierarquia Copilot > Automation > V8.
      // Mesmo que o frontend envie múltiplos, cria config apenas para o mais alto.
      const highest = getHighestProduct(produtos);
      const filteredProdutos: CrmProduto[] = [highest];

      const created: { produto: CrmProduto; configExisted: boolean; taskCreated: boolean; error?: string }[] = [];

      for (const produto of filteredProdutos) {
        try {
          // 1. Config já existe? (UNIQUE client_id+produto garante no máx 1)
          const { data: existingCfg } = await (supabase as any)
            .from('crm_configuracoes')
            .select('id, current_step, created_at')
            .eq('client_id', clientId)
            .eq('produto', produto)
            .limit(1);

          let configId: string;
          let currentStep: string;
          let configCreatedAt: string;
          let configExisted = false;

          if (existingCfg && existingCfg.length > 0) {
            // Já existe — reusa
            configId = existingCfg[0].id;
            currentStep = existingCfg[0].current_step;
            configCreatedAt = existingCfg[0].created_at;
            configExisted = true;
          } else {
            // Cria nova
            const initialStep = CRM_STEPS_BY_PRODUTO[produto][0];
            const formData = formDataByProduto[produto] || {};

            const { data: inserted, error: insertErr } = await (supabase as any)
              .from('crm_configuracoes')
              .insert({
                client_id: clientId,
                gestor_id: gestorId,
                produto,
                current_step: initialStep,
                is_finalizado: false,
                form_data: formData,
                created_by: user.id,
              })
              .select('id, created_at')
              .single();
            if (insertErr) throw insertErr;

            configId = inserted.id;
            currentStep = initialStep;
            configCreatedAt = inserted.created_at;
          }

          // 2. Garante que exista UMA tarefa ativa para o step atual desta
          // configuração. Independente do config já existir ou não: se não
          // houver tarefa ativa (todo/doing), cria. Isso impede o cenário
          // "3 cards mas só 1 tarefa" quando o usuário reabre o form.
          const expectedTitle = CRM_TASK_TITLE[produto]?.[currentStep]?.(clientName);
          if (expectedTitle) {
            const { data: existingTask } = await (supabase as any)
              .from('department_tasks')
              .select('id')
              .eq('related_client_id', clientId)
              .eq('department', 'gestor_crm')
              .eq('description', `crm-config:${produto}`)
              .in('status', ['todo', 'doing'])
              .eq('archived', false)
              .limit(1);

            let taskCreated = false;
            if (!existingTask || existingTask.length === 0) {
              const dueDate = getConfigDueDate(configCreatedAt, produto);
              const ownerId = await resolveTaskOwner(clientId, 'assigned_crm', user.id);
              const { error: taskErr } = await supabase.from('department_tasks').insert({
                user_id: ownerId,
                title: expectedTitle,
                description: `crm-config:${produto}`,
                task_type: 'daily',
                status: 'todo',
                priority: 'high',
                department: 'gestor_crm',
                related_client_id: clientId,
                due_date: dueDate,
              } as any);
              if (taskErr) throw taskErr;
              taskCreated = true;
            }

            created.push({ produto, configExisted, taskCreated });
          } else {
            created.push({ produto, configExisted, taskCreated: false });
          }
        } catch (err: unknown) {
          // Isola erro por produto — continua com os próximos em vez de
          // abortar o loop inteiro e deixar configs órfãs sem task.
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[CRM] Erro ao processar produto ${produto}:`, msg);
          created.push({ produto, configExisted: false, taskCreated: false, error: msg });
        }
      }

      // Se TODOS falharam, propaga pra onError do mutation
      const allFailed = created.length > 0 && created.every(r => !!r.error);
      if (allFailed) {
        throw new Error(created.map(r => `[${CRM_PRODUTO_LABEL[r.produto]}] ${r.error}`).join('; '));
      }

      return created;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });

      const errors = result.filter(r => !!r.error);
      const novos = result.filter(r => !r.error && (!r.configExisted || r.taskCreated)).length;

      if (errors.length > 0) {
        // Sucesso parcial — mostra quais falharam
        const failedNames = errors.map(r => CRM_PRODUTO_LABEL[r.produto]).join(', ');
        toast.warning(`${novos} configuração(ões) criada(s), mas falhou para: ${failedNames}`, {
          description: errors[0].error,
        });
      } else if (novos > 0) {
        toast.success(`${novos} configuração(ões) de CRM criada(s)`);
      } else {
        toast.info('Configurações já existiam — nada foi duplicado');
      }
    },
    onError: (err: Error) => {
      toast.error('Erro ao gerar configurações', { description: err.message });
    },
  });
}

/**
 * Avança uma configuração para o próximo step e cria a tarefa seguinte.
 * Se o step atual era o último (`call_pos_venda`), marca `is_finalizado=true` e NÃO cria tarefa nova —
 * o card passa a aparecer na coluna "CRMs Finalizados".
 */
export function useAdvanceCrmConfiguracao() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      configId,
      clientId,
      clientName,
      produto,
      currentStep,
    }: {
      configId: string;
      clientId: string;
      clientName: string;
      produto: CrmProduto;
      currentStep: string;
      /** @deprecated mantido por compatibilidade — não é usado; a tarefa é criada para user.id */
      gestorId?: string;
    }) => {
      const next = getNextStep(produto, currentStep);

      if (next === null) {
        // Último step concluído → finaliza configuração
        const { error } = await (supabase as any)
          .from('crm_configuracoes')
          .update({
            is_finalizado: true,
            finalizado_at: new Date().toISOString(),
          })
          .eq('id', configId);
        if (error) throw error;
        return { finalized: true as const };
      }

      // Avança step
      const { error: updErr } = await (supabase as any)
        .from('crm_configuracoes')
        .update({ current_step: next })
        .eq('id', configId);
      if (updErr) throw updErr;

      // Cria nova tarefa com user_id = assigned_crm do cliente (fallback ao logado).
      // Garante que o gestor real veja a task mesmo se o avanço foi feito pelo CEO.
      const titleFn = CRM_TASK_TITLE[produto][next];
      if (titleFn && user?.id) {
        const ownerId = await resolveTaskOwner(clientId, 'assigned_crm', user.id);
        const { error: taskErr } = await supabase.from('department_tasks').insert({
          user_id: ownerId,
          title: titleFn(clientName),
          description: `crm-config:${produto}`,
          task_type: 'daily',
          status: 'todo',
          priority: 'high',
          department: 'gestor_crm',
          related_client_id: clientId,
        } as any);
        if (taskErr) throw taskErr;
      }

      return { finalized: false as const, nextStep: next };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao avançar configuração', { description: err.message });
    },
  });
}

/**
 * Salva documentação diária do CRM. Se `combinado=sim` com prazo,
 * cria também uma tarefa com due_date.
 */
export function useSaveCrmDoc() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (doc: {
      clientId: string;
      falou_com_cliente?: string;
      falou_justificativa?: string;
      fez_algo_novo: string;
      fez_algo_justificativa?: string;
      fez_algo_descricao?: string;
      combinado: string;
      combinado_descricao?: string;
      combinado_prazo?: string;
      combinado_justificativa?: string;
    }) => {
      const today = format(new Date(), 'yyyy-MM-dd');

      await (supabase as any).from('crm_daily_documentation').upsert({
        client_id: doc.clientId,
        gestor_id: user?.id,
        documentation_date: today,
        falou_com_cliente: doc.falou_com_cliente || null,
        falou_justificativa: doc.falou_justificativa || null,
        fez_algo_novo: doc.fez_algo_novo,
        fez_algo_justificativa: doc.fez_algo_justificativa || null,
        fez_algo_descricao: doc.fez_algo_descricao || null,
        combinado: doc.combinado,
        combinado_descricao: doc.combinado_descricao || null,
        combinado_prazo: doc.combinado_prazo || null,
        combinado_justificativa: doc.combinado_justificativa || null,
      }, { onConflict: 'client_id,documentation_date' });

      if (doc.combinado === 'sim' && doc.combinado_descricao && doc.combinado_prazo && user?.id) {
        const ownerId = await resolveTaskOwner(doc.clientId, 'assigned_crm', user.id);
        await supabase.from('department_tasks').insert({
          user_id: ownerId,
          title: doc.combinado_descricao,
          task_type: 'daily',
          status: 'todo',
          priority: 'high',
          department: 'gestor_crm',
          related_client_id: doc.clientId,
          due_date: doc.combinado_prazo,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-documentation'] });
      queryClient.invalidateQueries({ queryKey: ['crm-today-documented'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Documentação salva!');
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar documentação', { description: err.message });
    },
  });
}
