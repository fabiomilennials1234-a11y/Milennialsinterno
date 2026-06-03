import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDataScope } from '@/hooks/useDataScope';
import { toast } from 'sonner';
import { gerarCardBoard, comecarCardBoard, setChecklistBoard, agendarApresentacao, marcarProntoCard } from '@/lib/torqueCrm/boardRpc';
import type { ChecklistItem } from '@/lib/torqueCrm/checklist';

// =============================================================
// Gestor de CRM — Hook central (board Torque CRM, ADR 0006)
//
// Pós-Slice 7 (#97): a state-machine rígida por produto (gate de avanço,
// SLA por produto, fases como mecanismo de fluxo, colunas-seção operacionais)
// foi APOSENTADA. Sobrou aqui o que o board novo (Kanban 6-col +
// Acompanhamentos) e o mapa de jornada do cliente realmente consomem:
//   - taxonomia de produto/tier (label, cor, hierarquia, getHighestProduct);
//   - os rótulos dos steps (CRM_STEPS_BY_PRODUTO + CRM_STEP_LABEL) que servem
//     de SEED do checklist achatado e do mapa de jornada;
//   - as fases (CRM_PHASES_BY_PRODUTO) consumidas só pelo useClientJourneyMap;
//   - leitura de crm_configuracoes e as mutations do board (RPC-only).
//
// O fluxo do board vive em crm_configuracoes (1 linha por cliente+produto,
// roteada pelo tier mais alto). As tabelas das colunas removidas
// (crm_daily_tracking, crm_daily_documentation) ficam DORMENTES — sem UI,
// reversível (ADR 0006 §4 / consequências aceitas).
// =============================================================

// ================= PRODUTOS E ROTULAGEM =================

// 'torque' é o tier-base, ex-'v8' (ADR 0006; consistente com a tag
// 'esperar_torque'). "V8" aposentado como termo de produto.
export type CrmProduto = 'torque' | 'automation' | 'copilot';

export const CRM_PRODUTO_LABEL: Record<CrmProduto, string> = {
  torque: 'Torque',
  automation: 'Automation',
  copilot: 'Copilot',
};

// Chip de produto: NEUTRO. O produto é identificado pelo label (Torque/
// Automation/Copilot), não por cor. Restraint: a cor fica reservada para
// informação (estados success/warning/danger).
export const CRM_PRODUTO_COLOR: Record<CrmProduto, string> = {
  torque: 'bg-muted text-muted-foreground border-border',
  automation: 'bg-muted text-muted-foreground border-border',
  copilot: 'bg-muted text-muted-foreground border-border',
};

export const CRM_PRODUTOS_VALIDOS: readonly CrmProduto[] = ['torque', 'automation', 'copilot'] as const;

// ================= HIERARQUIA DE PRODUTOS =================
// Copilot > Automation > Torque. Produto mais alto subsume os inferiores
// (os steps de Automation/Copilot já incluem os steps do Torque).
// Quando cliente tem múltiplos produtos, cria card APENAS para o mais alto.

export const CRM_PRODUCT_HIERARCHY: Record<CrmProduto, number> = {
  torque: 1,
  automation: 2,
  copilot: 3,
};

/**
 * Retorna o produto mais alto na hierarquia dentre os informados.
 * Copilot > Automation > Torque.
 *
 * @throws se o array estiver vazio
 */
export function getHighestProduct(products: CrmProduto[]): CrmProduto {
  if (products.length === 0) throw new Error('Nenhum produto informado');
  return products.reduce((highest, current) =>
    CRM_PRODUCT_HIERARCHY[current] > CRM_PRODUCT_HIERARCHY[highest] ? current : highest
  );
}

// ================= STEPS POR PRODUTO (SEED DO CHECKLIST) =================

// Os steps NÃO são mais uma state-machine com gate de avanço. Servem de SEED
// inicial do checklist achatado de cada card (ADR 0006 §1) e de fonte para o
// mapa de jornada do cliente. O gestor pode adicionar/remover/renomear itens
// por card; não há ordem obrigatória.

