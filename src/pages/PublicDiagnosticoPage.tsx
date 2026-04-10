import { useParams } from 'react-router-dom';
import { Loader2, FileText } from 'lucide-react';
import {
  usePublicDiagnostico,
  calcAreaScores,
  calcNotaGeral,
  calcPrioridade,
  AREAS,
  type AreaScore,
  type DiagnosticoRecord,
} from '@/hooks/useMktplaceDiagnostico';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

// ── Inverted keys & labels (same as hook) ──
const INVERTED_KEYS = new Set([
  'depende_uma_pessoa', 'cadastro_fraco', 'frete_impacta',
  'ruptura_frequente', 'logistica_prejudica', 'cancelamentos_falha',
  'potencial_mal_aproveitado', 'muitas_reclamacoes',
]);

const QUESTION_LABELS: Record<string, string> = {
  operacao_organizada: 'Operação organizada',
  responsavel_interno: 'Responsável interno',
  responde_rapido: 'Responde rápido às demandas',
  rotina_metricas: 'Rotina de métricas',
  depende_uma_pessoa: 'Não depende de uma só pessoa',
  processo_claro: 'Processos claros',
  titulos_bons: 'Títulos bem elaborados',
  descricoes_boas: 'Descrições persuasivas',
  imagens_profissionais: 'Imagens profissionais',
  padronizacao_visual: 'Padronização visual',
  ficha_tecnica_completa: 'Ficha técnica completa',
  cadastro_fraco: 'Sem cadastros fracos',
  diferenciais_claros: 'Diferenciais competitivos',
  precos_competitivos: 'Preços competitivos',
  entende_margem: 'Entende margem por produto',
  estrategia_precificacao: 'Estratégia de precificação',
  acompanha_concorrentes: 'Acompanha concorrentes',
  frete_impacta: 'Frete sem impacto negativo',
  estoque_sincronizado: 'Estoque sincronizado',
  ruptura_frequente: 'Sem ruptura frequente',
  prazo_envio_bom: 'Prazo de envio adequado',
  logistica_prejudica: 'Logística não prejudica',
  cancelamentos_falha: 'Sem cancelamentos por falha',
  conversao_saudavel: 'Conversão saudável',
  acompanha_metricas_conv: 'Acompanha métricas de conversão',
  produtos_visita_convertem: 'Produtos visitados convertem',
  potencial_mal_aproveitado: 'Potencial bem aproveitado',
  otimizacao_continua: 'Otimização contínua',
  reputacao_saudavel: 'Reputação saudável',
  atendimento_bom: 'Atendimento de qualidade',
  tempo_resposta_adequado: 'Tempo de resposta adequado',
  muitas_reclamacoes: 'Sem excesso de reclamações',
  usa_midia_paga: 'Usa mídia paga',
  midia_estrategica: 'Mídia paga estratégica',
  estrategia_crescimento: 'Estratégia de crescimento',
  priorizacao_potencial: 'Priorização por potencial',
  plano_escalar: 'Plano para escalar',
};

// ── Recommendation generator ──
function buildRecommendations(areas: AreaScore[], diag: DiagnosticoRecord) {
  const imediatas: string[] = [];
  const curtoPrazo: string[] = [];
  const escala: string[] = [];

  for (const area of areas) {
    if (area.status === 'critico') {
      switch (area.key) {
        case 'anuncios':
          imediatas.push('Corrigir anúncios incompletos e revisar títulos e descrições');
          imediatas.push('Melhorar qualidade das imagens dos produtos');
          break;
        case 'estoque':
          imediatas.push('Sincronizar estoque e corrigir rupturas');
          imediatas.push('Ajustar prazos de envio e logística');
          break;
        case 'reputacao':
          imediatas.push('Melhorar tempo de resposta e qualidade do atendimento');
          imediatas.push('Tratar reclamações e devoluções pendentes');
          break;
        case 'estrutura':
          imediatas.push('Organizar a operação e definir responsável interno');
          imediatas.push('Criar processos claros para cadastro, preço e estoque');
          break;
        case 'preco':
          curtoPrazo.push('Revisar precificação e definir estratégia competitiva');
          curtoPrazo.push('Monitorar concorrentes e ajustar posicionamento');
          break;
        case 'conversao':
          curtoPrazo.push('Analisar taxa de conversão e identificar gargalos');
          curtoPrazo.push('Priorizar produtos com maior potencial de vendas');
          break;
        case 'crescimento':
          escala.push('Definir plano de crescimento estruturado');
          escala.push('Avaliar investimento em mídia paga no marketplace');
          break;
      }
    } else if (area.status === 'atencao') {
      switch (area.key) {
        case 'anuncios': curtoPrazo.push('Otimizar anúncios existentes e padronizar cadastro'); break;
        case 'estoque': curtoPrazo.push('Melhorar controle de estoque e logística'); break;
        case 'reputacao': curtoPrazo.push('Fortalecer atendimento e reduzir reclamações'); break;
        case 'estrutura': curtoPrazo.push('Estruturar rotina de acompanhamento de métricas'); break;
        case 'preco': curtoPrazo.push('Refinar estratégia de preço e monitorar margens'); break;
        case 'conversao': escala.push('Implementar otimização contínua de conversão'); break;
        case 'crescimento': escala.push('Desenvolver plano de escala com priorização de SKUs'); break;
      }
    } else {
      escala.push(`Manter e otimizar ${area.label.toLowerCase()}`);
    }
  }
  if (diag.corrigir_imediatamente?.trim()) imediatas.push(diag.corrigir_imediatamente.trim());
  if (diag.melhorar_medio_prazo?.trim()) curtoPrazo.push(diag.melhorar_medio_prazo.trim());
  if (diag.gerar_faturamento_rapido?.trim()) escala.push(diag.gerar_faturamento_rapido.trim());

  return { imediatas, curtoPrazo, escala };
}

