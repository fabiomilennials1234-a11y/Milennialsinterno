import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Tipos ──────────────────────────────────────────────────────────
export type Resposta3 = 'sim' | 'parcialmente' | 'nao' | null;
export type Resposta2 = 'sim' | 'nao' | null;

export interface DiagnosticoFormData {
  // Bloco 1
  cliente_nome: string;
  responsavel_diagnostico: string;
  data_consultoria: string;
  marketplace_principal: string;
  outros_marketplaces: string;
  categoria_principal: string;
  ticket_medio: string;
  quantidade_skus: string;
  faturamento_atual: string;
  meta_faturamento: string;
  observacoes_gerais: string;
  // Bloco 2
  operacao_organizada: Resposta3;
  responsavel_interno: Resposta2;
  responde_rapido: Resposta3;
  rotina_metricas: Resposta3;
  depende_uma_pessoa: Resposta2;
  processo_claro: Resposta3;
  obs_estrutura: string;
  // Bloco 3
  titulos_bons: Resposta3;
  descricoes_boas: Resposta3;
  imagens_profissionais: Resposta3;
  padronizacao_visual: Resposta3;
  ficha_tecnica_completa: Resposta3;
  cadastro_fraco: Resposta2;
  diferenciais_claros: Resposta3;
  obs_anuncios: string;
  // Bloco 4
  precos_competitivos: Resposta3;
  entende_margem: Resposta3;
  estrategia_precificacao: Resposta3;
  acompanha_concorrentes: Resposta3;
  frete_impacta: Resposta3;
  obs_preco: string;
  // Bloco 5
  estoque_sincronizado: Resposta3;
  ruptura_frequente: Resposta2;
  prazo_envio_bom: Resposta3;
  logistica_prejudica: Resposta3;
  cancelamentos_falha: Resposta3;
  obs_estoque: string;
  // Bloco 6
  conversao_saudavel: Resposta3;
  acompanha_metricas_conv: Resposta3;
  produtos_visita_convertem: Resposta3;
  potencial_mal_aproveitado: Resposta2;
  otimizacao_continua: Resposta3;
  obs_conversao: string;
  // Bloco 7
  reputacao_saudavel: Resposta3;
  atendimento_bom: Resposta3;
  tempo_resposta_adequado: Resposta3;
  muitas_reclamacoes: Resposta3;
  obs_reputacao: string;
  // Bloco 8
  usa_midia_paga: Resposta2;
  midia_estrategica: Resposta3;
  estrategia_crescimento: Resposta3;
  priorizacao_potencial: Resposta3;
  plano_escalar: Resposta3;
  obs_crescimento: string;
  // Bloco 9
  principais_gargalos: string;
  principais_oportunidades: string;
  corrigir_imediatamente: string;
  melhorar_medio_prazo: string;
  gerar_faturamento_rapido: string;
  observacoes_finais: string;
}