export const TORQUE_STEPS = [
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
  'call_apresentacao_treinamento',
  'cadastrar_usuarios',
  'importar_leads',
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

export type TorqueStep = typeof TORQUE_STEPS[number];
export type AutomationStep = typeof AUTOMATION_STEPS[number];
export type CopilotStep = typeof COPILOT_STEPS[number];
export type CrmConfigStep = TorqueStep | AutomationStep | CopilotStep;

export const CRM_STEPS_BY_PRODUTO: Record<CrmProduto, readonly string[]> = {
  torque: TORQUE_STEPS,
  automation: AUTOMATION_STEPS,
  copilot: COPILOT_STEPS,
};

// Label humano por step (seed do checklist + mapa de jornada).
export const CRM_STEP_LABEL: Record<string, string> = {
  // Compartilhados entre produtos
  receber_briefing: 'Receber briefing do treinador comercial',
  agendar_call_apresentacao: 'Agendar call de apresentação com cliente',
  cobrar_feedback: 'Cobrar feedback do cliente',
  aplicar_ajustes: 'Aplicar ajustes (prazo 2 dias)',
  call_pos_venda: 'Call de pós-venda',
  conectar_meta_ads: 'Conectar Meta Ads ao CRM',
  monitorar_adocao: 'Monitorar adoção nos primeiros dias',
  // Torque específicos
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
};

// ================= FASES (AGRUPAMENTO VISUAL — MAPA DE JORNADA) =================
// Não são mais gate de fluxo: servem só de agrupamento visual no
// useClientJourneyMap (ClientViewModal). O board novo não usa fases.

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
  torque: [
    { id: 'preparacao', label: 'Fase 1 — Preparação interna', steps: ['receber_briefing', 'estruturar_funil', 'criar_campos', 'cadastrar_usuarios', 'importar_leads', 'agendar_call_apresentacao'] },
    { id: 'meta', label: 'Fase 2 — Integração com Meta Ads', steps: ['conectar_meta_ads'] },
    { id: 'apresentacao', label: 'Fase 3 — Apresentação e treinamento', steps: ['call_apresentacao_treinamento'] },
    { id: 'acompanhamento', label: 'Fase 4 — Acompanhamento e adoção', steps: ['monitorar_adocao', 'cobrar_feedback', 'aplicar_ajustes', 'call_pos_venda'] },
  ],
  automation: [
    { id: 'preparacao', label: 'Fase 1 — Preparação interna', steps: ['receber_briefing', 'estruturar_funil', 'mapear_fluxos_chatbot'] },
    { id: 'chatbot', label: 'Fase 2 — Construção dos fluxos de chatbot', steps: ['configurar_boas_vindas', 'configurar_atendimento_humano', 'testar_fluxos'] },
    { id: 'integracoes', label: 'Fase 3 — Integrações', steps: ['conectar_whatsapp', 'conectar_meta_ads'] },
    { id: 'apresentacao', label: 'Fase 4 — Apresentação e treinamento', steps: ['agendar_call_apresentacao', 'call_apresentacao_treinamento'] },
    { id: 'onboarding_cliente', label: 'Fase 5 — Onboarding do cliente', steps: ['cadastrar_usuarios', 'importar_leads'] },
    { id: 'acompanhamento', label: 'Fase 6 — Acompanhamento e adoção', steps: ['monitorar_adocao', 'cobrar_feedback', 'aplicar_ajustes', 'call_pos_venda'] },
  ],
};

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
 * Consumido por useDepartmentTasks.
 */
export function getCurrentWeekday(): string {
  const day = new Date().getDay(); // 0=dom, 1=seg, ..., 6=sab
  return DAY_MAP[day] || 'sexta';
}

// ================= TASK TITLE: BOAS-VINDAS =================

/** Título da tarefa de boas-vindas. Consumido por useDepartmentTasks. */
export function welcomeTaskTitle(clientName: string): string {
  return `Dar boas-vindas ${clientName} e se apresentar`;
}

// ================= HOOKS DE LEITURA =================

/**
 * Configurações = cards do board (linha por cliente+produto). Filtra por
 * produto e por flag de finalização quando informadas.
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

// ================= HELPERS DE ETIQUETAS =================

/** Retorna os produtos Torque CRM (torque/automation/copilot) normalizados. */
export function getTorqueCrmProducts(client: { torque_crm_products?: string[] | null }): CrmProduto[] {
  const raw = (client.torque_crm_products as string[] | null) || [];
  return raw.filter((p): p is CrmProduto => CRM_PRODUTOS_VALIDOS.includes(p as CrmProduto));
}

// ================= MUTATIONS — CARDS DO BOARD (RPC-only) =================

