import { useParams } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FileText,
  Share2,
  Copy,
  Check,
  TrendingUp,
  Target,
  Calendar,
  Package,
  ChevronDown,
  Download,
  Loader2 as Loader2Icon,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Megaphone,
  ShieldCheck,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { generateRelatorioPdf } from '@/lib/generateRelatorioPdf';
import { toast } from 'sonner';
import mgrowthLogo from '@/assets/mgrowth-logo.png';

// ── Types ──

interface MarketplaceEntry {
  marketplace: string;
  faturamento: number;
  pedidos: number;
  reputacao: string;
  ticket_medio?: number;
}

interface Top5SkuEntry {
  posicao: number;
  sku: string;
  faturamento: number;
  quantidade: number;
}

interface CycleReportData {
  id: string;
  client_id: string;
  consultor_id: string;
  report_type: 'consultoria' | 'gestao';
  report_number: number;
  cycle_start_date: string;
  cycle_end_date: string;
  reuniao_realizada: boolean;
  reuniao_data: string | null;
  reuniao_horario: string | null;
  marketplace_data: MarketplaceEntry[] | null;
  cumprimento_plano: 'tudo' | 'parcial' | 'nao' | null;
  cumprimento_detalhamento: string | null;
  dificuldades: string | null;
  top5_skus: Top5SkuEntry[] | null;
  plano_proximo_ciclo: string | null;
  proxima_reuniao_data: string | null;
  proxima_reuniao_horario: string | null;
  skus_cadastrados_otimizados: string | null;
  skus_problematicos: string | null;
  acoes_executadas: string | null;
  verba_ads: number | null;
  acos_medio: number | null;
  tacos_medio: number | null;
  rms_abertas: number | null;
  rms_resolvidas: number | null;
  rms_em_aberto: number | null;
  plano_proximos_dias: string | null;
  variacao_faturamento_pct: number | null;
  variacao_pedidos_pct: number | null;
  public_token: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_razao_social: string | null;
  consultor_name: string | null;
}

// ── Hook: fetch cycle report by public token ──