export interface DiagnosticoRecord extends DiagnosticoFormData {
  id: string;
  client_id: string;
  consultor_id: string;
  public_token: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export const EMPTY_FORM: DiagnosticoFormData = {
  cliente_nome: '', responsavel_diagnostico: '', data_consultoria: '',
  marketplace_principal: '', outros_marketplaces: '', categoria_principal: '',
  ticket_medio: '', quantidade_skus: '', faturamento_atual: '',
  meta_faturamento: '', observacoes_gerais: '',
  operacao_organizada: null, responsavel_interno: null, responde_rapido: null,
  rotina_metricas: null, depende_uma_pessoa: null, processo_claro: null, obs_estrutura: '',
  titulos_bons: null, descricoes_boas: null, imagens_profissionais: null,
  padronizacao_visual: null, ficha_tecnica_completa: null, cadastro_fraco: null,
  diferenciais_claros: null, obs_anuncios: '',
  precos_competitivos: null, entende_margem: null, estrategia_precificacao: null,
  acompanha_concorrentes: null, frete_impacta: null, obs_preco: '',
  estoque_sincronizado: null, ruptura_frequente: null, prazo_envio_bom: null,
  logistica_prejudica: null, cancelamentos_falha: null, obs_estoque: '',
  conversao_saudavel: null, acompanha_metricas_conv: null, produtos_visita_convertem: null,
  potencial_mal_aproveitado: null, otimizacao_continua: null, obs_conversao: '',
  reputacao_saudavel: null, atendimento_bom: null, tempo_resposta_adequado: null,
  muitas_reclamacoes: null, obs_reputacao: '',
  usa_midia_paga: null, midia_estrategica: null, estrategia_crescimento: null,
  priorizacao_potencial: null, plano_escalar: null, obs_crescimento: '',
  principais_gargalos: '', principais_oportunidades: '', corrigir_imediatamente: '',
  melhorar_medio_prazo: '', gerar_faturamento_rapido: '', observacoes_finais: '',
};

// ── Perguntas invertidas ───────────────────────────────────────────
// "Sim" = ruim, "Não" = bom
const INVERTED_KEYS = new Set<string>([
  'depende_uma_pessoa',
  'cadastro_fraco',
  'frete_impacta',
  'ruptura_frequente',
  'logistica_prejudica',
  'cancelamentos_falha',
  'potencial_mal_aproveitado',
  'muitas_reclamacoes',
]);

// ── Áreas e suas perguntas ─────────────────────────────────────────
export interface AreaConfig {
  key: string;
  label: string;
  questions: string[];
  obsKey: string;
}

export const AREAS: AreaConfig[] = [
  {
    key: 'estrutura',
    label: 'Estrutura da Operação',
    questions: ['operacao_organizada', 'responsavel_interno', 'responde_rapido', 'rotina_metricas', 'depende_uma_pessoa', 'processo_claro'],
    obsKey: 'obs_estrutura',
  },
  {
    key: 'anuncios',
    label: 'Qualidade dos Anúncios',
    questions: ['titulos_bons', 'descricoes_boas', 'imagens_profissionais', 'padronizacao_visual', 'ficha_tecnica_completa', 'cadastro_fraco', 'diferenciais_claros'],
    obsKey: 'obs_anuncios',
  },
  {
    key: 'preco',
    label: 'Preço e Competitividade',
    questions: ['precos_competitivos', 'entende_margem', 'estrategia_precificacao', 'acompanha_concorrentes', 'frete_impacta'],
    obsKey: 'obs_preco',
  },
  {
    key: 'estoque',
    label: 'Estoque e Logística',
    questions: ['estoque_sincronizado', 'ruptura_frequente', 'prazo_envio_bom', 'logistica_prejudica', 'cancelamentos_falha'],
    obsKey: 'obs_estoque',
  },
  {
    key: 'conversao',
    label: 'Conversão e Performance',
    questions: ['conversao_saudavel', 'acompanha_metricas_conv', 'produtos_visita_convertem', 'potencial_mal_aproveitado', 'otimizacao_continua'],
    obsKey: 'obs_conversao',
  },
  {
    key: 'reputacao',
    label: 'Reputação e Atendimento',
    questions: ['reputacao_saudavel', 'atendimento_bom', 'tempo_resposta_adequado', 'muitas_reclamacoes'],
    obsKey: 'obs_reputacao',
  },
  {
    key: 'crescimento',
    label: 'Crescimento e Escala',
    questions: ['usa_midia_paga', 'midia_estrategica', 'estrategia_crescimento', 'priorizacao_potencial', 'plano_escalar'],
    obsKey: 'obs_crescimento',
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

export interface AreaScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  nota: number; // 0-10
  status: 'saudavel' | 'atencao' | 'critico';
}

export function calcAreaScores(data: DiagnosticoFormData): AreaScore[] {
  return AREAS.map((area) => {
    let total = 0;
    let max = 0;
    for (const q of area.questions) {
      const val = (data as any)[q] as string | null;
      total += scoreAnswer(q, val);
      max += 2;
    }
    const nota = max > 0 ? Math.round((total / max) * 100) / 10 : 0;
    let status: AreaScore['status'] = 'critico';
    if (nota >= 8) status = 'saudavel';
    else if (nota >= 5) status = 'atencao';
    return { key: area.key, label: area.label, score: total, maxScore: max, nota, status };
  });
}

export function calcNotaGeral(areas: AreaScore[]): number {
  if (areas.length === 0) return 0;
  const sum = areas.reduce((s, a) => s + a.nota, 0);
  return Math.round((sum / areas.length) * 10) / 10;
}

export function calcPrioridade(notaGeral: number): string {
  if (notaGeral >= 8) return 'Baixa';
  if (notaGeral >= 6) return 'Média';
  if (notaGeral >= 4) return 'Alta';
  return 'Urgente';
}

// ── Labels das perguntas (para geração do texto) ───────────────────
const QUESTION_LABELS: Record<string, string> = {
  operacao_organizada: 'Operação organizada no marketplace',
  responsavel_interno: 'Responsável interno pela operação',
  responde_rapido: 'Responde rápido às demandas do marketplace',
  rotina_metricas: 'Rotina de acompanhamento de métricas',
  depende_uma_pessoa: 'Operação depende de apenas uma pessoa',
  processo_claro: 'Processo claro para cadastro, preço, estoque e atendimento',
  titulos_bons: 'Títulos dos anúncios bem elaborados',
  descricoes_boas: 'Descrições persuasivas e completas',
  imagens_profissionais: 'Imagens profissionais nos anúncios',
  padronizacao_visual: 'Padronização visual dos anúncios',
  ficha_tecnica_completa: 'Ficha técnica completa dos produtos',
  cadastro_fraco: 'Produtos com cadastro fraco ou incompleto',
  diferenciais_claros: 'Diferenciais competitivos claros nos anúncios',
  precos_competitivos: 'Preços competitivos no marketplace',
  entende_margem: 'Entendimento da margem por produto',
  estrategia_precificacao: 'Estratégia de precificação definida',
  acompanha_concorrentes: 'Acompanhamento dos concorrentes',
  frete_impacta: 'Frete impactando negativamente a conversão',
  estoque_sincronizado: 'Estoque sincronizado corretamente',
  ruptura_frequente: 'Ruptura de estoque frequente',
  prazo_envio_bom: 'Prazo de envio adequado',
  logistica_prejudica: 'Logística prejudicando a reputação',
  cancelamentos_falha: 'Cancelamentos por falha operacional',
  conversao_saudavel: 'Taxa de conversão saudável',
  acompanha_metricas_conv: 'Acompanhamento de visitas, cliques e conversão',
  produtos_visita_convertem: 'Produtos com mais visitas convertem bem',
  potencial_mal_aproveitado: 'Produtos com potencial mal aproveitado',
  otimizacao_continua: 'Estratégia de otimização contínua',
  reputacao_saudavel: 'Reputação da conta saudável',
  atendimento_bom: 'Atendimento ao cliente de qualidade',
  tempo_resposta_adequado: 'Tempo de resposta adequado',
  muitas_reclamacoes: 'Muitas reclamações, devoluções ou avaliações ruins',
  usa_midia_paga: 'Utiliza mídia paga no marketplace',
  midia_estrategica: 'Mídia paga utilizada de forma estratégica',
  estrategia_crescimento: 'Estratégia de crescimento dos produtos principais',
  priorizacao_potencial: 'Priorização dos produtos com mais potencial',
  plano_escalar: 'Plano claro para escalar faturamento',
};

// ── Geração automática do diagnóstico ──────────────────────────────
export function gerarDiagnosticoTexto(data: DiagnosticoFormData): string {
  const areas = calcAreaScores(data);
  const notaGeral = calcNotaGeral(areas);
  const prioridade = calcPrioridade(notaGeral);

  const criticas = areas.filter(a => a.status === 'critico');
  const atencao = areas.filter(a => a.status === 'atencao');
  const saudaveis = areas.filter(a => a.status === 'saudavel');

  // ── Pontos fortes (respostas boas) ──
  const pontosFortes: string[] = [];
  const gargalos: string[] = [];

  for (const area of AREAS) {
    for (const q of area.questions) {
      const val = (data as any)[q] as string | null;
      if (!val) continue;
      const inverted = INVERTED_KEYS.has(q);
      const label = QUESTION_LABELS[q] || q;

      if (inverted) {
        if (val === 'nao') pontosFortes.push(label.replace(/^.*(?:frequente|prejudicando|incompleto|aproveitado|reclamações|impactando).*$/i, '') || label);
        else gargalos.push(label);
      } else {
        if (val === 'sim') pontosFortes.push(label);
        else gargalos.push(label + (val === 'parcialmente' ? ' (parcial)' : ''));
      }
    }
  }

  // ── Resumo geral ──
  let resumo = '';
  if (criticas.length >= 4) {
    resumo = `A operação de ${data.cliente_nome || 'o cliente'} no marketplace apresenta falhas estruturais importantes em diversas áreas. Antes de investir em crescimento ou escala, é necessário corrigir a base operacional para garantir sustentabilidade e competitividade.`;
  } else if (criticas.length >= 2 || atencao.length >= 3) {
    resumo = `A operação de ${data.cliente_nome || 'o cliente'} no marketplace possui uma base parcialmente estruturada, porém com pontos críticos que limitam o crescimento. Há oportunidades claras de melhoria que, se corrigidas, podem destravar resultados significativos.`;
  } else if (atencao.length >= 1) {
    resumo = `A operação de ${data.cliente_nome || 'o cliente'} no marketplace está bem encaminhada, com boa base operacional. Existem pontos de atenção pontuais que podem ser otimizados para acelerar o crescimento e melhorar os resultados.`;
  } else {
    resumo = `A operação de ${data.cliente_nome || 'o cliente'} no marketplace está saudável e bem estruturada. O foco agora deve ser em otimização contínua e estratégias de escala para maximizar o faturamento.`;
  }

  // ── Recomendações ──
  const acoesImediatas: string[] = [];
  const acoesCurtoPrazo: string[] = [];
  const acoesEscala: string[] = [];

  // Gerar recomendações baseadas nas áreas críticas
  for (const area of areas) {
    if (area.status === 'critico') {
      switch (area.key) {
        case 'anuncios':
          acoesImediatas.push('Corrigir anúncios incompletos e revisar títulos e descrições');
          acoesImediatas.push('Melhorar qualidade das imagens dos produtos');
          break;
        case 'estoque':
          acoesImediatas.push('Sincronizar estoque e corrigir rupturas');
          acoesImediatas.push('Ajustar prazos de envio e logística');
          break;
        case 'reputacao':
          acoesImediatas.push('Melhorar tempo de resposta e qualidade do atendimento');
          acoesImediatas.push('Tratar reclamações e devoluções pendentes');
          break;
        case 'estrutura':
          acoesImediatas.push('Organizar a operação e definir responsável interno');
          acoesImediatas.push('Criar processos claros para cadastro, preço e estoque');
          break;
        case 'preco':
          acoesCurtoPrazo.push('Revisar precificação e definir estratégia competitiva');
          acoesCurtoPrazo.push('Monitorar concorrentes e ajustar posicionamento');
          break;
        case 'conversao':
          acoesCurtoPrazo.push('Analisar taxa de conversão e identificar gargalos');
          acoesCurtoPrazo.push('Priorizar produtos com maior potencial de vendas');
          break;
        case 'crescimento':
          acoesEscala.push('Definir plano de crescimento estruturado');
          acoesEscala.push('Avaliar investimento em mídia paga no marketplace');
          break;
      }
    } else if (area.status === 'atencao') {
      switch (area.key) {
        case 'anuncios':
          acoesCurtoPrazo.push('Otimizar anúncios existentes e padronizar cadastro');
          break;
        case 'estoque':
          acoesCurtoPrazo.push('Melhorar controle de estoque e logística');
          break;
        case 'reputacao':
          acoesCurtoPrazo.push('Fortalecer atendimento e reduzir reclamações');
          break;
        case 'estrutura':
          acoesCurtoPrazo.push('Estruturar rotina de acompanhamento de métricas');
          break;
        case 'preco':
          acoesCurtoPrazo.push('Refinar estratégia de preço e monitorar margens');
          break;
        case 'conversao':
          acoesEscala.push('Implementar estratégia de otimização contínua de conversão');
          break;
        case 'crescimento':
          acoesEscala.push('Desenvolver plano de escala com priorização de SKUs');
          break;
      }
    } else {
      acoesEscala.push(`Manter e otimizar ${area.label.toLowerCase()}`);
    }
  }

  // Adicionar campos livres do consultor
  if (data.corrigir_imediatamente?.trim()) {
    acoesImediatas.push(data.corrigir_imediatamente.trim());
  }
  if (data.melhorar_medio_prazo?.trim()) {
    acoesCurtoPrazo.push(data.melhorar_medio_prazo.trim());
  }
  if (data.gerar_faturamento_rapido?.trim()) {
    acoesEscala.push(data.gerar_faturamento_rapido.trim());
  }

  // ── Próximos passos ──
  const proximosPassos: string[] = [];
  if (criticas.length > 0) {
    proximosPassos.push(`Priorizar correção das áreas críticas: ${criticas.map(a => a.label).join(', ')}`);
  }
  if (atencao.length > 0) {
    proximosPassos.push(`Acompanhar evolução das áreas em atenção: ${atencao.map(a => a.label).join(', ')}`);
  }
  proximosPassos.push('Agendar próximo acompanhamento para revisar progresso');
  if (data.principais_oportunidades?.trim()) {
    proximosPassos.push(`Explorar oportunidades identificadas: ${data.principais_oportunidades.trim()}`);
  }
  proximosPassos.push('Revisar diagnóstico em 30 dias para avaliar evolução');

  // ── Montar texto final ──
  const lines: string[] = [];
  lines.push(`DIAGNÓSTICO DE MKT PLACE — ${data.cliente_nome || 'Cliente'}`);
  lines.push(`Data: ${data.data_consultoria || 'Não informada'}`);
  lines.push(`Responsável: ${data.responsavel_diagnostico || 'Não informado'}`);
  lines.push(`Marketplace principal: ${data.marketplace_principal || 'Não informado'}`);
  lines.push(`Nota geral: ${notaGeral}/10`);
  lines.push(`Prioridade: ${prioridade}`);
  lines.push('');

  lines.push('═══ RESUMO GERAL ═══');
  lines.push(resumo);
  lines.push('');

  lines.push('═══ NOTA POR ÁREA ═══');
  for (const a of areas) {
    const statusLabel = a.status === 'saudavel' ? '✅ Saudável' : a.status === 'atencao' ? '⚠️ Atenção' : '🔴 Crítico';
    lines.push(`• ${a.label}: ${a.nota}/10 — ${statusLabel}`);
  }
  lines.push('');

  if (pontosFortes.length > 0) {
    lines.push('═══ PONTOS FORTES ═══');
    for (const p of pontosFortes.slice(0, 10)) lines.push(`✅ ${p}`);
    lines.push('');
  }

  if (gargalos.length > 0) {
    lines.push('═══ PRINCIPAIS GARGALOS ═══');
    for (const g of gargalos.slice(0, 10)) lines.push(`❌ ${g}`);
    lines.push('');
  }

  lines.push('═══ MELHORIAS RECOMENDADAS ═══');
  if (acoesImediatas.length > 0) {
    lines.push('');
    lines.push('▸ Ações imediatas:');
    for (const a of acoesImediatas) lines.push(`  • ${a}`);
  }
  if (acoesCurtoPrazo.length > 0) {
    lines.push('');
    lines.push('▸ Ações de curto prazo:');
    for (const a of acoesCurtoPrazo) lines.push(`  • ${a}`);
  }
  if (acoesEscala.length > 0) {
    lines.push('');
    lines.push('▸ Ações de escala:');
    for (const a of acoesEscala) lines.push(`  • ${a}`);
  }
  lines.push('');

  lines.push('═══ PRÓXIMOS PASSOS ═══');
  for (const p of proximosPassos) lines.push(`➤ ${p}`);

  if (data.observacoes_finais?.trim()) {
    lines.push('');
    lines.push('═══ OBSERVAÇÕES FINAIS DO CONSULTOR ═══');
    lines.push(data.observacoes_finais.trim());
  }

  return lines.join('\n');
}

// ── Hooks ──────────────────────────────────────────────────────────
export function useClientDiagnosticos(clientId: string) {
  return useQuery({
    queryKey: ['mktplace-diagnosticos', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mktplace_diagnosticos' as any)
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DiagnosticoRecord[];
    },
    enabled: !!clientId,
  });
}

export function useSaveDiagnostico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, consultorId, formData, diagnosticoId }: {
      clientId: string;
      consultorId: string;
      formData: DiagnosticoFormData;
      diagnosticoId?: string;
    }) => {
      const payload: any = {
        client_id: clientId,
        consultor_id: consultorId,
        ...formData,
        ticket_medio: formData.ticket_medio ? parseFloat(formData.ticket_medio) : null,
        quantidade_skus: formData.quantidade_skus ? parseInt(formData.quantidade_skus) : null,
        faturamento_atual: formData.faturamento_atual ? parseFloat(formData.faturamento_atual) : null,
        meta_faturamento: formData.meta_faturamento ? parseFloat(formData.meta_faturamento) : null,
        updated_at: new Date().toISOString(),
      };

      if (diagnosticoId) {
        const { error } = await supabase
          .from('mktplace_diagnosticos' as any)
          .update(payload)
          .eq('id', diagnosticoId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('mktplace_diagnosticos' as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['mktplace-diagnosticos', vars.clientId] });
      toast.success(vars.diagnosticoId ? 'Diagnóstico atualizado!' : 'Diagnóstico salvo!');
    },
    onError: () => {
      toast.error('Erro ao salvar diagnóstico');
    },
  });
}

