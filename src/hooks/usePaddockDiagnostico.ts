import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Tipos ──────────────────────────────────────────────────────────
export type Resposta3 = 'sim' | 'parcialmente' | 'nao' | null;
export type Resposta2 = 'sim' | 'nao' | null;

export interface PaddockDiagnosticoFormData {
  // Bloco 0 – Meta / Identificação
  cliente_nome: string;
  responsavel_diagnostico: string;
  data_consultoria: string;

  // Bloco 1 – Execução Real
  exec_batendo_50: Resposta3;
  exec_consistencia_diaria: Resposta3;
  exec_comeca_pelo_crm: Resposta3;
  exec_blocos_ligacao: Resposta3;
  exec_volume_caiu: Resposta3;           // invertida
  exec_alguem_nao_performa: Resposta3;   // invertida
  exec_followup_diario: Resposta3;
  exec_leads_sem_atividade: Resposta3;   // invertida

  // Bloco 2 – Uso do CRM
  crm_movimentacao_correta: Resposta3;
  crm_leads_parados: Resposta3;          // invertida
  crm_registra_interacoes: Resposta3;
  crm_historico_completo: Resposta3;
  crm_whatsapp_fora: Resposta3;          // invertida
  crm_erros_status: Resposta3;           // invertida
  crm_funil_realidade: Resposta3;
  crm_gestor_confia: Resposta3;
  crm_principal_erro: string;

  // Bloco 3 – Abordagem Inicial
  abord_liga_imediatamente: Resposta3;
  abord_tempo_resposta_5min: Resposta3;
  abord_comeca_whatsapp: Resposta3;      // invertida
  abord_ligacoes_frequentes: Resposta3;
  abord_seguranca_falar: Resposta3;
  abord_abertura_estruturada: Resposta3;
  abord_faz_perguntas: Resposta3;
  abord_fala_mais_que_escuta: Resposta3; // invertida
  abord_erro_ligacoes: string;

  // Bloco 4 – Qualificação
  qual_perguntas_cenario: Resposta3;
  qual_dor_real: Resposta3;
  qual_fala_decisor: Resposta3;
  qual_descobre_orcamento: Resposta3;
  qual_entende_prazo: Resposta3;
  qual_qualifica_ou_empurra: Resposta3;  // invertida
  qual_perde_tempo_ruins: Resposta3;     // invertida
  qual_diferencia_status: Resposta3;
  qual_erro_qualificacao: string;

  // Bloco 5 – Follow-up
  follow_5_tentativas: Resposta3;
  follow_multicanal: Resposta3;
  follow_personalizado: Resposta3;
  follow_desiste_rapido: Resposta3;      // invertida
  follow_padrao_dias: Resposta3;
  follow_revisita_antigos: Resposta3;
  follow_registra_crm: Resposta3;
  follow_disciplina: Resposta3;
  follow_erro_followup: string;

  // Bloco 6 – Conversão
  conv_agenda_reunioes: Resposta3;
  conv_reunioes_qualificadas: Resposta3;
  conv_leads_somem: Resposta3;           // invertida
  conv_objecao_recorrente: Resposta3;    // invertida
  conv_conduz_conversa: Resposta3;
  conv_valor_ou_preco: Resposta3;
  conv_quebra_expectativa: Resposta3;    // invertida
  conv_inicio_ou_fechamento: Resposta3;
  conv_erro_conversao: string;

  // Bloco 7 – Disciplina e Rotina (nenhuma invertida)
  disc_rotina_clara: Resposta3;
  disc_metas_individuais: Resposta3;
  disc_mede_desempenho: Resposta3;
  disc_cobranca_gestor: Resposta3;
  disc_executa_sem_motivacao: Resposta3;
  disc_consistencia: Resposta3;
  disc_sabe_o_que_fazer: Resposta3;
  disc_organizacao: Resposta3;
  disc_falta_rotina: string;

  // Bloco 8 – Erros Críticos (qualitativo, TODAS invertidas)
  erro_liga_pouco: Resposta3;
  erro_comeca_whatsapp: Resposta3;
  erro_nao_registra: Resposta3;
  erro_fala_mais: Resposta3;
  erro_nao_investiga: Resposta3;
  erro_aceita_nao: Resposta3;
  erro_nao_agenda: Resposta3;
  erro_nao_segue: Resposta3;
  erro_mais_prejudica: string;

  // Bloco 9 – Evolução Real (qualitativo)
  evol_melhorou: Resposta3;
  evol_gestor_percebe: Resposta3;
  evol_aplicou: Resposta3;
  evol_aumento_reunioes: Resposta3;
  evol_qualidade_leads: Resposta3;
  evol_mais_organizado: Resposta3;
  evol_crm_limpo: Resposta3;
  evol_processo_claro: Resposta3;
  evol_o_que_melhorou: string;
  evol_o_que_nao_melhorou: string;
  evol_top3_gargalos: string;
  evol_top3_acoes: string;

  // Observações finais
  observacoes_finais: string;
}

