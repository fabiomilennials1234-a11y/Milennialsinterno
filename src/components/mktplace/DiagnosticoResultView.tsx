import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  DiagnosticoRecord,
  calcAreaScores,
  calcNotaGeral,
  calcPrioridade,
  gerarDiagnosticoTexto,
  AREAS,
  type AreaScore,
} from '@/hooks/useMktplaceDiagnostico';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  diagnostico: DiagnosticoRecord;
}

function StatusBadge({ status }: { status: AreaScore['status'] }) {
  if (status === 'saudavel')
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">Saudável</Badge>;
  if (status === 'atencao')
    return <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">Atenção</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px]">Crítico</Badge>;
}

function NotaBar({ nota }: { nota: number }) {
  const pct = Math.min((nota / 10) * 100, 100);
  const color = nota >= 8 ? 'bg-emerald-500' : nota >= 5 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-10 text-right">{nota}/10</span>
    </div>
  );
}

function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const styles: Record<string, string> = {
    Baixa: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    Média: 'bg-amber-100 text-amber-700 border-amber-300',
    Alta: 'bg-orange-100 text-orange-700 border-orange-300',
    Urgente: 'bg-red-100 text-red-700 border-red-300',
  };
  return <Badge variant="outline" className={`${styles[prioridade] || ''} text-xs`}>{prioridade}</Badge>;
}

// Helper to detect inverted questions
const INVERTED_KEYS = new Set([
  'depende_uma_pessoa', 'cadastro_fraco', 'frete_impacta',
  'ruptura_frequente', 'logistica_prejudica', 'cancelamentos_falha',
  'potencial_mal_aproveitado', 'muitas_reclamacoes',
]);

const QUESTION_LABELS: Record<string, string> = {
  operacao_organizada: 'Operação organizada no marketplace',
  responsavel_interno: 'Responsável interno pela operação',
  responde_rapido: 'Responde rápido às demandas',
  rotina_metricas: 'Rotina de acompanhamento de métricas',
  depende_uma_pessoa: 'Operação depende de apenas uma pessoa',
  processo_claro: 'Processos claros de operação',
  titulos_bons: 'Títulos dos anúncios bem elaborados',
  descricoes_boas: 'Descrições persuasivas e completas',
  imagens_profissionais: 'Imagens profissionais',
  padronizacao_visual: 'Padronização visual dos anúncios',
  ficha_tecnica_completa: 'Ficha técnica completa',
  cadastro_fraco: 'Produtos com cadastro fraco',
  diferenciais_claros: 'Diferenciais competitivos claros',
  precos_competitivos: 'Preços competitivos',
  entende_margem: 'Entendimento da margem por produto',
  estrategia_precificacao: 'Estratégia de precificação',
  acompanha_concorrentes: 'Acompanhamento de concorrentes',
  frete_impacta: 'Frete impactando conversão',
  estoque_sincronizado: 'Estoque sincronizado',
  ruptura_frequente: 'Ruptura de estoque frequente',
  prazo_envio_bom: 'Prazo de envio adequado',
  logistica_prejudica: 'Logística prejudicando reputação',
  cancelamentos_falha: 'Cancelamentos por falha operacional',
  conversao_saudavel: 'Taxa de conversão saudável',
  acompanha_metricas_conv: 'Acompanha visitas e conversão',
  produtos_visita_convertem: 'Produtos com visitas convertem',
  potencial_mal_aproveitado: 'Potencial mal aproveitado',
  otimizacao_continua: 'Otimização contínua',
  reputacao_saudavel: 'Reputação saudável',
  atendimento_bom: 'Atendimento de qualidade',
  tempo_resposta_adequado: 'Tempo de resposta adequado',
  muitas_reclamacoes: 'Muitas reclamações e devoluções',
  usa_midia_paga: 'Utiliza mídia paga',
  midia_estrategica: 'Mídia paga estratégica',
  estrategia_crescimento: 'Estratégia de crescimento',
  priorizacao_potencial: 'Priorização por potencial',
  plano_escalar: 'Plano para escalar faturamento',
};