export function useDeleteDiagnostico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('mktplace_diagnosticos' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['mktplace-diagnosticos', clientId] });
      toast.success('Diagnóstico excluído');
    },
    onError: () => {
      toast.error('Erro ao excluir diagnóstico');
    },
  });
}

export function usePublishDiagnostico() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId, publish }: { id: string; clientId: string; publish: boolean }) => {
      const { error } = await supabase
        .from('mktplace_diagnosticos' as any)
        .update({ is_published: publish, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { clientId, publish };
    },
    onSuccess: ({ clientId, publish }) => {
      queryClient.invalidateQueries({ queryKey: ['mktplace-diagnosticos', clientId] });
      toast.success(publish ? 'Diagnóstico publicado!' : 'Diagnóstico despublicado');
    },
    onError: () => {
      toast.error('Erro ao publicar diagnóstico');
    },
  });
}

export function usePublicDiagnostico(token: string) {
  return useQuery({
    queryKey: ['public-diagnostico', token],
    queryFn: async () => {
      if (!token) throw new Error('Token não fornecido');

      const { data: report, error } = await supabase
        .from('mktplace_diagnosticos' as any)
        .select('*')
        .eq('public_token', token)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      if (!report) throw new Error('Diagnóstico não encontrado');

      return report as unknown as DiagnosticoRecord;
    },
    enabled: !!token && token.length > 0,
    retry: false,
  });
}