export interface PaddockDiagnosticoRecord extends PaddockDiagnosticoFormData {
  id: string;
  client_id: string;
  consultor_id: string;
  public_token: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// Columns that actually exist in the paddock_diagnosticos table (whitelist)
const DB_COLUMNS = new Set([
  'exec_batendo_50','exec_consistencia_diaria','exec_comeca_pelo_crm','exec_blocos_ligacao',
  'exec_volume_caiu','exec_alguem_nao_performa','exec_followup_diario','exec_leads_sem_atividade',
  'crm_movimentacao_correta','crm_leads_parados','crm_registra_interacoes','crm_historico_completo',
  'crm_whatsapp_fora','crm_erros_status','crm_funil_realidade','crm_gestor_confia','crm_principal_erro',
  'abord_liga_imediatamente','abord_tempo_resposta_5min','abord_comeca_whatsapp','abord_ligacoes_frequentes',
  'abord_seguranca_falar','abord_abertura_estruturada','abord_faz_perguntas','abord_fala_mais_que_escuta','abord_erro_ligacoes',
  'qual_perguntas_cenario','qual_dor_real','qual_fala_decisor','qual_descobre_orcamento','qual_entende_prazo',
  'qual_qualifica_ou_empurra','qual_perde_tempo_ruins','qual_diferencia_status','qual_erro_qualificacao',
  'follow_5_tentativas','follow_multicanal','follow_personalizado','follow_desiste_rapido',
  'follow_padrao_dias','follow_revisita_antigos','follow_registra_crm','follow_disciplina','follow_erro_followup',
  'conv_agenda_reunioes','conv_reunioes_qualificadas','conv_leads_somem','conv_objecao_recorrente',
  'conv_conduz_conversa','conv_valor_ou_preco','conv_quebra_expectativa','conv_inicio_ou_fechamento','conv_erro_conversao',
  'disc_rotina_clara','disc_metas_individuais','disc_mede_desempenho','disc_cobranca_gestor',
  'disc_executa_sem_motivacao','disc_consistencia','disc_sabe_o_que_fazer','disc_organizacao','disc_falta_rotina',
  'erro_liga_pouco','erro_comeca_whatsapp','erro_nao_registra','erro_fala_mais',
  'erro_nao_investiga','erro_aceita_nao','erro_nao_agenda','erro_nao_segue','erro_mais_prejudica',
  'evol_melhorou','evol_gestor_percebe','evol_aplicou','evol_aumento_reunioes','evol_qualidade_leads',
  'evol_mais_organizado','evol_crm_limpo','evol_processo_claro',
  'evol_o_que_melhorou','evol_o_que_nao_melhorou','evol_top3_gargalos','evol_top3_acoes',
]);

function stripToDbFields(formData: any): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(formData)) {
    if (DB_COLUMNS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

export const EMPTY_PADDOCK_FORM: PaddockDiagnosticoFormData = {
  cliente_nome: '', responsavel_diagnostico: '', data_consultoria: '',

  exec_batendo_50: null, exec_consistencia_diaria: null, exec_comeca_pelo_crm: null,
  exec_blocos_ligacao: null, exec_volume_caiu: null, exec_alguem_nao_performa: null,
  exec_followup_diario: null, exec_leads_sem_atividade: null,

  crm_movimentacao_correta: null, crm_leads_parados: null, crm_registra_interacoes: null,
  crm_historico_completo: null, crm_whatsapp_fora: null, crm_erros_status: null,
  crm_funil_realidade: null, crm_gestor_confia: null, crm_principal_erro: '',

  abord_liga_imediatamente: null, abord_tempo_resposta_5min: null, abord_comeca_whatsapp: null,
  abord_ligacoes_frequentes: null, abord_seguranca_falar: null, abord_abertura_estruturada: null,
  abord_faz_perguntas: null, abord_fala_mais_que_escuta: null, abord_erro_ligacoes: '',

  qual_perguntas_cenario: null, qual_dor_real: null, qual_fala_decisor: null,
  qual_descobre_orcamento: null, qual_entende_prazo: null, qual_qualifica_ou_empurra: null,
  qual_perde_tempo_ruins: null, qual_diferencia_status: null, qual_erro_qualificacao: '',

  follow_5_tentativas: null, follow_multicanal: null, follow_personalizado: null,
  follow_desiste_rapido: null, follow_padrao_dias: null, follow_revisita_antigos: null,
  follow_registra_crm: null, follow_disciplina: null, follow_erro_followup: '',

  conv_agenda_reunioes: null, conv_reunioes_qualificadas: null, conv_leads_somem: null,
  conv_objecao_recorrente: null, conv_conduz_conversa: null, conv_valor_ou_preco: null,
  conv_quebra_expectativa: null, conv_inicio_ou_fechamento: null, conv_erro_conversao: '',

  disc_rotina_clara: null, disc_metas_individuais: null, disc_mede_desempenho: null,
  disc_cobranca_gestor: null, disc_executa_sem_motivacao: null, disc_consistencia: null,
  disc_sabe_o_que_fazer: null, disc_organizacao: null, disc_falta_rotina: '',

  erro_liga_pouco: null, erro_comeca_whatsapp: null, erro_nao_registra: null,
  erro_fala_mais: null, erro_nao_investiga: null, erro_aceita_nao: null,
  erro_nao_agenda: null, erro_nao_segue: null, erro_mais_prejudica: '',

  evol_melhorou: null, evol_gestor_percebe: null, evol_aplicou: null,
  evol_aumento_reunioes: null, evol_qualidade_leads: null, evol_mais_organizado: null,
  evol_crm_limpo: null, evol_processo_claro: null,
  evol_o_que_melhorou: '', evol_o_que_nao_melhorou: '',
  evol_top3_gargalos: '', evol_top3_acoes: '',

  observacoes_finais: '',
};

// ── Perguntas invertidas ───────────────────────────────────────────
// "Sim" = ruim (0 pts), "Não" = bom (2 pts)
const INVERTED_KEYS = new Set<string>([
  // Block 1
  'exec_volume_caiu', 'exec_alguem_nao_performa', 'exec_leads_sem_atividade',
  // Block 2
  'crm_leads_parados', 'crm_whatsapp_fora', 'crm_erros_status',
  // Block 3
  'abord_comeca_whatsapp', 'abord_fala_mais_que_escuta',
  // Block 4
  'qual_qualifica_ou_empurra', 'qual_perde_tempo_ruins',
  // Block 5
  'follow_desiste_rapido',
  // Block 6
  'conv_leads_somem', 'conv_objecao_recorrente', 'conv_quebra_expectativa',
  // Block 7: (none inverted)
  // Block 8: ALL inverted
  'erro_liga_pouco', 'erro_comeca_whatsapp', 'erro_nao_registra', 'erro_fala_mais',
  'erro_nao_investiga', 'erro_aceita_nao', 'erro_nao_agenda', 'erro_nao_segue',
]);

// ── Áreas scored (Blocos 1-7) e suas perguntas ───────────────────
export interface PaddockAreaConfig {
  key: string;
  label: string;
  questions: string[];
  obsKey: string;
}

export const PADDOCK_AREAS: PaddockAreaConfig[] = [
  {
    key: 'execucao',
    label: 'Execução',
    questions: ['exec_batendo_50', 'exec_consistencia_diaria', 'exec_comeca_pelo_crm', 'exec_blocos_ligacao', 'exec_volume_caiu', 'exec_alguem_nao_performa', 'exec_followup_diario', 'exec_leads_sem_atividade'],
    obsKey: '',
  },
  {
    key: 'crm',
    label: 'CRM',
    questions: ['crm_movimentacao_correta', 'crm_leads_parados', 'crm_registra_interacoes', 'crm_historico_completo', 'crm_whatsapp_fora', 'crm_erros_status', 'crm_funil_realidade', 'crm_gestor_confia'],
    obsKey: 'crm_principal_erro',
  },
  {
    key: 'abordagem',
    label: 'Abordagem',
    questions: ['abord_liga_imediatamente', 'abord_tempo_resposta_5min', 'abord_comeca_whatsapp', 'abord_ligacoes_frequentes', 'abord_seguranca_falar', 'abord_abertura_estruturada', 'abord_faz_perguntas', 'abord_fala_mais_que_escuta'],
    obsKey: 'abord_erro_ligacoes',
  },
  {
    key: 'qualificacao',
    label: 'Qualificação',
    questions: ['qual_perguntas_cenario', 'qual_dor_real', 'qual_fala_decisor', 'qual_descobre_orcamento', 'qual_entende_prazo', 'qual_qualifica_ou_empurra', 'qual_perde_tempo_ruins', 'qual_diferencia_status'],
    obsKey: 'qual_erro_qualificacao',
  },
  {
    key: 'followup',
    label: 'Follow-up',
    questions: ['follow_5_tentativas', 'follow_multicanal', 'follow_personalizado', 'follow_desiste_rapido', 'follow_padrao_dias', 'follow_revisita_antigos', 'follow_registra_crm', 'follow_disciplina'],
    obsKey: 'follow_erro_followup',
  },
  {
    key: 'conversao',
    label: 'Conversão',
    questions: ['conv_agenda_reunioes', 'conv_reunioes_qualificadas', 'conv_leads_somem', 'conv_objecao_recorrente', 'conv_conduz_conversa', 'conv_valor_ou_preco', 'conv_quebra_expectativa', 'conv_inicio_ou_fechamento'],
    obsKey: 'conv_erro_conversao',
  },
  {
    key: 'disciplina',
    label: 'Disciplina',
    questions: ['disc_rotina_clara', 'disc_metas_individuais', 'disc_mede_desempenho', 'disc_cobranca_gestor', 'disc_executa_sem_motivacao', 'disc_consistencia', 'disc_sabe_o_que_fazer', 'disc_organizacao'],
    obsKey: 'disc_falta_rotina',
  },
];

// ── Pontuação ──────────────────────────────────────────────────────
function scoreAnswer(key: string, value: string | null): number {
  if (!value) return 0;
  const inverted = INVERTED_KEYS.has(key);
  if (value === 'parcialmente') return 1; // always 1
  if (inverted) {
    return value === 'sim' ? 0 : 2;
  }
  return value === 'sim' ? 2 : 0;
}

export interface PaddockAreaScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  nota: number; // 0-10
  status: 'saudavel' | 'atencao' | 'critico';
}

export function calcPaddockAreaScores(data: PaddockDiagnosticoFormData): PaddockAreaScore[] {
  return PADDOCK_AREAS.map((area) => {
    let total = 0;
    let max = 0;
    for (const q of area.questions) {
      const val = (data as any)[q] as string | null;
      total += scoreAnswer(q, val);
      max += 2;
    }
    const nota = max > 0 ? Math.round((total / max) * 100) / 10 : 0;
    let status: PaddockAreaScore['status'] = 'critico';
    if (nota >= 8) status = 'saudavel';
    else if (nota >= 5) status = 'atencao';
    return { key: area.key, label: area.label, score: total, maxScore: max, nota, status };
  });
}

export function calcPaddockNotaGeral(areas: PaddockAreaScore[]): number {
  if (areas.length === 0) return 0;
  const sum = areas.reduce((s, a) => s + a.nota, 0);
  return Math.round((sum / areas.length) * 10) / 10;
}

export function calcPaddockPrioridade(notaGeral: number): string {
  if (notaGeral >= 8) return 'Baixa';
  if (notaGeral >= 6) return 'Média';
  if (notaGeral >= 4) return 'Alta';
  return 'Urgente';
}

// ── Labels das perguntas (para geração do relatório) ──────────────
const QUESTION_LABELS: Record<string, string> = {
  // Execução
  exec_batendo_50: 'Time batendo 50+ atividades/dia',
  exec_consistencia_diaria: 'Consistência diária na execução',
  exec_comeca_pelo_crm: 'Começa o dia pelo CRM',
  exec_blocos_ligacao: 'Blocos de ligação organizados',
  exec_volume_caiu: 'Volume de atividades caiu',
  exec_alguem_nao_performa: 'Alguém do time não performa',
  exec_followup_diario: 'Follow-up diário acontecendo',
  exec_leads_sem_atividade: 'Leads sem atividade recente',
  // CRM
  crm_movimentacao_correta: 'Movimentação correta no CRM',
  crm_leads_parados: 'Leads parados no funil',
  crm_registra_interacoes: 'Registra todas as interações',
  crm_historico_completo: 'Histórico completo dos leads',
  crm_whatsapp_fora: 'Conversas de WhatsApp fora do CRM',
  crm_erros_status: 'Erros frequentes de status no funil',
  crm_funil_realidade: 'Funil reflete a realidade',
  crm_gestor_confia: 'Gestor confia nos dados do CRM',
  // Abordagem
  abord_liga_imediatamente: 'Liga imediatamente para novos leads',
  abord_tempo_resposta_5min: 'Tempo de resposta abaixo de 5 minutos',
  abord_comeca_whatsapp: 'Começa abordagem pelo WhatsApp ao invés de ligar',
  abord_ligacoes_frequentes: 'Ligações frequentes e consistentes',
  abord_seguranca_falar: 'Segurança ao falar com leads',
  abord_abertura_estruturada: 'Abertura de ligação estruturada',
  abord_faz_perguntas: 'Faz perguntas estratégicas na abordagem',
  abord_fala_mais_que_escuta: 'Fala mais do que escuta nas ligações',
  // Qualificação
  qual_perguntas_cenario: 'Faz perguntas sobre cenário do lead',
  qual_dor_real: 'Identifica a dor real do lead',
  qual_fala_decisor: 'Fala com o decisor',
  qual_descobre_orcamento: 'Descobre orçamento disponível',
  qual_entende_prazo: 'Entende o prazo de decisão',
  qual_qualifica_ou_empurra: 'Empurra lead ao invés de qualificar',
  qual_perde_tempo_ruins: 'Perde tempo com leads ruins',
  qual_diferencia_status: 'Diferencia status dos leads corretamente',
  // Follow-up
  follow_5_tentativas: 'Faz pelo menos 5 tentativas de contato',
  follow_multicanal: 'Follow-up multicanal (ligação, WhatsApp, e-mail)',
  follow_personalizado: 'Follow-up personalizado por lead',
  follow_desiste_rapido: 'Desiste rápido dos leads',
  follow_padrao_dias: 'Padrão de dias entre follow-ups definido',
  follow_revisita_antigos: 'Revisita leads antigos',
  follow_registra_crm: 'Registra follow-ups no CRM',
  follow_disciplina: 'Disciplina consistente no follow-up',
  // Conversão
  conv_agenda_reunioes: 'Agenda reuniões com frequência',
  conv_reunioes_qualificadas: 'Reuniões agendadas são qualificadas',
  conv_leads_somem: 'Leads somem após a proposta',
  conv_objecao_recorrente: 'Objeções recorrentes não tratadas',
  conv_conduz_conversa: 'Conduz a conversa de fechamento',
  conv_valor_ou_preco: 'Vende valor ao invés de preço',
  conv_quebra_expectativa: 'Quebra de expectativa no fechamento',
  conv_inicio_ou_fechamento: 'Foca no início do funil e no fechamento',
  // Disciplina
  disc_rotina_clara: 'Rotina clara de trabalho',
  disc_metas_individuais: 'Metas individuais definidas',
  disc_mede_desempenho: 'Mede desempenho individual',
  disc_cobranca_gestor: 'Cobrança consistente do gestor',
  disc_executa_sem_motivacao: 'Executa mesmo sem motivação',
  disc_consistencia: 'Consistência na execução semanal',
  disc_sabe_o_que_fazer: 'Sabe exatamente o que fazer cada dia',
  disc_organizacao: 'Organização pessoal do vendedor',
  // Erros Críticos (Block 8)
  erro_liga_pouco: 'Liga pouco para os leads',
  erro_comeca_whatsapp: 'Começa pelo WhatsApp ao invés de ligar',
  erro_nao_registra: 'Não registra atividades no CRM',
  erro_fala_mais: 'Fala mais do que escuta',
  erro_nao_investiga: 'Não investiga a dor do lead',
  erro_aceita_nao: 'Aceita o "não" fácil demais',
  erro_nao_agenda: 'Não agenda próximo passo',
  erro_nao_segue: 'Não segue o processo definido',
  // Evolução Real (Block 9)
  evol_melhorou: 'Melhorou no geral após War #2',
  evol_gestor_percebe: 'Gestor percebe a evolução',
  evol_aplicou: 'Aplicou o que aprendeu no War #2',
  evol_aumento_reunioes: 'Aumento no número de reuniões',
  evol_qualidade_leads: 'Melhoria na qualidade dos leads',
  evol_mais_organizado: 'Vendedor mais organizado',
  evol_crm_limpo: 'CRM mais limpo e atualizado',
  evol_processo_claro: 'Processo comercial mais claro',
};

// ── Detalhamento por área: por quê, como resolver, referência War #2 ──
const AREA_DETAIL: Record<string, {
  porQue: string;
  comoResolver: string;
  referenciaWar2: string;
  critico: string[];
  atencao: string[];
  saudavel: string[];
  howTo: string[];
  examples: string[];
  learn: string[];
}> = {
  execucao: {
    porQue: 'O volume de atividades é a base matemática da operação comercial B2B. A conta é simples: 100 tentativas de contato geram aproximadamente 20 conexões efetivas (20%), que geram 8 conversas qualificadas (40%), que geram 3 reuniões agendadas (35%), que geram 1 proposta enviada. Se o vendedor faz 30 tentativas ao invés de 50, ele está cortando pela metade o número de reuniões possíveis. Não é questão de talento — é matemática pura. Time que não bate volume, não bate meta.',
    comoResolver: 'A solução é criar uma rotina blindada contra distrações. O vendedor deve ter 2 blocos de ligação por dia (manhã e tarde) de 2 horas cada, com celular no silencioso, e-mail fechado e CRM aberto. O gestor deve monitorar o volume de cada vendedor no dashboard do CRM e cobrar diariamente. No final de cada dia, cada vendedor deve reportar: quantas tentativas fez, quantas conexões conseguiu, quantas reuniões agendou.',
    referenciaWar2: 'Bloco 3.1 — Volume de atividades: a lei dos números. Tabela de metas mínimas diárias (50 tentativas, 8 conexões, 3 qualificados, 1 reunião).',
    critico: [
      'URGENTE: Garantir volume mínimo de 50 tentativas de contato por dia por vendedor — sem isso, nenhuma outra melhoria funciona',
      'Criar blocos de ligação de 2h seguidas (manhã 8:30-10:30 e tarde 14:00-16:00) sem distrações',
      'Implementar check diário obrigatório no CRM: vendedor reporta volume antes de fechar o dia',
      'Identificar vendedores abaixo do mínimo e criar plano de recuperação individual em 7 dias',
      'Gestor deve acompanhar o dashboard de volume diariamente — não esperar a reunião semanal',
    ],
    atencao: [
      'Volume existe mas oscila muito entre os dias — padronizar para variação máxima de 20%',
      'Reforçar blocos de ligação com horários fixos no calendário de cada vendedor',
      'Monitorar semanalmente quem está abaixo da meta e intervir antes de virar crônico',
    ],
    saudavel: [
      'Manter disciplina de volume e escalar gradualmente para 80 atividades/dia',
      'Focar em qualidade: priorizar leads mais qualificados para aumentar conversão sem aumentar volume',
    ],
    howTo: [
      'Passo 1: Definir horário fixo dos blocos de ligação no calendário de TODOS os vendedores',
      'Passo 2: Configurar o CRM para mostrar o contador de atividades do dia no dashboard',
      'Passo 3: No início de cada dia, vendedor abre o CRM e checa atividades pendentes',
      'Passo 4: Durante o bloco, celular no silencioso, só CRM aberto, sem pausa para WhatsApp',
      'Passo 5: No final do dia, reportar volume no grupo da equipe: "Hoje: 52 tentativas, 12 conexões, 2 reuniões"',
      'Passo 6: Gestor revisa o painel semanal e conversa individualmente com quem está abaixo',
    ],
    examples: [
      'Antes: Vendedor começa o dia no WhatsApp, faz 15 ligações aleatórias e reclama que não tem resultado → Depois: Abre o CRM às 8:30, liga de forma sistemática por 2h, faz 30 tentativas só na manhã',
      'Antes: Segunda-feira faz 60 atividades, terça faz 10 → Depois: Mantém entre 45-55 todos os dias da semana',
      'Antes: Gestor só descobre que vendedor não está ligando na reunião semanal → Depois: Check diário de 2 minutos no dashboard identifica problema no mesmo dia',
      'Antes: Vendedor diz "não tenho lead pra ligar" → Depois: Fila de leads no CRM é abastecida semanalmente, sempre tem no mínimo 100 leads na fila',
    ],
    learn: [
      'Releia o Bloco 3.1 da War Room #2: "100 tentativas → 20 conexões → 8 qualificados → 3 reuniões → 1 proposta"',
      'Livro recomendado: "Receita Previsível" — Aaron Ross (Cap. sobre volume e processos de prospecção)',
      'Referência interna: tabela de metas mínimas diárias entregue na War Room #2',
    ],
  },
  crm: {
    porQue: 'O CRM é o cérebro da operação comercial. Se o CRM está sujo, o gestor toma decisões erradas, leads quentes se perdem, e o time trabalha no escuro. Um lead que não foi movimentado no funil há 5 dias é um lead que provavelmente já comprou do concorrente. Lead sem registro de interação é lead que ninguém sabe se foi contactado. E o pior erro: marcar como "Desqualificado" um lead que simplesmente não atendeu — isso mata oportunidades reais antes de existirem.',
    comoResolver: 'A regra é: se não está no CRM, não aconteceu. Toda ligação, mensagem, e-mail e reunião deve ser registrada em tempo real (não no final do dia). O WhatsApp Business deve estar integrado ao CRM — conversas por fora não contam. O gestor deve fazer uma limpeza semanal: leads parados há mais de 7 dias sem atividade precisam ser reativados ou encerrados. Status devem ser corrigidos: lead que não atendeu = "Tentativa de Contato", NÃO "Desqualificado".',
    referenciaWar2: 'Bloco 2 — Apresentação do CRM (Tour pelo sistema, Métricas, WhatsApp integrado). Especialmente a tabela de Status Correto no CRM.',
    critico: [
      'URGENTE: Limpar TODOS os leads parados no funil sem atualização — cada um é oportunidade perdida',
      'Eliminar 100% do uso de WhatsApp fora do CRM — toda comunicação com lead passa pelo CRM',
      'Corrigir erros de status: "não atendeu" = Tentativa de Contato, NÃO Desqualificado',
      'Implementar regra: todo lead deve ter próxima atividade agendada — lead sem atividade = lead morto',
      'Gestor deve usar SOMENTE dados do CRM para reuniões de equipe — se não confia, o CRM precisa ser corrigido',
    ],
    atencao: [
      'Melhorar qualidade: cada registro deve ter data, canal, resultado e próximo passo definido',
      'Fazer limpeza semanal de cards abandonados no funil — não podem acumular',
      'Treinar equipe para registrar em tempo real, não acumular pro final do dia',
    ],
    saudavel: [
      'CRM confiável — usar relatórios para direcionar estratégia de vendas e priorizar esforço',
      'Explorar automações: follow-ups automáticos, alertas de leads parados, scoring de leads',
    ],
    howTo: [
      'Passo 1: Conectar o WhatsApp Business de cada vendedor no CRM (Configurações → Integrações)',
      'Passo 2: Criar regra: após CADA interação, registrar no CRM com data, canal e resultado',
      'Passo 3: Todo lead deve ter próxima atividade agendada (nem que seja "ligar em 3 dias")',
      'Passo 4: Toda segunda-feira, gestor revisa funil: leads sem atividade há 7+ dias = ação imediata',
      'Passo 5: Revisar e corrigir status errados (usar tabela da War #2 como referência)',
      'Passo 6: Dashboard do CRM deve ser a primeira coisa que o gestor abre toda manhã',
    ],
    examples: [
      'Antes: Vendedor fala com lead no WhatsApp pessoal, não registra nada → colega liga pro mesmo lead e passa vergonha → Depois: Tudo no CRM, qualquer pessoa vê o histórico completo',
      'Antes: Lead não atendeu 2x → vendedor marca como "Desqualificado" → Depois: Marca como "Tentativa de Contato" e segue o ciclo de 5 tentativas',
      'Antes: Gestor pergunta "quantas reuniões marcamos?" e ninguém sabe → Depois: Dashboard mostra em tempo real: 12 reuniões na semana, 3 fechamentos',
      'Antes: 50 leads parados no funil há 2 semanas sem ninguém tocar → Depois: Limpeza semanal, leads reativados ou encerrados, funil sempre limpo',
    ],
    learn: [
      'Releia o Bloco 2 da War Room #2: Tour pelo CRM e a tabela de Status Correto',
      'Regra fundamental: "Nunca atendeu" ≠ "Desqualificado". São etapas completamente diferentes',
      'Referência: Passo a passo de integração do WhatsApp dado na War Room #2 (Bloco 2.3)',
    ],
  },
  abordagem: {
    porQue: 'A abordagem inicial é a porta de entrada da venda. Lead novo que recebe ligação em menos de 5 minutos tem 400% mais chance de conversão do que lead contactado após 1 hora. Passaram 24 horas? O lead já esfriou. E o maior erro que mata vendas antes de começarem: começar pelo WhatsApp ao invés de ligar. WhatsApp é fácil de ignorar, não permite qualificar em tempo real e cria uma falsa sensação de "já tentei". Ligação é insubstituível porque permite ouvir o tom do lead, fazer perguntas e conduzir a conversa.',
    comoResolver: 'A regra número 1 é: lead entrou → ligação em 5 minutos, sem exceção. A abertura deve ser estruturada (nome + empresa + motivo + permissão) mas soar natural, não robótica. O vendedor deve fazer perguntas abertas (como, o que, me conta) e ESCUTAR. A regra é 70% escutando, 30% falando. Se o vendedor está falando mais de 2 minutos seguidos, está perdendo a ligação.',
    referenciaWar2: 'Bloco 4 — Como Ligar de Verdade. Bloco 4.2 — Estrutura da ligação perfeita (7 etapas). Scripts 1, 2 e 3.',
    critico: [
      'URGENTE: Parar de abordar leads por WhatsApp primeiro — a primeira ação SEMPRE é ligação',
      'Meta de tempo: lead novo deve receber ligação em no MÁXIMO 5 minutos após conversão',
      'Criar script de abertura padrão que toda equipe usa: nome, empresa, razão, permissão',
      'Treinar perguntas abertas: quem pergunta conduz, quem conduz vende',
      'Regra 70/30: 70% do tempo da ligação o vendedor deve estar ESCUTANDO',
    ],
    atencao: [
      'Equipe liga, mas abertura ainda é improvisada — padronizar sem parecer robô',
      'Reforçar escuta ativa: vendedor que fala mais que ouve perde a venda',
      'Revisar gravações de ligações para identificar padrões de erro',
    ],
    saudavel: [
      'Abordagem sólida — treinar variações para diferentes perfis de lead',
      'Implementar roleplay semanal para manter a equipe afiada e confiante',
    ],
    howTo: [
      'Passo 1: Configurar alerta no CRM: lead entrou → notificação imediata no celular do vendedor',
      'Passo 2: Vendedor para o que está fazendo e liga em até 5 minutos',
      'Passo 3: Usar abertura estruturada: "Oi [nome], aqui é [vendedor] da [empresa]. Vi que você demonstrou interesse, quis ligar pessoalmente..."',
      'Passo 4: Pedir permissão: "Você tem 2 minutinhos?"',
      'Passo 5: Fazer perguntas abertas: "Me conta, como funciona o comercial de vocês hoje?"',
      'Passo 6: ESCUTAR a resposta. Anotar no CRM enquanto ouve.',
      'Passo 7: Só depois de entender o cenário, conectar com a solução',
    ],
    examples: [
      'Antes: Lead preenche formulário às 10h → vendedor vê às 16h → manda WhatsApp "Oi, vi seu interesse" → lead não responde → Depois: Lead entra às 10h → ligação às 10:03 → "Vi agora que você se cadastrou, quis falar pessoalmente" → conversa de 3min → reunião agendada',
      'Antes: "Oi, tudo bem? Eu sou da empresa X e a gente faz marketing digital, posso te apresentar?" → lead desliga → Depois: "Oi João, aqui é o Pedro da Millennials. Vi que vocês estão expandindo a operação comercial — me conta, qual o maior desafio hoje?" → conversa real',
      'Antes: Vendedor fala 4 minutos explicando o produto → lead fica em silêncio → Depois: Vendedor faz 3 perguntas em 90 segundos → lead fala por 2 minutos → vendedor entende a dor e propõe reunião',
    ],
    learn: [
      'Releia Scripts 1, 2 e 3 da War Room #2 — pratique em voz alta antes de ligar',
      'Bloco 4.1 da War Room #2: Postura e tom de voz (ficar de pé muda o tom!)',
      'Referência: Estrutura da ligação perfeita em 7 etapas (15s + 30s + 10s + 90s + 30s + 30s + 20s)',
    ],
  },
  qualificacao: {
    porQue: 'Qualificação ruim é o maior desperdício de tempo e energia do time comercial. Vendedor que não qualifica empurra leads ruins para reunião, gera frustração no fechador, desperdiça tempo de todo mundo e infla os números com reuniões que nunca vão fechar. O BANT (Budget, Authority, Need, Timeline) existe para separar oportunidades reais de curiosos. Se o lead não tem orçamento, não é o decisor, não tem necessidade real ou não tem prazo — NÃO É QUALIFICADO.',
    comoResolver: 'Antes de marcar qualquer reunião, o vendedor deve saber: 1) O lead tem orçamento ou previsão de investimento? 2) Está falando com quem decide? 3) Tem dor real que a gente resolve? 4) Tem prazo para resolver? Mínimo 3 de 4 critérios para avançar. E o erro mais grave: marcar como "Desqualificado" lead que não atendeu. Lead que não atendeu é "Tentativa de Contato" — são coisas completamente diferentes.',
    referenciaWar2: 'Bloco 3.2 — Qualificação de leads: BANT. Ponto crítico sobre a diferença entre "não atendeu" e "desqualificado".',
    critico: [
      'URGENTE: Treinar toda equipe no BANT — nenhuma reunião sem qualificação mínima',
      'Parar de empurrar leads para reunião sem entender dor, orçamento e decisor',
      'Corrigir o erro fatal: "não atendeu" ≠ "Desqualificado"',
      'Criar checklist BANT obrigatório no CRM: lead só avança com 3 de 4 critérios',
    ],
    atencao: [
      'Investigar dor real (implicação SPIN) — não aceitar respostas superficiais',
      'Revisar semanalmente reuniões marcadas: quantas eram qualificadas de verdade?',
    ],
    saudavel: [
      'Manter padrão e segmentar leads por potencial (A, B, C) para priorizar esforço',
      'Implementar scoring automático no CRM para priorização',
    ],
    howTo: [
      'Passo 1: Antes de QUALQUER reunião, vendedor preenche no CRM: Orçamento? Decisor? Necessidade? Prazo?',
      'Passo 2: Se responder "sim" para 3 de 4 → qualificado, pode agendar reunião',
      'Passo 3: Se responder "sim" para 2 ou menos → manter em nutrição, não agendar ainda',
      'Passo 4: Usar perguntas SPIN: Situação ("como funciona hoje?"), Problema ("qual o maior desafio?"), Implicação ("o que acontece se não resolver?"), Necessidade ("se resolvesse, qual impacto?")',
      'Passo 5: Nunca perguntar direto "você tem dinheiro?" — perguntar "vocês já investem em marketing digital hoje?"',
    ],
    examples: [
      'Antes: Vendedor marca reunião com qualquer um que pareça interessado → 7 de 10 reuniões são perda de tempo → Depois: Só agenda com 3/4 BANT → 7 de 10 reuniões são com decisores com dor real',
      'Antes: Lead diz "não tenho interesse" → vendedor marca Desqualificado → Depois: Vendedor pergunta "entendo, o que te levou a se cadastrar?" → descobre que tem interesse mas timing ruim → agenda follow-up em 30 dias',
      'Antes: "Qual seu orçamento?" (lead desliga) → Depois: "Vocês já investem em alguma estratégia de marketing digital hoje? Quanto mais ou menos?" (conversa natural)',
    ],
    learn: [
      'Releia Bloco 3.2 da War Room #2: BANT completo com exemplos de perguntas',
      'Tabela de Status Correto: "Nunca atendeu = Tentativa de Contato, NÃO Desqualificado"',
      'Livro: SPIN Selling — Neil Rackham (método de perguntas para qualificação)',
    ],
  },
  followup: {
    porQue: 'Estudos mostram que 80% das vendas B2B acontecem entre a 5ª e a 12ª tentativa de contato. Mas a maioria dos vendedores desiste na 2ª tentativa. Isso significa que o time está literalmente jogando fora 80% das vendas possíveis por falta de persistência. Follow-up não é insistência — é profissionalismo. O lead já demonstrou interesse ao se cadastrar; o vendedor só precisa encontrar o momento certo. E cada follow-up deve agregar valor, não repetir a mesma mensagem.',
    comoResolver: 'Implementar cadência obrigatória: Dia 1 (ligação + WPP se não atendeu), Dia 2 (ligação + mensagem com valor), Dia 4 (ligação + prova social), Dia 7 (última tentativa + mensagem de breakup), Dia 14 (reaquecimento leve). Mínimo 5 tentativas antes de encerrar. Variar canal a cada tentativa. Cada mensagem deve ser diferente e personalizada. E leads antigos (30-60 dias) devem ser revisitados — muitos mudam de cenário.',
    referenciaWar2: 'Bloco 3.3 — Ciclo completo de follow-up (Dia 1, 2, 4, 7, 14). Scripts de WhatsApp 01, 02 e 03. As 3 regras de ouro da condução.',
    critico: [
      'URGENTE: Mínimo de 5 tentativas por lead antes de encerrar — NUNCA desistir antes disso',
      'Implementar cadência fixa: Dia 1 (ligação+WPP), Dia 2 (valor), Dia 4 (prova social), Dia 7 (breakup), Dia 14 (reaquecimento)',
      'Parar de usar mensagem genérica — cada follow-up deve ter contexto personalizado',
      'Revisar leads abandonados: há oportunidades reais esquecidas no funil há semanas',
    ],
    atencao: [
      'Personalizar cada follow-up: referenciar a última conversa ou interação específica',
      'Garantir registro de todos os follow-ups no CRM para visibilidade do gestor',
      'Revisar semanalmente leads sem atividade há 7+ dias',
    ],
    saudavel: [
      'Manter disciplina e testar automações de follow-up para leads de menor prioridade',
      'Expandir canais: testar e-mail e LinkedIn para complementar ligação e WhatsApp',
    ],
    howTo: [
      'Passo 1: Dia 1 — Lead entrou → ligar imediatamente. Se não atendeu → WhatsApp (Script WPP 01 da War #2)',
      'Passo 2: Dia 2 — Nova ligação + mensagem com informação de valor sobre o mercado do lead',
      'Passo 3: Dia 4 — Ligação + mensagem com caso de sucesso de cliente similar (Script WPP 02)',
      'Passo 4: Dia 7 — Última tentativa direta + mensagem de encerramento respeitosa (Script WPP 03)',
      'Passo 5: Dia 14 — Reaquecimento leve, sem pressão: "Passando pra ver se algo mudou"',
      'Passo 6: Após 5 tentativas sem resposta → marcar como "Ciclo Encerrado", revisitar em 60 dias',
    ],
    examples: [
      'Antes: Vendedor liga 1x, manda WPP "Oi, vi seu interesse", não responde, desiste → Depois: 5 tentativas em 14 dias, cada uma com abordagem diferente, resultado: 30% respondem entre a 3ª e 5ª tentativa',
      'Antes: "Oi, tudo bem? Queria saber se tem interesse" (mesma mensagem 3x) → Depois: "João, vi que a empresa X do mesmo segmento que vocês gerou 47 leads em 15 dias com a gente. Vale 15min pra eu te mostrar como?"',
      'Antes: Lead respondeu "agora não posso" → vendedor nunca mais liga → Depois: Agenda follow-up para 3 dias depois, liga e diz "lembra que conversamos? Arrumei um horário de 15min pra você, amanhã às 10h ou quarta às 15h?"',
    ],
    learn: [
      'Releia Scripts WPP 01, 02 e 03 da War Room #2 — são templates prontos para copiar e adaptar',
      'Bloco 3.3: As 3 regras de ouro (todo lead com próxima ação, sempre agendar o próximo contato, nunca mandar a mesma mensagem duas vezes)',
      'Livro: "Receita Previsível" — Aaron Ross (cadência de prospecção outbound)',
    ],
  },
  conversao: {
    porQue: 'Conversão é onde todo o trabalho anterior se transforma em resultado. Se o time gera leads, qualifica, faz follow-up, agenda reuniões — mas não fecha, o problema pode estar em: condução fraca da conversa, falta de proposta de valor clara, objeções não tratadas, ou quebra de expectativa entre o que o marketing promete e o que vendas entrega. Cada reunião perdida é dinheiro gasto em marketing sem retorno.',
    comoResolver: 'Três ações concretas: 1) Mapear as 5 objeções mais comuns e criar script de tratamento para cada uma. 2) Treinar condução de conversa focada em valor usando SPIN (fazer o lead perceber sozinho que precisa da solução). 3) Alinhar o discurso de vendas com o que o marketing comunica nos anúncios — se o lead espera uma coisa e ouve outra, não fecha.',
    referenciaWar2: 'Bloco 3.4 — Método SPIN Selling. Bloco 4 — Como Ligar de Verdade (postura, estrutura, scripts).',
    critico: [
      'URGENTE: Mapear as 5 objeções mais recorrentes e criar script de tratamento para cada uma',
      'Treinar condução de conversa de fechamento — vendedor leva o lead naturalmente ao agendamento',
      'Alinhar marketing e vendas: o que o anúncio promete DEVE ser o que o vendedor fala',
      'Implementar revisão pós-reunião obrigatória: o que funcionou, o que travou, o que fazer diferente',
    ],
    atencao: [
      'Otimizar agendamento: oferecer 2 opções de data/hora para facilitar decisão do lead',
      'Trabalhar proposta de valor: lead deve entender RESULTADO, não funcionalidade',
      'Identificar em qual etapa exata os leads estão se perdendo (primeiro contato vs fechamento)',
    ],
    saudavel: [
      'Manter padrão e focar em aumentar ticket médio e reduzir ciclo de venda',
      'Implementar cases de sucesso como ferramenta padrão de fechamento',
    ],
    howTo: [
      'Passo 1: Listar as 5 objeções que mais aparecem (ex: "muito caro", "já tenho fornecedor", "preciso pensar")',
      'Passo 2: Para cada objeção, criar resposta usando SPIN: transformar objeção em pergunta',
      'Passo 3: Treinar roleplay semanal: um vendedor faz o lead, outro tenta fechar',
      'Passo 4: Após cada reunião, registrar no CRM: "O que funcionou? O que travou? Próximo passo?"',
      'Passo 5: Revisar semanalmente o funil de conversão: onde está o maior vazamento?',
    ],
    examples: [
      'Antes: Lead diz "tá caro" → vendedor dá desconto → Depois: "Entendo a preocupação com investimento. Me conta: quanto vocês perdem por mês sem resolver esse problema? Se a gente resolver em 30 dias, quanto isso vale pra vocês?"',
      'Antes: Marketing promete "50 leads por mês" → vendedor fala em "estratégia de marca" → lead fica confuso → Depois: Discurso alinhado: "Vamos gerar X leads qualificados com a estratégia Y, assim como fizemos para o cliente Z"',
      'Antes: Reunião sem estrutura, vendedor improvisa 40 minutos → Depois: 5 minutos de rapport, 10 de diagnóstico (SPIN), 10 de apresentação de valor, 5 de agendamento de próximo passo',
    ],
    learn: [
      'Releia Bloco 3.4: SPIN Selling — Situação, Problema, Implicação, Necessidade',
      'Bloco 5 da War Room #2: Tabela de erros (NUNCA faça vs SEMPRE faça)',
      'Livro: SPIN Selling — Neil Rackham (Cap. sobre tratamento de objeções)',
    ],
  },
  disciplina: {
    porQue: 'Disciplina é o que separa um SDR mediano de um top performer. Resultado em vendas B2B não é dom, não é carisma, não é sorte — é rotina executada com consistência TODOS os dias. Sem rotina clara, o vendedor improvisa: segunda liga bastante, terça responde e-mail, quarta faz reunião, quinta não faz nada, sexta "organiza". Essa aleatoriedade gera resultados imprevisíveis. Top performers fazem a mesma coisa, do mesmo jeito, todos os dias — e por isso entregam resultado previsível.',
    comoResolver: 'Definir rotina diária escrita e não-negociável: Manhã (abrir CRM, checar pendências, bloco de ligações 8:30-10:30), Tarde (follow-ups, registros, segundo bloco de ligações 14:00-16:00), Final do dia (atualizar pipeline, checar metas, reportar volume). Cada vendedor deve ter metas individuais claras e VISÍVEIS — não escondidas numa planilha. O gestor deve cobrar diariamente e reconhecer quem entrega.',
    referenciaWar2: 'Bloco 6 — Rotina Diária do SDR (Manhã, Ao longo do dia, Final do dia). Bloco 7 — Tarefas de Casa e Próximos Passos.',
    critico: [
      'URGENTE: Escrever rotina diária não-negociável para cada vendedor — horários fixos, atividades fixas',
      'Implementar metas individuais claras e visíveis — cada um sabe meta e progresso',
      'Gestor deve cobrar diariamente — sem cobrança, sem execução',
      'Criar painel visual de acompanhamento: quem bate meta, quem deve, quem precisa de ajuda',
    ],
    atencao: [
      'Reforçar consistência: volume não pode oscilar — dias fracos viram semanas fracas viram meses ruins',
      'Implementar check-in diário de 5 minutos: vendedor reporta volume do dia anterior e plano do dia',
    ],
    saudavel: [
      'Manter disciplina e implementar metas progressivas (aumentar gradualmente)',
      'Reconhecer e premiar top performers para criar cultura de alta performance',
    ],
    howTo: [
      'Passo 1: Escrever a rotina diária em um documento de 1 página — horário por horário',
      'Passo 2: Cada vendedor imprime e cola ao lado do computador (sim, no papel)',
      'Passo 3: Definir metas individuais semanais: X tentativas, Y conexões, Z reuniões',
      'Passo 4: Criar quadro visual (Notion, planilha ou quadro físico) com meta vs realizado de cada um',
      'Passo 5: Check-in diário às 8:30: "o que fiz ontem, o que vou fazer hoje"',
      'Passo 6: Reconhecer publicamente quem bateu meta (mensagem no grupo, destaque na reunião)',
    ],
    examples: [
      'Antes: Cada vendedor faz o que quer, na hora que quer → resultado oscila 50% semana a semana → Depois: Rotina padronizada, resultado varia no máximo 15%',
      'Antes: Gestor pergunta "como tá?" e vendedor diz "tá indo" → Depois: Dashboard mostra em tempo real: João está em 78% da meta semanal, Maria em 112%',
      'Antes: Vendedor motivado na segunda, desanimado na quinta → Depois: Executa a rotina independente de motivação, porque sabe que resultado é consequência de volume',
      'Antes: Ninguém sabe a meta do mês → Depois: Meta escrita no quadro, cada vendedor sabe exatamente quanto falta',
    ],
    learn: [
      'Releia Bloco 6 da War Room #2: Rotina Diária do SDR (Manhã, Ao longo do dia, Final do dia)',
      'Releia Bloco 7: Tarefas de Casa — 5 tarefas obrigatórias até a próxima War Room',
      'Livro: "O Poder do Hábito" — Charles Duhigg (como criar rotinas que grudam)',
    ],
  },
};

// ── Geração automática do relatório ──────────────────────────────
export function generatePaddockReport(
  data: PaddockDiagnosticoFormData,
  areaScores?: PaddockAreaScore[],
  notaGeral?: number,
  prioridade?: string,
): string {
  const areas = areaScores || calcPaddockAreaScores(data);
  const nota = notaGeral ?? calcPaddockNotaGeral(areas);
  const prio = prioridade || calcPaddockPrioridade(nota);

  const criticas = areas.filter(a => a.status === 'critico');
  const atencao = areas.filter(a => a.status === 'atencao');
  const saudaveis = areas.filter(a => a.status === 'saudavel');

  // ── Pontos fortes e gargalos (blocos 1-7) ──
  const pontosFortes: string[] = [];
  const gargalos: string[] = [];

  for (const area of PADDOCK_AREAS) {
    for (const q of area.questions) {
      const val = (data as any)[q] as string | null;
      if (!val) continue;
      const inverted = INVERTED_KEYS.has(q);
      const label = QUESTION_LABELS[q] || q;

      if (inverted) {
        if (val === 'nao') pontosFortes.push(label);
        else gargalos.push(label + (val === 'parcialmente' ? ' (parcial)' : ''));
      } else {
        if (val === 'sim') pontosFortes.push(label);
        else gargalos.push(label + (val === 'parcialmente' ? ' (parcial)' : ''));
      }
    }
  }

  // ── Erros detectados (Bloco 8) ──
  const errosDetectados: string[] = [];
  const erroKeys = [
    'erro_liga_pouco', 'erro_comeca_whatsapp', 'erro_nao_registra', 'erro_fala_mais',
    'erro_nao_investiga', 'erro_aceita_nao', 'erro_nao_agenda', 'erro_nao_segue',
  ];
  for (const q of erroKeys) {
    const val = (data as any)[q] as string | null;
    if (val === 'sim') errosDetectados.push(QUESTION_LABELS[q] || q);
  }

  // ── Evolução pós War #2 (Bloco 9) ──
  const evolucaoKeys = [
    { key: 'evol_melhorou', label: 'Melhorou no geral após War #2' },
    { key: 'evol_gestor_percebe', label: 'Gestor percebe evolução real' },
    { key: 'evol_aplicou', label: 'Time aplicou o que foi ensinado' },
    { key: 'evol_aumento_reunioes', label: 'Aumento no número de reuniões' },
    { key: 'evol_qualidade_leads', label: 'Melhoria na qualidade dos leads' },
    { key: 'evol_mais_organizado', label: 'Vendedores mais organizados' },
    { key: 'evol_crm_limpo', label: 'CRM mais limpo e atualizado' },
    { key: 'evol_processo_claro', label: 'Processo comercial mais claro' },
  ];
  const melhorou: string[] = [];
  const naoMelhorou: string[] = [];
  for (const e of evolucaoKeys) {
    const val = (data as any)[e.key] as string | null;
    if (val === 'sim') melhorou.push(e.label);
    else if (val === 'parcialmente') melhorou.push(e.label + ' (em andamento)');
    else if (val === 'nao') naoMelhorou.push(e.label);
  }

  // ── Resumo geral contextualizado ──
  let resumo = '';
  const clienteNome = data.cliente_nome || 'o cliente';
  if (criticas.length >= 4) {
    resumo = `A operação comercial de ${clienteNome} apresenta falhas estruturais graves em ${criticas.length} das 7 áreas avaliadas após o treinamento da War Room #2. Isso indica que o conteúdo ensinado não foi absorvido ou executado pela equipe. Antes de qualquer estratégia de crescimento, é fundamental corrigir a base: volume de atividades, uso correto do CRM, abordagem estruturada e disciplina diária. Sem essas correções, investir em marketing ou escala vai gerar custo sem retorno.\n\nAs áreas mais críticas são: ${criticas.map(a => a.label).join(', ')}. Cada uma dessas áreas precisa de intervenção imediata nas próximas 48 horas.`;
  } else if (criticas.length >= 2 || atencao.length >= 3) {
    resumo = `A operação comercial de ${clienteNome} possui uma base parcialmente estruturada após a War Room #2. O time demonstrou absorção parcial do conteúdo, mas ainda existem ${criticas.length} área(s) crítica(s) e ${atencao.length} área(s) em atenção que estão limitando o desempenho. Há oportunidades concretas de melhoria que, se executadas nas próximas 2 semanas, podem destravar resultados significativos.\n\nPontos que precisam de atenção prioritária: ${[...criticas, ...atencao].map(a => a.label).join(', ')}.`;
  } else if (atencao.length >= 1) {
    resumo = `A operação comercial de ${clienteNome} está bem encaminhada após a War Room #2. A equipe demonstrou boa absorção do conteúdo com ${saudaveis.length} área(s) saudável(eis). Existem ${atencao.length} ponto(s) de atenção que podem ser otimizados para acelerar os resultados e chegar no próximo nível de performance.\n\nFoco de otimização: ${atencao.map(a => a.label).join(', ')}.`;
  } else {
    resumo = `A operação comercial de ${clienteNome} está saudável e bem estruturada após a War Room #2. Todas as 7 áreas avaliadas estão em bom estado, indicando que o time absorveu e executou o conteúdo do treinamento de forma consistente. O foco agora deve ser em otimização contínua, aumento progressivo de metas e estratégias de escala para maximizar resultados.`;
  }

  // ── Montar texto final ──
  const L: string[] = [];
  L.push(`DIAGNÓSTICO COMERCIAL PÓS WAR #2 — ${clienteNome}`);
  L.push(`Data: ${data.data_consultoria || 'Não informada'}`);
  L.push(`Responsável: ${data.responsavel_diagnostico || 'Não informado'}`);
  L.push(`Nota geral: ${nota}/10`);
  L.push(`Prioridade: ${prio}`);
  L.push('');

  // ── RESUMO GERAL ──
  L.push('═══════════════════════════════════════════════');
  L.push('  RESUMO GERAL DA OPERAÇÃO COMERCIAL');
  L.push('═══════════════════════════════════════════════');
  L.push('');
  L.push(resumo);
  L.push('');

  // ── NOTA POR ÁREA ──
  L.push('═══════════════════════════════════════════════');
  L.push('  SCORECARD — NOTA POR ÁREA');
  L.push('═══════════════════════════════════════════════');
  L.push('');
  for (const a of areas) {
    const bar = '█'.repeat(Math.round(a.nota)) + '░'.repeat(10 - Math.round(a.nota));
    const statusLabel = a.status === 'saudavel' ? '✅ Saudável' : a.status === 'atencao' ? '⚠️ Atenção' : '🔴 Crítico';
    L.push(`  ${a.label.padEnd(16)} ${bar} ${a.nota}/10  ${statusLabel}`);
  }
  L.push('');

  // ── PONTOS FORTES ──
  if (pontosFortes.length > 0) {
    L.push('═══════════════════════════════════════════════');
    L.push('  PONTOS FORTES (o que está funcionando)');
    L.push('═══════════════════════════════════════════════');
    L.push('');
    for (const p of pontosFortes) L.push(`  ✅ ${p}`);
    L.push('');
  }

  // ── GARGALOS ──
  if (gargalos.length > 0) {
    L.push('═══════════════════════════════════════════════');
    L.push('  PRINCIPAIS GARGALOS (o que está travando)');
    L.push('═══════════════════════════════════════════════');
    L.push('');
    for (const g of gargalos) L.push(`  ❌ ${g}`);
    L.push('');
  }

  // ── ERROS CRÍTICOS DA WAR #2 ──
  if (errosDetectados.length > 0) {
    L.push('═══════════════════════════════════════════════');
    L.push('  ERROS DA WAR #2 QUE CONTINUAM ACONTECENDO');
    L.push('═══════════════════════════════════════════════');
    L.push('');
    L.push('  Estes erros foram explicados e treinados na War Room #2,');
    L.push('  mas continuam sendo cometidos pela equipe:');
    L.push('');
    for (const e of errosDetectados) L.push(`  ⚠️ ${e}`);
    if (data.erro_mais_prejudica?.trim()) {
      L.push('');
      L.push(`  ► Erro que mais prejudica: ${data.erro_mais_prejudica.trim()}`);
    }
    L.push('');
  }

  // ── EVOLUÇÃO PÓS WAR #2 ──
  L.push('═══════════════════════════════════════════════');
  L.push('  EVOLUÇÃO REAL APÓS WAR ROOM #2');
  L.push('═══════════════════════════════════════════════');
  L.push('');
  if (melhorou.length > 0) {
    L.push('  ▸ O que evoluiu:');
    for (const m of melhorou) L.push(`    ✅ ${m}`);
    L.push('');
  }
  if (naoMelhorou.length > 0) {
    L.push('  ▸ O que NÃO evoluiu (requer ação imediata):');
    for (const n of naoMelhorou) L.push(`    ❌ ${n}`);
    L.push('');
  }
  if (data.evol_o_que_melhorou?.trim()) {
    L.push(`  ▸ Detalhamento — o que melhorou:`);
    L.push(`    ${data.evol_o_que_melhorou.trim()}`);
    L.push('');
  }
  if (data.evol_o_que_nao_melhorou?.trim()) {
    L.push(`  ▸ Detalhamento — o que não melhorou:`);
    L.push(`    ${data.evol_o_que_nao_melhorou.trim()}`);
    L.push('');
  }

  // ── ANÁLISE DETALHADA POR ÁREA ──
  L.push('═══════════════════════════════════════════════');
  L.push('  ANÁLISE DETALHADA POR ÁREA');
  L.push('═══════════════════════════════════════════════');
  L.push('');

  for (const area of areas) {
    const detail = AREA_DETAIL[area.key];
    if (!detail) continue;

    const statusLabel = area.status === 'saudavel' ? '✅ SAUDÁVEL' : area.status === 'atencao' ? '⚠️ ATENÇÃO' : '🔴 CRÍTICO';
    L.push(`  ┌──────────────────────────────────────────`);
    L.push(`  │ ${area.label.toUpperCase()} — ${area.nota}/10 — ${statusLabel}`);
    L.push(`  └──────────────────────────────────────────`);
    L.push('');
    L.push(`  Por que isso importa:`);
    L.push(`  ${detail.porQue}`);
    L.push('');
    L.push(`  Como resolver:`);
    L.push(`  ${detail.comoResolver}`);
    L.push('');
    L.push(`  Referência War #2:`);
    L.push(`  ${detail.referenciaWar2}`);
    L.push('');

    const recs = area.status === 'critico' ? detail.critico : area.status === 'atencao' ? detail.atencao : detail.saudavel;
    L.push(`  Recomendações específicas:`);
    for (const r of recs) L.push(`    • ${r}`);

    // Campos abertos relevantes
    const areaConfig = PADDOCK_AREAS.find(a => a.key === area.key);
    if (areaConfig?.obsKey) {
      const obs = (data as any)[areaConfig.obsKey] as string;
      if (obs?.trim()) {
        L.push('');
        L.push(`  Observação do consultor:`);
        L.push(`    "${obs.trim()}"`);
      }
    }
    L.push('');
  }

  // ── TOP 3 GARGALOS E AÇÕES ──
  if (data.evol_top3_gargalos?.trim() || data.evol_top3_acoes?.trim()) {
    L.push('═══════════════════════════════════════════════');
    L.push('  TOP 3 GARGALOS E AÇÕES IMEDIATAS');
    L.push('═══════════════════════════════════════════════');
    L.push('');
    if (data.evol_top3_gargalos?.trim()) {
      L.push('  ▸ Os 3 maiores gargalos hoje:');
      L.push(`    ${data.evol_top3_gargalos.trim()}`);
      L.push('');
    }
    if (data.evol_top3_acoes?.trim()) {
      L.push('  ▸ As 3 ações mais urgentes:');
      L.push(`    ${data.evol_top3_acoes.trim()}`);
      L.push('');
    }
  }

  // ── PLANO DE AÇÃO ESTRUTURADO ──
  L.push('═══════════════════════════════════════════════');
  L.push('  PLANO DE AÇÃO ESTRUTURADO');
  L.push('═══════════════════════════════════════════════');
  L.push('');

  // Ações imediatas (48h)
  const acoesImediatas: string[] = [];
  for (const area of criticas) {
    const detail = AREA_DETAIL[area.key];
    if (detail?.critico) acoesImediatas.push(...detail.critico.slice(0, 2));
  }
  if (acoesImediatas.length > 0) {
    L.push('  ▸ AÇÕES IMEDIATAS (próximas 48 horas):');
    for (const a of acoesImediatas) L.push(`    🔴 ${a}`);
    L.push('');
  }

  // Ações de curto prazo (1-2 semanas)
  const acoesCurto: string[] = [];
  for (const area of atencao) {
    const detail = AREA_DETAIL[area.key];
    if (detail?.atencao) acoesCurto.push(...detail.atencao.slice(0, 2));
  }
  if (acoesCurto.length > 0) {
    L.push('  ▸ AÇÕES DE CURTO PRAZO (1-2 semanas):');
    for (const a of acoesCurto) L.push(`    ⚠️ ${a}`);
    L.push('');
  }

  // Ações de escala
  const acoesEscala: string[] = [];
  for (const area of saudaveis) {
    const detail = AREA_DETAIL[area.key];
    if (detail?.saudavel) acoesEscala.push(...detail.saudavel.slice(0, 1));
  }
  if (acoesEscala.length > 0) {
    L.push('  ▸ AÇÕES DE ESCALA E OTIMIZAÇÃO:');
    for (const a of acoesEscala) L.push(`    ✅ ${a}`);
    L.push('');
  }

  // ── PRÓXIMOS PASSOS DETALHADOS ──
  L.push('═══════════════════════════════════════════════');
  L.push('  PRÓXIMOS PASSOS');
  L.push('═══════════════════════════════════════════════');
  L.push('');

  let stepNum = 1;
  if (criticas.length > 0) {
    L.push(`  ${stepNum}. Corrigir imediatamente as áreas críticas: ${criticas.map(a => a.label).join(', ')}`);
    L.push(`     → Prazo: 48 horas para primeiras ações, 7 dias para estabilizar`);
    stepNum++;
  }
  if (naoMelhorou.length > 0) {
    L.push(`  ${stepNum}. Reforçar treinamento nas áreas que não evoluíram: ${naoMelhorou.join(', ')}`);
    L.push(`     → Ação: Roleplay individual + acompanhamento diário do gestor`);
    stepNum++;
  }
  if (errosDetectados.length > 0) {
    L.push(`  ${stepNum}. Eliminar erros recorrentes da War #2 que ainda persistem`);
    L.push(`     → Ação: Revisão individual com cada vendedor sobre os erros identificados`);
    stepNum++;
  }
  if (atencao.length > 0) {
    L.push(`  ${stepNum}. Monitorar evolução das áreas em atenção: ${atencao.map(a => a.label).join(', ')}`);
    L.push(`     → Prazo: Revisar progresso em 7 dias`);
    stepNum++;
  }
  L.push(`  ${stepNum}. Agendar War Room #3 para revisão de progresso`);
  L.push(`     → Prazo: 15 dias a partir de hoje`);
  stepNum++;
  L.push(`  ${stepNum}. Refazer este diagnóstico em 30 dias para medir evolução real`);
  L.push(`     → Comparar scores com este diagnóstico para validar progresso`);
  L.push('');

  // ── OBSERVAÇÕES FINAIS ──
  if (data.observacoes_finais?.trim()) {
    L.push('═══════════════════════════════════════════════');
    L.push('  OBSERVAÇÕES FINAIS DO CONSULTOR');
    L.push('═══════════════════════════════════════════════');
    L.push('');
    L.push(`  ${data.observacoes_finais.trim()}`);
    L.push('');
  }

  L.push('───────────────────────────────────────────────');
  L.push('Documento gerado automaticamente — Millennials Growth B2B');
  L.push('Diagnóstico Comercial Pós War Room #2');

  return L.join('\n');
}

// ── Hooks ──────────────────────────────────────────────────────────
export function useClientPaddockDiagnosticos(clientId: string) {
  return useQuery({
    queryKey: ['paddock-diagnosticos', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paddock_diagnosticos' as any)
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PaddockDiagnosticoRecord[];
    },
    enabled: !!clientId,
  });
}

export function useCreatePaddockDiagnostico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, consultorId, formData }: {
      clientId: string;
      consultorId: string;
      formData: PaddockDiagnosticoFormData;
    }) => {
      const payload: any = {
        client_id: clientId,
        consultor_id: consultorId,
        ...stripToDbFields(formData),
      };

      const { data, error } = await supabase
        .from('paddock_diagnosticos' as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PaddockDiagnosticoRecord;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnosticos', vars.clientId] });
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnostico'] });
      queryClient.invalidateQueries({ queryKey: ['latest-paddock-diagnostico'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-paddock-clients'] });
      toast.success('Diagnóstico comercial criado!');
    },
    onError: () => {
      toast.error('Erro ao criar diagnóstico comercial');
    },
  });
}

export function useUpdatePaddockDiagnostico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ diagnosticoId, clientId, formData }: {
      diagnosticoId: string;
      clientId: string;
      formData: Partial<PaddockDiagnosticoFormData>;
    }) => {
      const payload: any = {
        ...stripToDbFields(formData),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('paddock_diagnosticos' as any)
        .update(payload)
        .eq('id', diagnosticoId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnosticos', vars.clientId] });
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnostico'] });
      queryClient.invalidateQueries({ queryKey: ['latest-paddock-diagnostico'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-paddock-clients'] });
      toast.success('Diagnóstico comercial atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar diagnóstico comercial');
    },
  });
}

/** Backwards-compatible combined create/update hook */
export function useSavePaddockDiagnostico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, consultorId, formData, diagnosticoId }: {
      clientId: string;
      consultorId: string;
      formData: PaddockDiagnosticoFormData;
      diagnosticoId?: string;
    }) => {
      const payload: any = {
        client_id: clientId,
        consultor_id: consultorId,
        ...stripToDbFields(formData),
        updated_at: new Date().toISOString(),
      };

      if (diagnosticoId) {
        const { error } = await supabase
          .from('paddock_diagnosticos' as any)
          .update(payload)
          .eq('id', diagnosticoId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('paddock_diagnosticos' as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnosticos', vars.clientId] });
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnostico'] });
      queryClient.invalidateQueries({ queryKey: ['latest-paddock-diagnostico'] });
      queryClient.invalidateQueries({ queryKey: ['comercial-paddock-clients'] });
      toast.success(vars.diagnosticoId ? 'Diagnóstico atualizado!' : 'Diagnóstico salvo!');
    },
    onError: () => {
      toast.error('Erro ao salvar diagnóstico');
    },
  });
}