export default function DiagnosticoResultView({ isOpen, onClose, diagnostico }: Props) {
  const [copied, setCopied] = useState(false);

  const areas = calcAreaScores(diagnostico);
  const notaGeral = calcNotaGeral(areas);
  const prioridade = calcPrioridade(notaGeral);

  // Collect strengths and weaknesses
  const pontosFortes: string[] = [];
  const gargalos: string[] = [];

  for (const area of AREAS) {
    for (const q of area.questions) {
      const val = (diagnostico as any)[q] as string | null;
      if (!val) continue;
      const inverted = INVERTED_KEYS.has(q);
      const label = QUESTION_LABELS[q] || q;
      if (inverted) {
        if (val === 'nao') pontosFortes.push(label);
        else gargalos.push(label);
      } else {
        if (val === 'sim') pontosFortes.push(label);
        else gargalos.push(label + (val === 'parcialmente' ? ' (parcial)' : ''));
      }
    }
  }

  // Resumo geral
  const criticas = areas.filter(a => a.status === 'critico');
  const atencao = areas.filter(a => a.status === 'atencao');
  let resumo = '';
  if (criticas.length >= 4) {
    resumo = `A operação de ${diagnostico.cliente_nome || 'o cliente'} no marketplace apresenta falhas estruturais importantes em diversas áreas. Antes de investir em crescimento ou escala, é necessário corrigir a base operacional para garantir sustentabilidade e competitividade.`;
  } else if (criticas.length >= 2 || atencao.length >= 3) {
    resumo = `A operação de ${diagnostico.cliente_nome || 'o cliente'} no marketplace possui uma base parcialmente estruturada, porém com pontos críticos que limitam o crescimento. Há oportunidades claras de melhoria que, se corrigidas, podem destravar resultados significativos.`;
  } else if (atencao.length >= 1) {
    resumo = `A operação de ${diagnostico.cliente_nome || 'o cliente'} no marketplace está bem encaminhada, com boa base operacional. Existem pontos de atenção pontuais que podem ser otimizados para acelerar o crescimento e melhorar os resultados.`;
  } else {
    resumo = `A operação de ${diagnostico.cliente_nome || 'o cliente'} no marketplace está saudável e bem estruturada. O foco agora deve ser em otimização contínua e estratégias de escala para maximizar o faturamento.`;
  }

  // ── Melhorias Recomendadas (auto-geradas por área) ──
  const acoesImediatas: string[] = [];
  const acoesCurtoPrazo: string[] = [];
  const acoesEscala: string[] = [];

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

  if (diagnostico.corrigir_imediatamente?.trim()) {
    acoesImediatas.push(diagnostico.corrigir_imediatamente.trim());
  }
  if (diagnostico.melhorar_medio_prazo?.trim()) {
    acoesCurtoPrazo.push(diagnostico.melhorar_medio_prazo.trim());
  }
  if (diagnostico.gerar_faturamento_rapido?.trim()) {
    acoesEscala.push(diagnostico.gerar_faturamento_rapido.trim());
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
  if (diagnostico.principais_oportunidades?.trim()) {
    proximosPassos.push(`Explorar oportunidades identificadas: ${diagnostico.principais_oportunidades.trim()}`);
  }
  proximosPassos.push('Revisar diagnóstico em 30 dias para avaliar evolução');

  const handleCopy = async () => {
    const texto = gerarDiagnosticoTexto(diagnostico);
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      toast.success('Diagnóstico copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const notaColor = notaGeral >= 8 ? 'text-emerald-600' : notaGeral >= 5 ? 'text-amber-600' : 'text-red-600';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] p-0 !grid-rows-[auto_1fr] overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Diagnóstico de MKT Place</DialogTitle>
                <p className="text-sm text-muted-foreground">{diagnostico.cliente_nome}</p>
              </div>
            </div>
            <Button onClick={handleCopy} variant="outline" className="gap-2">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar Diagnóstico'}
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 px-6 py-4">
          <div className="space-y-6 pb-6">
            {/* ── Info Header ── */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{diagnostico.data_consultoria || '—'}</span></div>
              <div><span className="text-muted-foreground">Responsável:</span> <span className="font-medium">{diagnostico.responsavel_diagnostico || '—'}</span></div>
              <div><span className="text-muted-foreground">Marketplace:</span> <span className="font-medium">{diagnostico.marketplace_principal || '—'}</span></div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Prioridade:</span>
                <PrioridadeBadge prioridade={prioridade} />
              </div>
            </div>

            {/* ── Dados do cliente ── */}
            <div className="bg-muted/30 rounded-xl border border-border p-5">
              <h4 className="text-sm font-bold text-foreground mb-3">Dados do Cliente</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {diagnostico.categoria_principal && (
                  <div><span className="text-muted-foreground">Categoria:</span> <span className="font-medium">{diagnostico.categoria_principal}</span></div>
                )}
                {diagnostico.ticket_medio && (
                  <div><span className="text-muted-foreground">Ticket médio:</span> <span className="font-medium">R$ {Number(diagnostico.ticket_medio).toLocaleString('pt-BR')}</span></div>
                )}
                {diagnostico.quantidade_skus && (
                  <div><span className="text-muted-foreground">SKUs:</span> <span className="font-medium">{diagnostico.quantidade_skus}</span></div>
                )}
                {diagnostico.faturamento_atual && (
                  <div><span className="text-muted-foreground">Faturamento atual:</span> <span className="font-medium">R$ {Number(diagnostico.faturamento_atual).toLocaleString('pt-BR')}</span></div>
                )}
                {diagnostico.meta_faturamento && (
                  <div><span className="text-muted-foreground">Meta:</span> <span className="font-medium">R$ {Number(diagnostico.meta_faturamento).toLocaleString('pt-BR')}</span></div>
                )}
                {diagnostico.outros_marketplaces && (
                  <div><span className="text-muted-foreground">Outros mkts:</span> <span className="font-medium">{diagnostico.outros_marketplaces}</span></div>
                )}
              </div>
              {diagnostico.observacoes_gerais && (
                <p className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">{diagnostico.observacoes_gerais}</p>
              )}
            </div>

            {/* ── Nota geral ── */}
            <div className="bg-muted/40 rounded-xl border border-border p-5 text-center">
              <p className="text-sm text-muted-foreground mb-1">Nota Geral</p>
              <p className={`text-4xl font-black ${notaColor}`}>{notaGeral}</p>
              <p className="text-xs text-muted-foreground mt-1">de 10</p>
            </div>

            {/* ── Notas por área ── */}
            <div className="bg-muted/30 rounded-xl border border-border p-5 space-y-3">
              <h4 className="text-sm font-bold text-foreground">Nota por Área</h4>
              {areas.map((a) => {
                const areaConfig = AREAS.find(ac => ac.key === a.key);
                const obs = areaConfig ? (diagnostico as any)[areaConfig.obsKey] : null;
                return (
                  <div key={a.key}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm w-48 shrink-0">{a.label}</span>
                      <NotaBar nota={a.nota} />
                      <StatusBadge status={a.status} />
                    </div>
                    {obs && (
                      <p className="text-xs text-muted-foreground ml-48 pl-3 mt-1 italic">{obs}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Resumo Geral ── */}
            <div className="bg-muted/30 rounded-xl border border-border p-5 space-y-2">
              <h4 className="text-sm font-bold text-foreground">Resumo Geral</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{resumo}</p>
            </div>

            {/* ── Pontos Fortes ── */}
            {pontosFortes.length > 0 && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-5 space-y-2">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Pontos Fortes Identificados</h4>
                <ul className="space-y-1">
                  {pontosFortes.map((p, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">✓</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Gargalos ── */}
            {gargalos.length > 0 && (
              <div className="bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800 p-5 space-y-2">
                <h4 className="text-sm font-bold text-red-700 dark:text-red-400">Principais Gargalos</h4>
                <ul className="space-y-1">
                  {gargalos.map((g, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">✗</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Melhorias Recomendadas ── */}
            {(acoesImediatas.length > 0 || acoesCurtoPrazo.length > 0 || acoesEscala.length > 0) && (
              <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5 space-y-4">
                <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400">Melhorias Recomendadas</h4>

                {acoesImediatas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-600 mb-2">Ações imediatas</p>
                    <ul className="space-y-1">
                      {acoesImediatas.map((a, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-red-500 mt-0.5 shrink-0">▸</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {acoesCurtoPrazo.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-2">Ações de curto prazo</p>
                    <ul className="space-y-1">
                      {acoesCurtoPrazo.map((a, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5 shrink-0">▸</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {acoesEscala.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 mb-2">Ações de escala</p>
                    <ul className="space-y-1">
                      {acoesEscala.map((a, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5 shrink-0">▸</span> {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Próximos Passos ── */}
            {proximosPassos.length > 0 && (
              <div className="bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800 p-5 space-y-2">
                <h4 className="text-sm font-bold text-purple-700 dark:text-purple-400">Próximos Passos</h4>
                <ul className="space-y-1">
                  {proximosPassos.map((p, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-purple-500 mt-0.5 shrink-0">➤</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Prioridades do consultor ── */}
            {(diagnostico.principais_gargalos || diagnostico.principais_oportunidades || diagnostico.corrigir_imediatamente || diagnostico.melhorar_medio_prazo || diagnostico.gerar_faturamento_rapido) && (
              <div className="bg-muted/30 rounded-xl border border-border p-5 space-y-3">
                <h4 className="text-sm font-bold text-foreground">Prioridades do Consultor</h4>
                {diagnostico.corrigir_imediatamente && (
                  <div>
                    <p className="text-xs font-semibold text-red-600 mb-1">Corrigir imediatamente:</p>
                    <p className="text-sm text-muted-foreground">{diagnostico.corrigir_imediatamente}</p>
                  </div>
                )}
                {diagnostico.melhorar_medio_prazo && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-1">Melhorar no médio prazo:</p>
                    <p className="text-sm text-muted-foreground">{diagnostico.melhorar_medio_prazo}</p>
                  </div>
                )}
                {diagnostico.gerar_faturamento_rapido && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 mb-1">Gerar faturamento rápido:</p>
                    <p className="text-sm text-muted-foreground">{diagnostico.gerar_faturamento_rapido}</p>
                  </div>
                )}
                {diagnostico.principais_oportunidades && (
                  <div>
                    <p className="text-xs font-semibold text-purple-600 mb-1">Oportunidades:</p>
                    <p className="text-sm text-muted-foreground">{diagnostico.principais_oportunidades}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Observações finais ── */}
            {diagnostico.observacoes_finais && (
              <div className="bg-muted/30 rounded-xl border border-border p-5 space-y-2">
                <h4 className="text-sm font-bold text-foreground">Observações Finais</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{diagnostico.observacoes_finais}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
