import { useParams } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FileText,
  Share2,
  Copy,
  Check,
  AlertCircle,
  TrendingUp,
  Target,
  Lightbulb,
  ArrowRight,
  MessageSquare,
  ClipboardList,
  Activity,
  Package,
  Truck,
  ChevronDown,
  Download,
  Loader2 as Loader2Icon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { generateRelatorioPdf } from '@/lib/generateRelatorioPdf';
import { toast } from 'sonner';
import mgrowthLogo from '@/assets/mgrowth-logo.png';

// ── Types ──

interface RelatorioData {
  id: string;
  client_id: string;
  consultor_id: string;
  report_type: 'consultoria' | 'gestao';
  titulo: string | null;
  resumo: string | null;
  acoes_realizadas: string | null;
  resultados: string | null;
  metricas_chave: string | null;
  pontos_melhoria: string | null;
  proximos_passos: string | null;
  observacoes: string | null;
  feedback_cliente: string | null;
  saude_contas: string | null;
  status_logistica: string | null;
  situacao_estoque: string | null;
  cycle_start_date: string;
  cycle_end_date: string;
  public_token: string | null;
  is_published: boolean | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_razao_social?: string;
  consultor_name?: string;
}

// ── Hook: fetch relatorio by public token ──

function usePublicMktplaceRelatorio(token: string) {
  return useQuery({
    queryKey: ['public-mktplace-relatorio', token],
    queryFn: async (): Promise<RelatorioData | null> => {
      if (!token) return null;

      const { data, error } = await supabase.rpc(
        'get_public_mktplace_relatorio' as never,
        { _token: token } as never,
      );

      if (error) throw error;
      if (!data) return null;

      return data as unknown as RelatorioData;
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ── Utilities ──

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatPeriod(start: string, end: string): string {
  return `${formatDateBR(start)} - ${formatDateBR(end)}`;
}

function reportTypeLabel(type: string): string {
  return type === 'gestao' ? 'Gestão Mensal' : 'Consultoria Mensal';
}

/** Split text by newlines into paragraphs/bullets */
function parseTextContent(text: string | null): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// ── IntersectionObserver hook for fade-in ──

function useFadeIn(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}

// ── Reusable section wrapper with fade-in ──

function Section({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const [ref, visible] = useFadeIn();

  return (
    <div
      ref={ref}
      className={`transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } ${className}`}
      style={delay > 0 ? { transitionDelay: `${Math.min(delay, 200)}ms` } : undefined}
    >
      {children}
    </div>
  );
}

// ── Section heading ──

function SectionHeading({
  icon: Icon,
  label,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          accent ? 'bg-[#FFD600]/15' : 'bg-white/[0.06]'
        }`}
      >
        <Icon
          size={16}
          className={accent ? 'text-[#FFD600]' : 'text-white/50'}
          aria-hidden="true"
        />
      </div>
      <h2
        className="text-[15px] font-semibold text-white/90"
        style={{ letterSpacing: '-0.01em' }}
      >
        {label}
      </h2>
    </div>
  );
}

// ── Glass card ──

function GlassCard({
  children,
  className = '',
  hoverable = false,
}: {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm ${
        hoverable ? 'transition-colors duration-150 hover:bg-white/[0.04]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ── Text list (parses text into bullets) ──

function TextList({
  items,
  bulletColor = 'text-[#FFD600]/70',
}: {
  items: string[];
  bulletColor?: string;
}) {
  if (items.length === 0) return null;

  // Single paragraph
  if (items.length === 1 && items[0].length > 100) {
    return <p className="text-sm text-white/60 leading-relaxed">{items[0]}</p>;
  }

  return (
    <ul className="space-y-2.5" role="list">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-white/60 leading-relaxed">
          <span
            className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${bulletColor} bg-current`}
            aria-hidden="true"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Skeleton loading ──

function LoadingSkeleton() {
  return (
    <div
      className="min-h-screen"
      style={{ background: '#000' }}
      role="status"
      aria-label="Carregando relatório"
    >
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        {/* Hero skeleton */}
        <div className="text-center space-y-4 py-12">
          <Skeleton className="h-6 w-32 mx-auto bg-white/[0.06]" />
          <Skeleton className="h-10 w-64 mx-auto bg-white/[0.06]" />
          <Skeleton className="h-4 w-48 mx-auto bg-white/[0.06]" />
          <Skeleton className="h-3 w-36 mx-auto bg-white/[0.06]" />
        </div>
        {/* Content skeletons */}
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="rounded-2xl border border-white/[0.06] p-6 space-y-3">
            <Skeleton className="h-5 w-40 bg-white/[0.06]" />
            <Skeleton className="h-4 w-full bg-white/[0.06]" />
            <Skeleton className="h-4 w-3/4 bg-white/[0.06]" />
            <Skeleton className="h-4 w-5/6 bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Error / not found state ──

function NotFoundState() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#000' }}
    >
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto">
          <FileText className="w-7 h-7 text-white/20" aria-hidden="true" />
        </div>
        <h1
          className="text-xl font-bold text-white"
          style={{ fontFamily: "'Archivo Black', 'Inter', sans-serif" }}
        >
          Relatório não encontrado
        </h1>
        <p className="text-sm text-white/40 leading-relaxed">
          Este link pode ter expirado ou o relatório não está mais disponível.
          Entre em contato com seu consultor para um novo link.
        </p>
      </div>
    </div>
  );
}

// ── Floating action bar ──

function FloatingActions({ token, contentRef, clientName }: { token: string; contentRef: React.RefObject<HTMLElement | null>; clientName: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const url = `${window.location.origin}/relatorio-mktplace/${token}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [url]);

  const handleWhatsApp = useCallback(() => {
    const text = encodeURIComponent(`Confira o relatório: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  }, [url]);

  const handlePdf = useCallback(async () => {
    if (!contentRef.current) return;
    setGeneratingPdf(true);
    try {
      await generateRelatorioPdf(contentRef.current, clientName);
      toast.success('PDF baixado!');
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingPdf(false);
    }
  }, [contentRef, clientName]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded options */}
      {open && (
        <div className="flex flex-col gap-2 animate-fade-in">
          <button
            onClick={handlePdf}
            disabled={generatingPdf}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFD600]/15 border border-[#FFD600]/25 text-[#FFD600] text-sm font-medium backdrop-blur-md transition-colors duration-150 hover:bg-[#FFD600]/25 focus:outline-none focus:ring-2 focus:ring-[#FFD600]/40 disabled:opacity-50"
            aria-label="Baixar PDF do relatório"
          >
            {generatingPdf ? <Loader2Icon size={14} className="animate-spin" /> : <Download size={14} />}
            {generatingPdf ? 'Gerando...' : 'Baixar PDF'}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.08] border border-white/[0.1] text-white/80 text-sm font-medium backdrop-blur-md transition-colors duration-150 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-[#FFD600]/40"
            aria-label="Copiar link do relatório"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar link'}
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366]/20 border border-[#25D366]/30 text-[#25D366] text-sm font-medium backdrop-blur-md transition-colors duration-150 hover:bg-[#25D366]/30 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
            aria-label="Compartilhar via WhatsApp"
          >
            <Share2 size={14} />
            WhatsApp
          </button>
        </div>
      )}
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFD600]/40 ${
          open
            ? 'bg-white/[0.1] border border-white/[0.15] rotate-45'
            : 'bg-[#FFD600] text-black hover:bg-[#FFD600]/90'
        }`}
        aria-label={open ? 'Fechar opções de compartilhamento' : 'Compartilhar relatório'}
        aria-expanded={open}
      >
        <Share2 size={18} className={open ? 'text-white/70' : ''} />
      </button>
    </div>
  );
}

// ── Main Page ──

export default function PublicMktplaceRelatorioPage() {
  const { token } = useParams<{ token: string }>();
  const { data: relatorio, isLoading, error } = usePublicMktplaceRelatorio(token || '');
  const contentRef = useRef<HTMLDivElement>(null);

  // Load Archivo Black font (only on this page)
  useEffect(() => {
    const linkId = 'archivo-black-font';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // Helmet-style title
  useEffect(() => {
    if (relatorio?.client_name) {
      document.title = `Relatório ${relatorio.client_name} — Milennials Growth B2B`;
    }
    return () => {
      document.title = 'MGrowth Marketing B2B | Sistema de Gestão';
    };
  }, [relatorio?.client_name]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !relatorio) return <NotFoundState />;

  const isGestao = relatorio.report_type === 'gestao';
  const clientDisplay = relatorio.client_name || relatorio.client_razao_social || 'Cliente';

  // Parse text fields
  const resumoLines = parseTextContent(relatorio.resumo);
  const resultadosLines = parseTextContent(relatorio.resultados);
  const metricasLines = parseTextContent(relatorio.metricas_chave);
  const acoesLines = parseTextContent(relatorio.acoes_realizadas);
  const melhoriaLines = parseTextContent(relatorio.pontos_melhoria);
  const proximosLines = parseTextContent(relatorio.proximos_passos);
  const feedbackLines = parseTextContent(relatorio.feedback_cliente);
  const saudeLines = parseTextContent(relatorio.saude_contas);
  const logisticaLines = parseTextContent(relatorio.status_logistica);
  const estoqueLines = parseTextContent(relatorio.situacao_estoque);
  const obsLines = parseTextContent(relatorio.observacoes);

  const hasSections = {
    resumo: resumoLines.length > 0,
    resultados: resultadosLines.length > 0 || metricasLines.length > 0,
    acoes: acoesLines.length > 0,
    melhoria: melhoriaLines.length > 0,
    proximos: proximosLines.length > 0,
    feedback: feedbackLines.length > 0,
    saude: isGestao && saudeLines.length > 0,
    logistica: isGestao && logisticaLines.length > 0,
    estoque: isGestao && estoqueLines.length > 0,
    obs: obsLines.length > 0,
  };

  // Section count for scroll indicator
  const sectionCount = Object.values(hasSections).filter(Boolean).length;

  return (
    <div ref={contentRef} className="min-h-screen text-white" style={{ background: '#000' }}>
      {/* Subtle gradient ambient -- two blurs, brand yellow + warm */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.04]"
          style={{ background: '#FFD600' }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.025]"
          style={{ background: '#FFD600' }}
        />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={mgrowthLogo}
              alt="Milennials Growth B2B"
              className="h-7 w-auto object-contain"
            />
            <div className="h-4 w-px bg-white/10" aria-hidden="true" />
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest">
              MKT Place
            </span>
          </div>
          <span className="text-[11px] text-white/20 tabular-nums">
            {formatDateBR(relatorio.created_at.split('T')[0])}
          </span>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 md:px-10">
        {/* ── Hero / Cover ── */}
        <Section delay={0}>
          <div className="pt-16 pb-12 md:pt-32 md:pb-20 text-center">
            {/* Report type pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD600]/10 border border-[#FFD600]/15 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600]" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-[#FFD600]/80 uppercase tracking-wider">
                {reportTypeLabel(relatorio.report_type)}
              </span>
            </div>

            {/* Client name */}
            <h1
              className="text-3xl md:text-5xl font-black text-white leading-tight"
              style={{ fontFamily: "'Archivo Black', 'Inter', sans-serif", letterSpacing: '-0.03em' }}
            >
              {clientDisplay}
            </h1>

            {/* Title (if provided) */}
            {relatorio.titulo && (
              <p className="text-base md:text-lg text-white/50 mt-3 max-w-2xl mx-auto leading-relaxed">
                {relatorio.titulo}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs text-white/30">
              <span className="tabular-nums">
                {formatPeriod(relatorio.cycle_start_date, relatorio.cycle_end_date)}
              </span>
              {relatorio.consultor_name && (
                <>
                  <span className="hidden sm:inline" aria-hidden="true">
                    /
                  </span>
                  <span>Consultor: {relatorio.consultor_name}</span>
                </>
              )}
            </div>

            {/* Scroll hint */}
            {sectionCount > 2 && (
              <div className="mt-10 flex flex-col items-center gap-1 text-white/15 animate-bounce">
                <ChevronDown size={16} aria-hidden="true" />
              </div>
            )}
          </div>
        </Section>

        <div className="space-y-6 pb-20">
          {/* ── 1. Resumo executivo ── */}
          {hasSections.resumo && (
            <Section delay={60}>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={FileText} label="Resumo executivo" accent />
                <div className="space-y-2">
                  {resumoLines.map((line, i) => (
                    <p key={i} className="text-sm text-white/60 leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* ── 2. Resultados + Metricas ── */}
          {hasSections.resultados && (
            <Section delay={100}>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={TrendingUp} label="Resultados e performance" accent />
                <div className="space-y-6">
                  {resultadosLines.length > 0 && (
                    <div>
                      {resultadosLines.length === 1 && resultadosLines[0].length > 80 ? (
                        <p className="text-sm text-white/60 leading-relaxed">
                          {resultadosLines[0]}
                        </p>
                      ) : (
                        <TextList items={resultadosLines} bulletColor="text-emerald-400/70" />
                      )}
                    </div>
                  )}
                  {metricasLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Métricas-chave
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {metricasLines.map((metric, i) => (
                          <div
                            key={i}
                            className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3"
                          >
                            <p className="text-sm text-white/60">{metric}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* ── 3. Acoes realizadas ── */}
          {hasSections.acoes && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={ClipboardList} label="Ações realizadas" />
                <TextList items={acoesLines} bulletColor="text-blue-400/60" />
              </GlassCard>
            </Section>
          )}

          {/* ── 4. Pontos de melhoria ── */}
          {hasSections.melhoria && (
            <Section>
              <GlassCard className="p-6 md:p-8 border-[#FFD600]/[0.08]">
                <SectionHeading icon={AlertCircle} label="Pontos de melhoria" />
                <TextList items={melhoriaLines} bulletColor="text-[#FFD600]/60" />
              </GlassCard>
            </Section>
          )}

          {/* ── 5. Proximos passos ── */}
          {hasSections.proximos && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={Target} label="Próximos passos" accent />
                <div className="space-y-3">
                  {proximosLines.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-xl bg-white/[0.025] border border-white/[0.04] px-4 py-3.5 transition-colors duration-150 hover:bg-white/[0.04]"
                    >
                      <div className="w-6 h-6 rounded-md bg-[#FFD600]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowRight size={12} className="text-[#FFD600]/70" aria-hidden="true" />
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* ── 6. Feedback do cliente ── */}
          {hasSections.feedback && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={MessageSquare} label="Feedback do cliente" />
                <div className="border-l-2 border-[#FFD600]/20 pl-4">
                  {feedbackLines.map((line, i) => (
                    <p key={i} className="text-sm text-white/50 leading-relaxed italic">
                      {line}
                    </p>
                  ))}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* ── 7. Gestao-only: Saude + Logistica + Estoque ── */}
          {(hasSections.saude || hasSections.logistica || hasSections.estoque) && (
            <Section>
              <div className="space-y-6">
                {/* Section divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
                  <span className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">
                    Gestão operacional
                  </span>
                  <div className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {hasSections.saude && (
                    <GlassCard className="p-5">
                      <SectionHeading icon={Activity} label="Saúde das contas" />
                      <TextList items={saudeLines} bulletColor="text-emerald-400/60" />
                    </GlassCard>
                  )}
                  {hasSections.logistica && (
                    <GlassCard className="p-5">
                      <SectionHeading icon={Truck} label="Logística" />
                      <TextList items={logisticaLines} bulletColor="text-blue-400/60" />
                    </GlassCard>
                  )}
                  {hasSections.estoque && (
                    <GlassCard className="p-5">
                      <SectionHeading icon={Package} label="Estoque" />
                      <TextList items={estoqueLines} bulletColor="text-amber-400/60" />
                    </GlassCard>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* ── 8. Observacoes ── */}
          {hasSections.obs && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={Lightbulb} label="Observações" />
                <div className="space-y-2">
                  {obsLines.map((line, i) => (
                    <p key={i} className="text-sm text-white/50 leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </GlassCard>
            </Section>
          )}
        </div>

        {/* ── Footer ── */}
        <Section>
          <footer className="border-t border-white/[0.06] py-12 text-center space-y-4">
            <img
              src={mgrowthLogo}
              alt="Milennials Growth B2B"
              className="h-8 w-auto mx-auto opacity-40"
            />
            <p className="text-[11px] text-white/20">
              Relatório gerado em {formatDateBR(relatorio.created_at.split('T')[0])}
            </p>
            <p className="text-[10px] text-white/10">
              Milennials Growth B2B — Marketing B2B
            </p>
          </footer>
        </Section>
      </main>

      {/* Floating share */}
      {token && <FloatingActions token={token} contentRef={contentRef} clientName={clientDisplay} />}
    </div>
  );
}
