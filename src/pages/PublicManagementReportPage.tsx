import { useParams } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FileText,
  Share2,
  Copy,
  Check,
  TrendingUp,
  Target,
  Package,
  ChevronDown,
  Lightbulb,
  ArrowRight,
  DollarSign,
  Users,
  BarChart3,
  Percent,
  Zap,
  Award,
  Loader2 as Loader2Icon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import mgrowthLogo from '@/assets/mgrowth-logo.png';

// ── Types ──

interface ResponsavelAcao {
  acao: string;
  responsavel: 'Cliente' | 'Milennials';
}

interface ManagementReportData {
  id: string;
  client_id: string;
  created_by: string;
  reference_month: string;
  // Block 1
  campanhas_veiculadas: string | null;
  leads_gerados: string | null;
  cpl_medio: string | null;
  criativos_performance: string | null;
  entregas_extra_escopo: string | null;
  planejado_nao_executado: string | null;
  // Block 2
  maior_resultado_mes: string | null;
  principal_desafio: string | null;
  mudanca_estrategia: string | null;
  // Block 3
  dica_eixo: string | null;
  dica_texto: string | null;
  dica_fonte: string | null;
  // Block 4
  plano_30d: string | null;
  plano_60d: string | null;
  plano_90d: string | null;
  responsaveis_acoes: ResponsavelAcao[] | null;
  // Block 5
  investimento_total: number | null;
  leads_gerados_num: number | null;
  cpl_num: number | null;
  taxa_conversao: number | null;
  melhor_criativo_url: string | null;
  melhor_criativo_metrica: string | null;
  frase_destaque: string | null;
  proximo_passo: string | null;
  client_logo_url: string | null;
  // Meta
  public_token: string | null;
  is_published: boolean;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  client_name: string;
  client_razao_social: string | null;
}

// ── Hook ──

function usePublicManagementReport(token: string) {
  return useQuery({
    queryKey: ['public-management-report', token],
    queryFn: async (): Promise<ManagementReportData | null> => {
      if (!token) return null;

      const { data, error } = await supabase
        .from('client_management_reports')
        .select('*, clients(name, razao_social)')
        .eq('public_token', token)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const clientInfo = data.clients as { name: string; razao_social: string | null } | null;

      return {
        ...data,
        responsaveis_acoes: data.responsaveis_acoes as ResponsavelAcao[] | null,
        client_name: clientInfo?.name || 'Cliente',
        client_razao_social: clientInfo?.razao_social || null,
      } as ManagementReportData;
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ── Utilities ──

function formatMonthBR(monthStr: string): string {
  const [y, m] = monthStr.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseTextContent(text: string | null): string[] {
  if (!text?.trim()) return [];
  return text.split(/\n/).map((l) => l.trim()).filter(Boolean);
}

const EIXO_LABELS: Record<string, string> = {
  pessoas: 'Pessoas',
  estrategia: 'Estrategia',
  processos: 'Processos',
  gestao: 'Gestao',
  cultura: 'Cultura',
};

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

// ── Reusable section wrapper ──

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

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ElementType }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={12} className="text-white/20" />}
        <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-bold text-white/80 tabular-nums">{value}</p>
    </div>
  );
}

// ── Skeleton loading ──

function LoadingSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#000' }} role="status" aria-label="Carregando relatorio">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-4 py-12">
          <Skeleton className="h-6 w-32 mx-auto bg-white/[0.06]" />
          <Skeleton className="h-10 w-64 mx-auto bg-white/[0.06]" />
          <Skeleton className="h-4 w-48 mx-auto bg-white/[0.06]" />
        </div>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="rounded-2xl border border-white/[0.06] p-6 space-y-3">
            <Skeleton className="h-5 w-40 bg-white/[0.06]" />
            <Skeleton className="h-4 w-full bg-white/[0.06]" />
            <Skeleton className="h-4 w-3/4 bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#000' }}>
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
        </p>
      </div>
    </div>
  );
}

// ── Floating actions ──