function buildNextSteps(areas: AreaScore[], diag: DiagnosticoRecord) {
  const steps: string[] = [];
  const criticas = areas.filter(a => a.status === 'critico');
  const atencao = areas.filter(a => a.status === 'atencao');
  if (criticas.length > 0) steps.push(`Priorizar correção das áreas críticas: ${criticas.map(a => a.label).join(', ')}`);
  if (atencao.length > 0) steps.push(`Acompanhar evolução das áreas em atenção: ${atencao.map(a => a.label).join(', ')}`);
  steps.push('Agendar próximo acompanhamento para revisar progresso');
  if (diag.principais_oportunidades?.trim()) steps.push(`Explorar oportunidades: ${diag.principais_oportunidades.trim()}`);
  steps.push('Revisar diagnóstico em 30 dias para avaliar evolução');
  return steps;
}

// ── Colors ──
const STATUS_COLORS = { saudavel: '#10b981', atencao: '#f59e0b', critico: '#ef4444' };
const BAR_COLORS = (nota: number) => nota >= 8 ? '#10b981' : nota >= 5 ? '#f59e0b' : '#ef4444';

// ── Components ──
function StatusPill({ status }: { status: AreaScore['status'] }) {
  const labels = { saudavel: 'Saudável', atencao: 'Atenção', critico: 'Crítico' };
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: STATUS_COLORS[status] + '20', color: STATUS_COLORS[status] }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
      {labels[status]}
    </span>
  );
}