/**
 * Cria o card de implantação (linha em `crm_configuracoes`) para o produto
 * mais alto do cliente. Card nasce em A FAZER (board_status='a_fazer').
 * Escrita SÓ via RPC torque_board_gerar (ADR §92.3) — idempotente por
 * UNIQUE(client_id, produto): se já existe, devolve o id sem reverter progresso.
 */
export function useCreateCrmConfiguracoes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      clientId,
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

      // Safety net: hierarquia Copilot > Automation > Torque.
      // Mesmo que o frontend envie múltiplos, cria card apenas para o mais alto.
      const highest = getHighestProduct(produtos);
      const filteredProdutos: CrmProduto[] = [highest];

      const created: { produto: CrmProduto; configExisted: boolean; taskCreated: boolean; error?: string }[] = [];

      for (const produto of filteredProdutos) {
        try {
          // Card já existe? (UNIQUE client_id+produto garante no máx 1)
          const { data: existingCfg } = await (supabase as any)
            .from('crm_configuracoes')
            .select('id, current_step, created_at')
            .eq('client_id', clientId)
            .eq('produto', produto)
            .limit(1);

          const configExisted = !!(existingCfg && existingCfg.length > 0);

          await gerarCardBoard({
            clientId,
            gestorId,
            produto,
            formData: formDataByProduto[produto] || {},
          });

          created.push({ produto, configExisted, taskCreated: false });
        } catch (err: unknown) {
          // Isola erro por produto — continua com os próximos em vez de
          // abortar o loop inteiro e deixar cards órfãos.
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
        toast.warning(`${novos} card(s) criado(s), mas falhou para: ${failedNames}`, {
          description: errors[0].error,
        });
      } else if (novos > 0) {
        toast.success(`${novos} card(s) de CRM criado(s)`);
      } else {
        toast.info('Cards já existiam — nada foi duplicado');
      }
    },
    onError: (err: Error) => {
      toast.error('Erro ao gerar cards', { description: err.message });
    },
  });
}

/**
 * Slice 2 (#92) — "Começar": promove o card de A FAZER pra coluna do seu tier
 * (board_status 'a_fazer' -> 'tier'). Escrita SÓ via RPC torque_board_comecar
 * (ADR §92.3); a regra de transição vive no reducer puro boardImplantacao.comecar.
 */
export function useComecarCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ configId }: { configId: string }) => {
      await comecarCardBoard(configId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao iniciar o card', { description: err.message });
    },
  });
}

/**
 * Slice 3 (#93) — Persiste o checklist INTEIRO de um card e deixa o servidor
 * decidir o auto-move (tier->apresentacao no 100%). Escrita SÓ via RPC
 * torque_board_checklist_set (ADR §92.3). O cliente computa o próximo array com
 * o módulo puro checklist.ts (toggle/add/remove/rename) e manda o resultado.
 */
export function useSetChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ configId, checklist }: { configId: string; checklist: ChecklistItem[] }) => {
      return await setChecklistBoard(configId, checklist);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar o checklist', { description: err.message });
    },
  });
}

/**
 * Slice 4 (#94) — Agenda/reagenda a apresentação de um card (grava
 * apresentacao_at). Escrita SÓ via RPC torque_board_agendar (ADR §92.3). Primeiro
 * agendamento e reagendamento são a mesma operação — o card permanece em
 * 'apresentacao'; a regra de estado vive no reducer puro boardImplantacao.reagendar.
 */
export function useAgendarApresentacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ configId, apresentacaoAt }: { configId: string; apresentacaoAt: string }) => {
      await agendarApresentacao(configId, apresentacaoAt);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao agendar a apresentação', { description: err.message });
    },
  });
}

/**
 * Slice 4 (#94) — "Pronto": conclui a apresentação (apresentacao -> pronto,
 * arquiva em PRONTOS). Escrita SÓ via RPC torque_board_pronto (ADR §92.3), que
 * RE-VALIDA o gate de data no servidor (≥00h do dia agendado, fuso SP). O botão
 * na UI já é gated por dateGate.podeConcluir; a RPC é a fonte da verdade.
 */
export function useMarcarPronto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ configId }: { configId: string }) => {
      await marcarProntoCard(configId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-configuracoes'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao concluir a apresentação', { description: err.message });
    },
  });
}