function FloatingActions({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const url = `${window.location.origin}/relatorio-gestao/${token}`;

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

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div className="flex flex-col gap-2 animate-fade-in">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFD600]/15 border border-[#FFD600]/25 text-[#FFD600] text-sm font-medium backdrop-blur-md transition-colors duration-150 hover:bg-[#FFD600]/25"
          >
            <FileText size={14} />
            Imprimir / PDF
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.08] border border-white/[0.1] text-white/80 text-sm font-medium backdrop-blur-md transition-colors duration-150 hover:bg-white/[0.12]"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar link'}
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
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

// ── Main Page ──

export default function PublicManagementReportPage() {
  const { token } = useParams<{ token: string }>();
  const { data: report, isLoading, error } = usePublicManagementReport(token || '');

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
      document.title = `Relatorio Gestao ${formatMonthBR(report.reference_month)} — ${report.client_name}`;
    }
    return () => {
      document.title = 'MGrowth Marketing B2B | Sistema de Gestao';
    };
  }, [report?.client_name, report?.reference_month]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !report) return <NotFoundState />;

  const clientDisplay = report.client_name || 'Cliente';

  // Parse text fields
  const campanhasLines = parseTextContent(report.campanhas_veiculadas);
  const leadsLines = parseTextContent(report.leads_gerados);
  const cplLines = parseTextContent(report.cpl_medio);
  const criativosLines = parseTextContent(report.criativos_performance);
  const extrasLines = parseTextContent(report.entregas_extra_escopo);
  const naoExecLines = parseTextContent(report.planejado_nao_executado);
  const desafioLines = parseTextContent(report.principal_desafio);
  const mudancaLines = parseTextContent(report.mudanca_estrategia);
  const dicaLines = parseTextContent(report.dica_texto);
  const plano30Lines = parseTextContent(report.plano_30d);
  const plano60Lines = parseTextContent(report.plano_60d);
  const plano90Lines = parseTextContent(report.plano_90d);

  const hasConsolidacao = campanhasLines.length > 0 || leadsLines.length > 0 || cplLines.length > 0 || criativosLines.length > 0;
  const hasExecutivo = report.maior_resultado_mes || desafioLines.length > 0 || mudancaLines.length > 0;
  const hasDica = report.dica_eixo && dicaLines.length > 0;
  const hasPlano = plano30Lines.length > 0 || plano60Lines.length > 0 || plano90Lines.length > 0;
  const hasResponsaveis = report.responsaveis_acoes && report.responsaveis_acoes.length > 0;
  const hasOnePage = report.investimento_total != null || report.leads_gerados_num != null || report.frase_destaque;

  return (
    <div className="min-h-screen text-white" style={{ background: '#000' }}>
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
      <header className="relative z-10 border-b border-white/[0.06] print:border-none">
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={mgrowthLogo}
              alt="Milennials Growth B2B"
              className="h-7 w-auto object-contain"
            />
            <div className="h-4 w-px bg-white/10" aria-hidden="true" />
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-widest">
              Relatorio de Gestao
            </span>
          </div>
          <span className="text-[11px] text-white/20 tabular-nums">
            {formatDateBR(report.created_at)}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 md:px-10">
        {/* Hero */}
        <Section delay={0}>
          <div className="pt-16 pb-12 md:pt-32 md:pb-20 text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD600]/10 border border-[#FFD600]/15">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600]" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-[#FFD600]/80 uppercase tracking-wider">
                  Gestao Mensal
                </span>
              </div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                  {formatMonthBR(report.reference_month)}
                </span>
              </div>
            </div>

            {/* Client logo */}
            {report.client_logo_url && (
              <div className="mb-6">
                <img
                  src={report.client_logo_url}
                  alt={clientDisplay}
                  className="h-16 w-auto mx-auto object-contain rounded-xl"
                />
              </div>
            )}

            <h1
              className="text-3xl md:text-5xl font-black text-white leading-tight"
              style={{
                fontFamily: "'Archivo Black', 'Inter', sans-serif",
                letterSpacing: '-0.03em',
              }}
            >
              {clientDisplay}
            </h1>

            {report.frase_destaque && (
              <p className="mt-4 text-lg md:text-xl text-[#FFD600]/80 font-semibold">
                {report.frase_destaque}
              </p>
            )}

            <ChevronDown size={16} className="mx-auto mt-10 text-white/15 animate-bounce" aria-hidden="true" />
          </div>
        </Section>

        <div className="space-y-6 pb-20">
          {/* One-page hero stats */}
          {hasOnePage && (
            <Section delay={60}>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={Award} label="Resumo do Mes" accent />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {report.investimento_total != null && (
                    <StatCard label="Investimento" value={formatCurrency(report.investimento_total)} icon={DollarSign} />
                  )}
                  {report.leads_gerados_num != null && (
                    <StatCard label="Leads" value={report.leads_gerados_num} icon={Users} />
                  )}
                  {report.cpl_num != null && (
                    <StatCard label="CPL" value={formatCurrency(report.cpl_num)} icon={BarChart3} />
                  )}
                  {report.taxa_conversao != null && (
                    <StatCard label="Conversao" value={`${report.taxa_conversao}%`} icon={Percent} />
                  )}
                </div>
                {report.melhor_criativo_url && (
                  <div className="mt-4 rounded-xl bg-white/[0.03] border border-white/[0.05] p-4">
                    <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">
                      Melhor Criativo
                    </p>
                    <a
                      href={report.melhor_criativo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#FFD600]/70 hover:text-[#FFD600] underline underline-offset-4 break-all"
                    >
                      {report.melhor_criativo_url}
                    </a>
                    {report.melhor_criativo_metrica && (
                      <p className="text-xs text-white/40 mt-1">{report.melhor_criativo_metrica}</p>
                    )}
                  </div>
                )}
                {report.proximo_passo && (
                  <div className="mt-4 rounded-xl bg-[#FFD600]/5 border border-[#FFD600]/10 px-4 py-3">
                    <p className="text-[11px] font-medium text-[#FFD600]/40 uppercase tracking-wider mb-1">
                      Proximo Passo
                    </p>
                    <p className="text-sm text-white/70 font-medium">{report.proximo_passo}</p>
                  </div>
                )}
              </GlassCard>
            </Section>
          )}

          {/* Consolidacao */}
          {hasConsolidacao && (
            <Section delay={100}>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={Package} label="Consolidacao das Entregas" accent />
                <div className="space-y-5">
                  {campanhasLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Campanhas Veiculadas
                      </p>
                      <TextList items={campanhasLines} bulletColor="text-blue-400/60" />
                    </div>
                  )}
                  {leadsLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Leads Gerados
                      </p>
                      <TextList items={leadsLines} bulletColor="text-emerald-400/60" />
                    </div>
                  )}
                  {cplLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        CPL Medio
                      </p>
                      <TextList items={cplLines} bulletColor="text-purple-400/60" />
                    </div>
                  )}
                  {criativosLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Criativos e Performance
                      </p>
                      <TextList items={criativosLines} bulletColor="text-amber-400/60" />
                    </div>
                  )}
                  {extrasLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Entregas Extra Escopo
                      </p>
                      <TextList items={extrasLines} bulletColor="text-cyan-400/60" />
                    </div>
                  )}
                  {naoExecLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Planejado e Nao Executado
                      </p>
                      <TextList items={naoExecLines} bulletColor="text-red-400/50" />
                    </div>
                  )}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* Executivo */}
          {hasExecutivo && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={TrendingUp} label="Relatorio Executivo" accent />
                <div className="space-y-5">
                  {report.maior_resultado_mes && (
                    <div className="rounded-xl bg-[#FFD600]/5 border border-[#FFD600]/10 px-4 py-3.5">
                      <p className="text-[11px] font-medium text-[#FFD600]/40 uppercase tracking-wider mb-1">
                        Maior Resultado do Mes
                      </p>
                      <p className="text-base font-semibold text-white/80">{report.maior_resultado_mes}</p>
                    </div>
                  )}
                  {desafioLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Principal Desafio
                      </p>
                      <TextList items={desafioLines} bulletColor="text-red-400/50" />
                    </div>
                  )}
                  {mudancaLines.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">
                        Mudanca de Estrategia
                      </p>
                      <TextList items={mudancaLines} bulletColor="text-blue-400/60" />
                    </div>
                  )}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* Dica de Gestao */}
          {hasDica && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={Lightbulb} label="Dica de Gestao" />
                <div className="space-y-4">
                  {report.dica_eixo && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
                      <Zap size={12} className="text-amber-400" />
                      <span className="text-xs font-medium text-amber-400">
                        Eixo: {EIXO_LABELS[report.dica_eixo] || report.dica_eixo}
                      </span>
                    </div>
                  )}
                  <TextList items={dicaLines} bulletColor="text-amber-400/60" />
                  {report.dica_fonte && (
                    <p className="text-xs text-white/30 italic mt-2">
                      Fonte: {report.dica_fonte}
                    </p>
                  )}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* Plano 30-60-90 */}
          {hasPlano && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={Target} label="Plano de Acao 30-60-90" accent />
                <div className="space-y-5">
                  {plano30Lines.length > 0 && (
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-400/10 border border-emerald-400/20 mb-3">
                        <span className="text-xs font-bold text-emerald-400">30 dias</span>
                      </div>
                      {plano30Lines.map((step, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-xl bg-white/[0.025] border border-white/[0.04] px-4 py-3 mt-2 transition-colors hover:bg-white/[0.04]"
                        >
                          <div className="w-6 h-6 rounded-md bg-emerald-400/10 flex items-center justify-center shrink-0 mt-0.5">
                            <ArrowRight size={12} className="text-emerald-400/70" />
                          </div>
                          <p className="text-sm text-white/60 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {plano60Lines.length > 0 && (
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-400/10 border border-blue-400/20 mb-3">
                        <span className="text-xs font-bold text-blue-400">60 dias</span>
                      </div>
                      {plano60Lines.map((step, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-xl bg-white/[0.025] border border-white/[0.04] px-4 py-3 mt-2"
                        >
                          <div className="w-6 h-6 rounded-md bg-blue-400/10 flex items-center justify-center shrink-0 mt-0.5">
                            <ArrowRight size={12} className="text-blue-400/70" />
                          </div>
                          <p className="text-sm text-white/60 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {plano90Lines.length > 0 && (
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-purple-400/10 border border-purple-400/20 mb-3">
                        <span className="text-xs font-bold text-purple-400">90 dias</span>
                      </div>
                      {plano90Lines.map((step, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-xl bg-white/[0.025] border border-white/[0.04] px-4 py-3 mt-2"
                        >
                          <div className="w-6 h-6 rounded-md bg-purple-400/10 flex items-center justify-center shrink-0 mt-0.5">
                            <ArrowRight size={12} className="text-purple-400/70" />
                          </div>
                          <p className="text-sm text-white/60 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            </Section>
          )}

          {/* Responsaveis */}
          {hasResponsaveis && (
            <Section>
              <GlassCard className="p-6 md:p-8">
                <SectionHeading icon={Users} label="Responsaveis pelas Acoes" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                          Acao
                        </th>
                        <th className="text-center py-3 px-4 text-[11px] font-semibold text-white/30 uppercase tracking-wider w-32">
                          Responsavel
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.responsaveis_acoes!.map((row, i) => (
                        <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="py-3 px-4 text-white/60">{row.acao}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                              row.responsavel === 'Milennials'
                                ? 'text-[#FFD600] bg-[#FFD600]/10'
                                : 'text-blue-400 bg-blue-400/10'
                            }`}>
                              {row.responsavel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </Section>
          )}
        </div>

        {/* Footer */}
        <Section>
          <footer className="border-t border-white/[0.06] py-12 text-center space-y-4 print:border-none">
            <img
              src={mgrowthLogo}
              alt="Milennials Growth B2B"
              className="h-8 w-auto mx-auto opacity-40"
            />
            <p className="text-[11px] text-white/20">
              Relatorio gerado em {formatDateBR(report.created_at)}
            </p>
            <p className="text-[10px] text-white/10">
              Milennials Growth B2B — Marketing B2B
            </p>
          </footer>
        </Section>
      </main>

      {/* Floating actions */}
      {token && <FloatingActions token={token} />}
    </div>
  );
}