function usePublicCycleReport(token: string) {
  return useQuery({
    queryKey: ['public-cycle-report', token],
    queryFn: async (): Promise<CycleReportData | null> => {
      if (!token) return null;

      const { data, error } = await supabase.rpc(
        'get_public_mktplace_cycle_report' as never,
        { p_token: token } as never,
      );

      if (error) throw error;
      if (!data) return null;

      return data as unknown as CycleReportData;
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
  return type === 'gestao' ? 'Gestao' : 'Consultoria';
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

// ── Text list ──

function TextList({
  items,
  bulletColor = 'text-[#FFD600]/70',
}: {
  items: string[];
  bulletColor?: string;
}) {
  if (items.length === 0) return null;

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

// ── Cumprimento badge ──

function CumprimentoBadge({ value }: { value: 'tudo' | 'parcial' | 'nao' }) {
  const config = {
    tudo: { icon: CheckCircle2, label: 'Cumprido integralmente', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
    parcial: { icon: AlertTriangle, label: 'Cumprido parcialmente', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
    nao: { icon: XCircle, label: 'Nao cumprido', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
  }[value];

  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg}`}>
      <Icon size={14} className={config.color} />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}

// ── Variation indicator ──

function VariationIndicator({ label, value }: { label: string; value: number }) {
  const isPositive = value > 0;
  const isZero = value === 0;
  const color = isZero ? 'text-white/40' : isPositive ? 'text-emerald-400' : 'text-red-400';
  const bg = isZero ? 'bg-white/[0.03]' : isPositive ? 'bg-emerald-400/5' : 'bg-red-400/5';

  return (
    <div className={`rounded-xl border border-white/[0.06] ${bg} px-4 py-3`}>
      <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{formatPercent(value)}</p>
    </div>
  );
}

// ── Skeleton loading ──

function LoadingSkeleton() {
  return (
    <div
      className="min-h-screen"
      style={{ background: '#000' }}
      role="status"
      aria-label="Carregando relatorio"
    >
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-4 py-12">
          <Skeleton className="h-6 w-32 mx-auto bg-white/[0.06]" />
          <Skeleton className="h-10 w-64 mx-auto bg-white/[0.06]" />
          <Skeleton className="h-4 w-48 mx-auto bg-white/[0.06]" />
          <Skeleton className="h-3 w-36 mx-auto bg-white/[0.06]" />
        </div>
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
          Relatorio nao encontrado
        </h1>
        <p className="text-sm text-white/40 leading-relaxed">
          Este link pode ter expirado ou o relatorio nao esta mais disponivel.
          Entre em contato com seu consultor para um novo link.
        </p>
      </div>
    </div>
  );
}

// ── Floating action bar ──

function FloatingActions({
  token,
  contentRef,
  clientName,
}: {
  token: string;
  contentRef: React.RefObject<HTMLElement | null>;
  clientName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const url = `${window.location.origin}/relatorio-ciclo/${token}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
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
      {open && (
        <div className="flex flex-col gap-2 animate-fade-in">
          <button
            onClick={handlePdf}
            disabled={generatingPdf}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFD600]/15 border border-[#FFD600]/25 text-[#FFD600] text-sm font-medium backdrop-blur-md transition-colors duration-150 hover:bg-[#FFD600]/25 focus:outline-none focus:ring-2 focus:ring-[#FFD600]/40 disabled:opacity-50"
            aria-label="Baixar PDF do relatorio"
          >
            {generatingPdf ? (
              <Loader2Icon size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {generatingPdf ? 'Gerando...' : 'Baixar PDF'}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.08] border border-white/[0.1] text-white/80 text-sm font-medium backdrop-blur-md transition-colors duration-150 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-[#FFD600]/40"
            aria-label="Copiar link do relatorio"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar link'}
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFD600]/40 ${
          open
            ? 'bg-white/[0.1] border border-white/[0.15] rotate-45'
            : 'bg-[#FFD600] text-black hover:bg-[#FFD600]/90'
        }`}
        aria-label={open ? 'Fechar opcoes' : 'Opcoes do relatorio'}
        aria-expanded={open}
      >
        <Share2 size={18} className={open ? 'text-white/70' : ''} />
      </button>
    </div>
  );
}

// ── Marketplace data table ──

function MarketplaceTable({ data }: { data: MarketplaceEntry[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
              Marketplace
            </th>
            <th className="text-right py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
              Faturamento
            </th>
            <th className="text-right py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
              Pedidos
            </th>
            <th className="text-center py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
              Reputacao
            </th>
            <th className="text-right py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
              Ticket Medio
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, i) => (
            <tr
              key={i}
              className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
            >
              <td className="py-3 px-4 text-white/70 font-medium">{entry.marketplace}</td>
              <td className="py-3 px-4 text-right text-white/60 tabular-nums">
                {formatCurrency(entry.faturamento)}
              </td>
              <td className="py-3 px-4 text-right text-white/60 tabular-nums">
                {formatNumber(entry.pedidos)}
              </td>
              <td className="py-3 px-4 text-center">
                <ReputacaoBadge value={entry.reputacao} />
              </td>
              <td className="py-3 px-4 text-right text-white/60 tabular-nums">
                {entry.ticket_medio != null ? formatCurrency(entry.ticket_medio) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReputacaoBadge({ value }: { value: string }) {
  const lower = value?.toLowerCase() || '';
  const colorMap: Record<string, string> = {
    verde: 'text-emerald-400 bg-emerald-400/10',
    amarelo: 'text-amber-400 bg-amber-400/10',
    amarela: 'text-amber-400 bg-amber-400/10',
    vermelho: 'text-red-400 bg-red-400/10',
    vermelha: 'text-red-400 bg-red-400/10',
    laranja: 'text-orange-400 bg-orange-400/10',
  };
  const color = colorMap[lower] || 'text-white/50 bg-white/[0.05]';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${color}`}>
      {value}
    </span>
  );
}

// ── Top 5 SKUs table ──

function Top5SkusTable({ data }: { data: Top5SkuEntry[] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-center py-3 px-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider w-10">
              #
            </th>
            <th className="text-left py-3 px-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
              SKU
            </th>
            <th className="text-right py-3 px-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
              Faturamento
            </th>
            <th className="text-right py-3 px-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
              Quantidade
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr
              key={entry.posicao}
              className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
            >
              <td className="py-3 px-3 text-center">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#FFD600]/10 text-[#FFD600] text-xs font-bold">
                  {entry.posicao}
                </span>
              </td>
              <td className="py-3 px-3 text-white/70 font-medium font-mono text-xs">
                {entry.sku}
              </td>
              <td className="py-3 px-3 text-right text-white/60 tabular-nums">
                {formatCurrency(entry.faturamento)}
              </td>
              <td className="py-3 px-3 text-right text-white/60 tabular-nums">
                {formatNumber(entry.quantidade)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Stat card ──

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3">
      <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-white/80 tabular-nums">
        {value}
        {unit && <span className="text-xs font-normal text-white/40 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

// ── Main Page ──

export default function PublicCycleReportPage() {
  const { token } = useParams<{ token: string }>();
  const { data: report, isLoading, error } = usePublicCycleReport(token || '');
  const contentRef = useRef<HTMLDivElement>(null);

  // Load Archivo Black font
  useEffect(() => {
    const linkId = 'archivo-black-font';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // Page title
  useEffect(() => {
    if (report?.client_name) {
      document.title = `Relatorio Ciclo #${report.report_number} — ${report.client_name}`;
    }
    return () => {
      document.title = 'MGrowth Marketing B2B | Sistema de Gestao';
    };
  }, [report?.client_name, report?.report_number]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !report) return <NotFoundState />;

  const isGestao = report.report_type === 'gestao';
  const clientDisplay = report.client_name || 'Cliente';

  // Parse text fields
  const dificuldadesLines = parseTextContent(report.dificuldades);
  const cumprimentoLines = parseTextContent(report.cumprimento_detalhamento);
  const planoProximoLines = parseTextContent(report.plano_proximo_ciclo);
  const acoesLines = parseTextContent(report.acoes_executadas);
  const skusCadastradosLines = parseTextContent(report.skus_cadastrados_otimizados);
  const skusProblematicosLines = parseTextContent(report.skus_problematicos);
  const planoProximosDiasLines = parseTextContent(report.plano_proximos_dias);

  const hasMarketplace = report.marketplace_data && report.marketplace_data.length > 0;
  const hasTop5 = report.top5_skus && report.top5_skus.length > 0;
  const hasVariations =
    report.variacao_faturamento_pct != null || report.variacao_pedidos_pct != null;
  const hasAds =
    isGestao &&
    (report.verba_ads != null || report.acos_medio != null || report.tacos_medio != null);
  const hasRMs =
    isGestao &&
    (report.rms_abertas != null || report.rms_resolvidas != null || report.rms_em_aberto != null);

  const sectionCount = [
    true, // identification always
    hasMarketplace || hasVariations,
    acoesLines.length > 0 || skusCadastradosLines.length > 0,
    report.cumprimento_plano || dificuldadesLines.length > 0,
    planoProximoLines.length > 0 || report.proxima_reuniao_data,
    hasAds,
    hasRMs || skusProblematicosLines.length > 0,
  ].filter(Boolean).length;

  return (
    <div ref={contentRef} className="min-h-screen text-white" style={{ background: '#000' }}>
      {/* Ambient gradient */}
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

      {/* Header */}
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
              Relatorio de Ciclo
            </span>
          </div>
          <span className="text-[11px] text-white/20 tabular-nums">
            {formatDateBR(report.created_at.split('T')[0])}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 md:px-10">
        {/* Hero */}
        <Section delay={0}>
          <div className="pt-16 pb-12 md:pt-32 md:pb-20 text-center">
            {/* Report type + number pills */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD600]/10 border border-[#FFD600]/15">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600]" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-[#FFD600]/80 uppercase tracking-wider">
                  {reportTypeLabel(report.report_type)}
                </span>
              </div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                  Ciclo #{report.report_number}
                </span>
              </div>
            </div>

            {/* Client name */}
            <h1
              className="text-3xl md:text-5xl font-black text-white leading-tight"
              style={{
                fontFamily: "'Archivo Black', 'Inter', sans-serif",
                letterSpacing: '-0.03em',
              }}
            >
              {clientDisplay}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs text-white/30">
              <span className="tabular-nums">
                {formatPeriod(report.cycle_start_date, report.cycle_end_date)}
              </span>
              {report.consultor_name && (
                <>
                  <span className="hidden sm:inline" aria-hidden="true">
                    /
                  </span>
                  <span>Consultor: {report.consultor_name}</span>
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
          {/* 1. Identificacao / Reuniao */}
          <Section delay={60}>
            <GlassCard className="p-6 md:p-8">
              <SectionHeading icon={Calendar} label="Identificacao do ciclo" accent />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3">
                  <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1">
                    Reuniao
                  </p>
                  <p className="text-sm text-white/70">
                    {report.reuniao_realizada ? (
                      <>
                        <span className="text-emerald-400 font-medium">Realizada</span>
                        {report.reuniao_data && (
                          <span className="text-white/40">
                            {' '}
                            — {formatDateBR(report.reuniao_data)}
                            {report.reuniao_horario && ` as ${report.reuniao_horario}`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-white/40">Nao realizada</span>
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3">
                  <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1">
                    Periodo
                  </p>
                  <p className="text-sm text-white/70 tabular-nums">
                    {formatPeriod(report.cycle_start_date, report.cycle_end_date)}
                  </p>
                </div>
              </div>
            </GlassCard>
          </Section>

          {/* 2. Performance — marketplace data + variations */}
          {(hasMarketplace || hasVariations) && (
            <Section delay={100}>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={TrendingUp} label="Performance de marketplace" accent />

                {/* Variation indicators */}
                {hasVariations && (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {report.variacao_faturamento_pct != null && (
                      <VariationIndicator
                        label="Var. faturamento"
                        value={report.variacao_faturamento_pct}
                      />
                    )}
                    {report.variacao_pedidos_pct != null && (
                      <VariationIndicator
                        label="Var. pedidos"
                        value={report.variacao_pedidos_pct}
                      />
                    )}
                  </div>
                )}

                {/* Marketplace table */}
                {hasMarketplace && <MarketplaceTable data={report.marketplace_data!} />}
              </GlassCard>
            </Section>
          )}

          {/* 3. Top 5 SKUs */}
          {hasTop5 && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={Package} label="Top 5 SKUs" />
                <Top5SkusTable data={report.top5_skus!} />
              </GlassCard>
            </Section>
          )}

          {/* 4. Execucao — acoes + SKUs cadastrados */}
          {(acoesLines.length > 0 || skusCadastradosLines.length > 0) && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={ClipboardList} label="Execucao do ciclo" />
                <div className="space-y-5">
                  {acoesLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Acoes executadas
                      </p>
                      <TextList items={acoesLines} bulletColor="text-blue-400/60" />
                    </div>
                  )}
                  {skusCadastradosLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        SKUs cadastrados / otimizados
                      </p>
                      <TextList items={skusCadastradosLines} bulletColor="text-emerald-400/60" />
                    </div>
                  )}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* 5. Cumprimento do plano + dificuldades */}
          {(report.cumprimento_plano || dificuldadesLines.length > 0) && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={Target} label="Cumprimento do plano" />
                <div className="space-y-5">
                  {report.cumprimento_plano && (
                    <div>
                      <CumprimentoBadge value={report.cumprimento_plano} />
                      {cumprimentoLines.length > 0 && (
                        <div className="mt-4">
                          <TextList items={cumprimentoLines} bulletColor="text-white/30" />
                        </div>
                      )}
                    </div>
                  )}
                  {dificuldadesLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Dificuldades encontradas
                      </p>
                      <TextList items={dificuldadesLines} bulletColor="text-red-400/50" />
                    </div>
                  )}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* 6. Proximo ciclo */}
          {(planoProximoLines.length > 0 || report.proxima_reuniao_data) && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={ArrowRight} label="Proximo ciclo" accent />
                <div className="space-y-5">
                  {planoProximoLines.length > 0 && (
                    <div className="space-y-3">
                      {planoProximoLines.map((step, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-xl bg-white/[0.025] border border-white/[0.04] px-4 py-3.5 transition-colors duration-150 hover:bg-white/[0.04]"
                        >
                          <div className="w-6 h-6 rounded-md bg-[#FFD600]/10 flex items-center justify-center shrink-0 mt-0.5">
                            <ArrowRight
                              size={12}
                              className="text-[#FFD600]/70"
                              aria-hidden="true"
                            />
                          </div>
                          <p className="text-sm text-white/60 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {report.proxima_reuniao_data && (
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3">
                      <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-1">
                        Proxima reuniao
                      </p>
                      <p className="text-sm text-white/70 tabular-nums">
                        {formatDateBR(report.proxima_reuniao_data)}
                        {report.proxima_reuniao_horario &&
                          ` as ${report.proxima_reuniao_horario}`}
                      </p>
                    </div>
                  )}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* 7. Ads — gestao only */}
          {hasAds && (
            <Section>
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
                  <span className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">
                    Gestao de Ads
                  </span>
                  <div className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
                </div>
                <GlassCard className="p-6 md:p-8">
                  <SectionHeading icon={Megaphone} label="Metricas de Ads" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {report.verba_ads != null && (
                      <StatCard label="Verba Ads" value={formatCurrency(report.verba_ads)} />
                    )}
                    {report.acos_medio != null && (
                      <StatCard label="ACoS medio" value={report.acos_medio.toFixed(1)} unit="%" />
                    )}
                    {report.tacos_medio != null && (
                      <StatCard
                        label="TACoS medio"
                        value={report.tacos_medio.toFixed(1)}
                        unit="%"
                      />
                    )}
                  </div>
                </GlassCard>
              </div>
            </Section>
          )}

          {/* 8. Qualidade — gestao only (RMs + SKUs problematicos + plano proximos dias) */}
          {(hasRMs || skusProblematicosLines.length > 0 || planoProximosDiasLines.length > 0) && (
            <Section>
              <div className="space-y-6">
                {!hasAds && (
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
                    <span className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">
                      Qualidade e Operacional
                    </span>
                    <div className="h-px flex-1 bg-white/[0.06]" aria-hidden="true" />
                  </div>
                )}

                {hasRMs && (
                  <GlassCard className="p-6 md:p-8">
                    <SectionHeading icon={ShieldCheck} label="Reclamacoes (RMs)" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {report.rms_abertas != null && (
                        <StatCard label="Abertas" value={report.rms_abertas} />
                      )}
                      {report.rms_resolvidas != null && (
                        <StatCard label="Resolvidas" value={report.rms_resolvidas} />
                      )}
                      {report.rms_em_aberto != null && (
                        <StatCard label="Em aberto" value={report.rms_em_aberto} />
                      )}
                    </div>
                  </GlassCard>
                )}

                {skusProblematicosLines.length > 0 && (
                  <GlassCard className="p-6 md:p-8">
                    <SectionHeading icon={AlertTriangle} label="SKUs problematicos" />
                    <TextList items={skusProblematicosLines} bulletColor="text-red-400/50" />
                  </GlassCard>
                )}

                {planoProximosDiasLines.length > 0 && (
                  <GlassCard className="p-6 md:p-8">
                    <SectionHeading icon={BarChart3} label="Plano proximos dias" />
                    <TextList items={planoProximosDiasLines} bulletColor="text-blue-400/60" />
                  </GlassCard>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <Section>
          <footer className="border-t border-white/[0.06] py-12 text-center space-y-4">
            <img
              src={mgrowthLogo}
              alt="Milennials Growth B2B"
              className="h-8 w-auto mx-auto opacity-40"
            />
            <p className="text-[11px] text-white/20">
              Relatorio gerado em {formatDateBR(report.created_at.split('T')[0])}
            </p>
            <p className="text-[10px] text-white/10">
              Milennials Growth B2B — Marketing B2B
            </p>
          </footer>
        </Section>
      </main>

      {/* Floating actions */}
      {token && (
        <FloatingActions token={token} contentRef={contentRef} clientName={clientDisplay} />
      )}
    </div>
  );
}