export function useDeletePaddockDiagnostico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('paddock_diagnosticos' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnosticos', clientId] });
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnostico'] });
      queryClient.invalidateQueries({ queryKey: ['latest-paddock-diagnostico'] });
      toast.success('Diagnóstico excluído');
    },
    onError: () => {
      toast.error('Erro ao excluir diagnóstico');
    },
  });
}

export function usePublishPaddockDiagnostico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId, publish }: { id: string; clientId: string; publish: boolean }) => {
      const { error } = await supabase
        .from('paddock_diagnosticos' as any)
        .update({ is_published: publish, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { clientId, publish };
    },
    onSuccess: ({ clientId, publish }) => {
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnosticos', clientId] });
      queryClient.invalidateQueries({ queryKey: ['paddock-diagnostico'] });
      toast.success(publish ? 'Diagnóstico publicado!' : 'Diagnóstico despublicado');
    },
    onError: () => {
      toast.error('Erro ao publicar diagnóstico comercial');
    },
  });
}

export function usePublicPaddockDiagnostico(token: string) {
  return useQuery({
    queryKey: ['public-paddock-diagnostico', token],
    queryFn: async () => {
      if (!token) throw new Error('Token não fornecido');

      const { data: report, error } = await supabase
        .from('paddock_diagnosticos' as any)
        .select('*')
        .eq('public_token', token)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      if (!report) throw new Error('Diagnóstico não encontrado');

      return report as unknown as PaddockDiagnosticoRecord;
    },
    enabled: !!token && token.length > 0,
    retry: false,
  });
}