function PrioridadePill({ p }: { p: string }) {
  const c: Record<string, string> = { Baixa: '#10b981', Média: '#f59e0b', Alta: '#f97316', Urgente: '#ef4444' };
  return (
    <span className="inline-flex items-center text-xs font-bold px-3 py-1 rounded-full" style={{ background: (c[p] || '#888') + '20', color: c[p] || '#888' }}>
      {p}
    </span>
  );
}

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 md:p-8 ${className}`}>
      <h2 className="text-lg font-bold mb-4" style={{ color: '#fbbf24' }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Main Page ──
export default function PublicDiagnosticoPage() {
  const { token } = useParams<{ token: string }>();
  const { data: diag, isLoading, error } = usePublicDiagnostico(token || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (error || !diag) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <FileText className="mx-auto w-12 h-12 text-white/20" />
          <h1 className="text-xl font-bold">Diagnóstico não encontrado</h1>
          <p className="text-white/50 text-sm">Este link pode ter expirado ou o diagnóstico não está disponível.</p>
        </div>
      </div>
    );
  }

  const areas = calcAreaScores(diag);
  const notaGeral = calcNotaGeral(areas);
  const prioridade = calcPrioridade(notaGeral);
  const criticas = areas.filter(a => a.status === 'critico');
  const atencao = areas.filter(a => a.status === 'atencao');

  // Pontos fortes e gargalos
  const pontosFortes: string[] = [];
  const gargalos: string[] = [];
  for (const area of AREAS) {
    for (const q of area.questions) {
      const val = (diag as any)[q] as string | null;
      if (!val) continue;
      const inv = INVERTED_KEYS.has(q);
      const label = QUESTION_LABELS[q] || q;
      if (inv) { val === 'nao' ? pontosFortes.push(label) : gargalos.push(label); }
      else { val === 'sim' ? pontosFortes.push(label) : gargalos.push(label + (val === 'parcialmente' ? ' (parcial)' : '')); }
    }
  }

  // Resumo
  let resumo = '';
  if (criticas.length >= 4) {
    resumo = `A operação de ${diag.cliente_nome || 'o cliente'} no marketplace apresenta falhas estruturais importantes em diversas áreas. Antes de investir em crescimento ou escala, é necessário corrigir a base operacional para garantir sustentabilidade e competitividade.`;
  } else if (criticas.length >= 2 || atencao.length >= 3) {
    resumo = `A operação possui uma base parcialmente estruturada, porém com pontos críticos que limitam o crescimento. Há oportunidades claras de melhoria que, se corrigidas, podem destravar resultados significativos.`;
  } else if (atencao.length >= 1) {
    resumo = `A operação está bem encaminhada, com boa base operacional. Existem pontos de atenção pontuais que podem ser otimizados para acelerar o crescimento e melhorar os resultados.`;
  } else {
    resumo = `A operação está saudável e bem estruturada. O foco agora deve ser em otimização contínua e estratégias de escala para maximizar o faturamento.`;
  }

  const recs = buildRecommendations(areas, diag);
  const nextSteps = buildNextSteps(areas, diag);

  // Chart data
  const radarData = areas.map(a => ({ area: a.label.replace(' e ', '\ne ').replace(' da ', '\nda '), nota: a.nota, fullMark: 10 }));
  const barData = areas.map(a => ({ area: a.label, nota: a.nota }));

  const notaColor = notaGeral >= 8 ? '#10b981' : notaGeral >= 5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(160deg, #0c0a09 0%, #1a1412 50%, #0c0a09 100%)' }}>
      {/* Floating ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-80 h-80 rounded-full blur-3xl animate-pulse" style={{ background: 'rgba(168,85,247,0.06)' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ background: 'rgba(234,179,8,0.05)', animationDelay: '1.5s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 px-6 md:px-12 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-amber-400/70">Millennials Growth • MKT Place</span>
          </div>
          <span className="text-xs text-white/30">{diag.data_consultoria || ''}</span>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 py-10 space-y-8">

        {/* ── Hero ── */}
        <div className="text-center space-y-3 pb-4">
          <p className="text-sm text-amber-400/60 uppercase tracking-widest font-semibold">Diagnóstico de MKT Place</p>
          <h1 className="text-3xl md:text-4xl font-black">{diag.cliente_nome || 'Cliente'}</h1>
          <div className="flex items-center justify-center gap-4 text-sm text-white/50">
            {diag.marketplace_principal && <span>Marketplace: <strong className="text-white/70">{diag.marketplace_principal}</strong></span>}
            {diag.responsavel_diagnostico && <span>Consultor: <strong className="text-white/70">{diag.responsavel_diagnostico}</strong></span>}
          </div>
        </div>

        {/* ── Nota geral + Prioridade ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Nota Geral</p>
            <p className="text-6xl font-black" style={{ color: notaColor }}>{notaGeral}</p>
            <p className="text-xs text-white/30 mt-1">de 10</p>
            <div className="mt-4"><PrioridadePill p={prioridade} /></div>
          </div>

          {/* Radar Chart */}
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Visão geral por área</p>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="area" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
                <Radar name="Nota" dataKey="nota" stroke="#a855f7" fill="#a855f7" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Bar chart — notas por área ── */}
        <Section title="Nota por Área">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} layout="vertical" margin={{ left: 140, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis type="category" dataKey="area" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} width={130} />
              <Tooltip
                contentStyle={{ background: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                formatter={(v: number) => [`${v}/10`, 'Nota']}
              />
              <Bar dataKey="nota" radius={[0, 6, 6, 0]} barSize={20}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={BAR_COLORS(entry.nota)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-4">
            {areas.map(a => (
              <div key={a.key} className="flex items-center gap-2">
                <span className="text-sm text-white/60">{a.label}:</span>
                <span className="text-sm font-bold" style={{ color: STATUS_COLORS[a.status] }}>{a.nota}/10</span>
                <StatusPill status={a.status} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Dados do cliente ── */}
        {(diag.categoria_principal || diag.ticket_medio || diag.faturamento_atual) && (
          <Section title="Dados da Operação">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              {diag.categoria_principal && <div><span className="text-white/40">Categoria:</span> <span className="font-medium">{diag.categoria_principal}</span></div>}
              {diag.ticket_medio && <div><span className="text-white/40">Ticket médio:</span> <span className="font-medium">R$ {Number(diag.ticket_medio).toLocaleString('pt-BR')}</span></div>}
              {diag.quantidade_skus && <div><span className="text-white/40">SKUs:</span> <span className="font-medium">{diag.quantidade_skus}</span></div>}
              {diag.faturamento_atual && <div><span className="text-white/40">Faturamento atual:</span> <span className="font-medium">R$ {Number(diag.faturamento_atual).toLocaleString('pt-BR')}</span></div>}
              {diag.meta_faturamento && <div><span className="text-white/40">Meta:</span> <span className="font-medium">R$ {Number(diag.meta_faturamento).toLocaleString('pt-BR')}</span></div>}
              {diag.outros_marketplaces && <div><span className="text-white/40">Outros marketplaces:</span> <span className="font-medium">{diag.outros_marketplaces}</span></div>}
            </div>
          </Section>
        )}

        {/* ── Resumo Geral ── */}
        <Section title="Resumo Geral">
          <p className="text-sm text-white/70 leading-relaxed">{resumo}</p>
        </Section>

        {/* ── Pontos Fortes ── */}
        {pontosFortes.length > 0 && (
          <Section title="Pontos Fortes Identificados" className="border-emerald-500/20">
            <ul className="space-y-1.5">
              {pontosFortes.map((p, i) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">✓</span> {p}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Gargalos ── */}
        {gargalos.length > 0 && (
          <Section title="Principais Gargalos" className="border-red-500/20">
            <ul className="space-y-1.5">
              {gargalos.map((g, i) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span> {g}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Melhorias Recomendadas ── */}
        {(recs.imediatas.length > 0 || recs.curtoPrazo.length > 0 || recs.escala.length > 0) && (
          <Section title="Melhorias Recomendadas">
            <div className="space-y-5">
              {recs.imediatas.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#ef4444' }}>Ações imediatas</p>
                  <ul className="space-y-1">{recs.imediatas.map((a, i) => <li key={i} className="text-sm text-white/70 flex items-start gap-2"><span className="text-red-400 mt-0.5 shrink-0">▸</span>{a}</li>)}</ul>
                </div>
              )}
              {recs.curtoPrazo.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#f59e0b' }}>Ações de curto prazo</p>
                  <ul className="space-y-1">{recs.curtoPrazo.map((a, i) => <li key={i} className="text-sm text-white/70 flex items-start gap-2"><span className="text-amber-400 mt-0.5 shrink-0">▸</span>{a}</li>)}</ul>
                </div>
              )}
              {recs.escala.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#10b981' }}>Ações de escala</p>
                  <ul className="space-y-1">{recs.escala.map((a, i) => <li key={i} className="text-sm text-white/70 flex items-start gap-2"><span className="text-emerald-400 mt-0.5 shrink-0">▸</span>{a}</li>)}</ul>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Próximos Passos ── */}
        {nextSteps.length > 0 && (
          <Section title="Próximos Passos">
            <ul className="space-y-2">
              {nextSteps.map((s, i) => (
                <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5 shrink-0">➤</span> {s}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Prioridades do consultor ── */}
        {(diag.principais_gargalos || diag.principais_oportunidades || diag.corrigir_imediatamente || diag.melhorar_medio_prazo || diag.gerar_faturamento_rapido) && (
          <Section title="Análise do Consultor">
            <div className="space-y-4 text-sm">
              {diag.principais_gargalos && <div><p className="text-xs font-semibold text-red-400 mb-1">Gargalos identificados:</p><p className="text-white/60">{diag.principais_gargalos}</p></div>}
              {diag.principais_oportunidades && <div><p className="text-xs font-semibold text-purple-400 mb-1">Oportunidades:</p><p className="text-white/60">{diag.principais_oportunidades}</p></div>}
              {diag.gerar_faturamento_rapido && <div><p className="text-xs font-semibold text-emerald-400 mb-1">Gerar faturamento rápido:</p><p className="text-white/60">{diag.gerar_faturamento_rapido}</p></div>}
            </div>
          </Section>
        )}

        {/* ── Observações finais ── */}
        {diag.observacoes_finais && (
          <Section title="Observações Finais">
            <p className="text-sm text-white/60 leading-relaxed">{diag.observacoes_finais}</p>
          </Section>
        )}

        {/* ── Footer ── */}
        <footer className="text-center py-10 border-t border-white/10">
          <p className="text-xs text-white/30">Diagnóstico gerado por <strong className="text-amber-400/50">Millennials Growth Marketing B2B</strong></p>
        </footer>
      </main>
    </div>
  );
}
