import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Trophy,
  BarChart3,
  Gauge,
  Crown,
  Wrench,
  GitBranch,
  Compass,
  Database,
  Crosshair,
  TrendingUp,
  Target,
  GraduationCap,
  Lightbulb,
  CalendarCheck,
  Sparkles,
} from 'lucide-react';
import mgrowthLogo from '@/assets/mgrowth-logo.png';
import type { ResultsReport } from '@/hooks/useClientResultsReports';

// -- Types --

interface Props {
  report: ResultsReport;
  clientName: string;
  clientLogoUrl?: string;
}

interface SlideData {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  content: string;
  imageUrl?: string;
  type: 'cover' | 'content' | 'closing';
  accentColor: string;
}

// -- Constants --

const ACCENT_BLUE = '#6366f1';
const ACCENT_VIOLET = '#8b5cf6';
const ACCENT_CYAN = '#06b6d4';
const ACCENT_EMERALD = '#10b981';
const ACCENT_ROSE = '#f43f5e';
const ACCENT_AMBER = '#f59e0b';
const ACCENT_SKY = '#0ea5e9';
const ACCENT_FUCHSIA = '#d946ef';
const ACCENT_LIME = '#84cc16';
const ACCENT_TEAL = '#14b8a6';
const ACCENT_ORANGE = '#f97316';
const ACCENT_INDIGO = '#818cf8';
const ACCENT_PINK = '#ec4899';

// -- Utilities --

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };
  return `${fmt(start)} — ${fmt(end)}`;
}

function parseLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text.split(/\n/).map((l) => l.trim()).filter(Boolean);
}

// -- Slide builder --

function buildSlides(report: ResultsReport, clientName: string): SlideData[] {
  const slides: SlideData[] = [];
  const imgs = ((report.custom_content as Record<string, unknown>)?.sectionImages || {}) as Record<string, string[]>;

  // 1. Cover
  slides.push({
    id: 'cover',
    title: clientName,
    subtitle: 'Relatorio de Resultados GESTAO (QUINZENAL)',
    icon: Sparkles,
    content: formatDateRange(report.cycle_start_date, report.cycle_end_date),
    type: 'cover',
    accentColor: ACCENT_BLUE,
  });

  // 2. Resumo Executivo
  const resumo = (report.custom_content as Record<string, unknown>)?.resumoExecutivo as string | undefined;
  if (resumo) {
    slides.push({
      id: 'resumo',
      title: 'Resumo Executivo',
      icon: Sparkles,
      content: resumo,
      type: 'content',
      accentColor: ACCENT_VIOLET,
    });
  }

  // 3. Acoes Realizadas
  if (report.actions_last_30_days) {
    slides.push({
      id: 'acoes',
      title: 'Acoes Realizadas nos Ultimos 30 Dias',
      icon: Zap,
      content: report.actions_last_30_days,
      imageUrl: imgs.actionsLast30Days?.[0],
      type: 'content',
      accentColor: ACCENT_CYAN,
    });
  }

  // 4. Conquistas
  if (report.achievements) {
    slides.push({
      id: 'conquistas',
      title: 'Conquistas Importantes',
      icon: Trophy,
      content: report.achievements,
      imageUrl: imgs.achievements?.[0],
      type: 'content',
      accentColor: ACCENT_EMERALD,
    });
  }

  // 5. Trafego Pago
  if (report.traffic_results) {
    slides.push({
      id: 'trafego',
      title: 'Resultados Detalhados de Trafego Pago',
      icon: BarChart3,
      content: report.traffic_results,
      imageUrl: imgs.trafficResults?.[0],
      type: 'content',
      accentColor: ACCENT_SKY,
    });
  }

  // 6. Metricas
  if (report.key_metrics) {
    slides.push({
      id: 'metricas',
      title: 'Principais Metricas de Desempenho',
      icon: Gauge,
      content: report.key_metrics,
      imageUrl: imgs.keyMetrics?.[0],
      type: 'content',
      accentColor: ACCENT_FUCHSIA,
    });
  }

  // 7. Top Campaign
  if (report.top_campaign) {
    slides.push({
      id: 'top-campaign',
      title: 'Campanha Top 1',
      icon: Crown,
      content: report.top_campaign,
      imageUrl: imgs.topCampaign?.[0],
      type: 'content',
      accentColor: ACCENT_AMBER,
    });
  }

  // 8. Improvement Points
  if (report.improvement_points) {
    slides.push({
      id: 'ajustes',
      title: 'O que Precisa ser Ajustado',
      icon: Wrench,
      content: report.improvement_points,
      imageUrl: imgs.improvementPoints?.[0],
      type: 'content',
      accentColor: ACCENT_ROSE,
    });
  }

  // 9. Funil Comercial
  if (report.analise_funil_comercial) {
    slides.push({
      id: 'funil',
      title: 'Analise do Funil Comercial',
      icon: GitBranch,
      content: report.analise_funil_comercial,
      imageUrl: imgs.analiseFunilComercial?.[0],
      type: 'content',
      accentColor: ACCENT_TEAL,
    });
  }

  // 10. Indicadores Dominio Gestor
  if (report.indicadores_dominio_gestor) {
    slides.push({
      id: 'indicadores',
      title: 'Indicadores de Dominio do Gestor',
      icon: Compass,
      content: report.indicadores_dominio_gestor,
      imageUrl: imgs.indicadoresDominioGestor?.[0],
      type: 'content',
      accentColor: ACCENT_INDIGO,
    });
  }

  // 11. CRM
  if (report.analise_crm_cliente) {
    slides.push({
      id: 'crm',
      title: 'Analise do CRM do Cliente',
      icon: Database,
      content: report.analise_crm_cliente,
      imageUrl: imgs.analiseCrmCliente?.[0],
      type: 'content',
      accentColor: ACCENT_LIME,
    });
  }

  // 12. Estrategias Captacao
  if (report.analise_estrategias_captacao) {
    slides.push({
      id: 'captacao',
      title: 'Analise das Estrategias de Captacao',
      icon: Crosshair,
      content: report.analise_estrategias_captacao,
      imageUrl: imgs.analiseEstrategiasCaptacao?.[0],
      type: 'content',
      accentColor: ACCENT_ORANGE,
    });
  }

  // 13. Projecao Funil
  if (report.projecao_funil_quinzena) {
    slides.push({
      id: 'projecao',
      title: 'Projecao do Funil — Proxima Quinzena',
      icon: TrendingUp,
      content: report.projecao_funil_quinzena,
      imageUrl: imgs.projecaoFunilQuinzena?.[0],
      type: 'content',
      accentColor: ACCENT_CYAN,
    });
  }

  // 14. Objetivos Curto Prazo
  if (report.objetivos_curto_prazo) {
    slides.push({
      id: 'objetivos',
      title: 'Objetivos de Curto Prazo',
      icon: Target,
      content: report.objetivos_curto_prazo,
      imageUrl: imgs.objetivosCurtoPrazo?.[0],
      type: 'content',
      accentColor: ACCENT_EMERALD,
    });
  }

  // 15. Agenda Treinamentos
  if (report.agenda_treinamentos) {
    slides.push({
      id: 'treinamentos',
      title: 'Agenda de Treinamentos Comerciais',
      icon: GraduationCap,
      content: report.agenda_treinamentos,
      imageUrl: imgs.agendaTreinamentos?.[0],
      type: 'content',
      accentColor: ACCENT_VIOLET,
    });
  }

  // 16. Dica Comercial
  if (report.dica_comercial) {
    slides.push({
      id: 'dica',
      title: 'Dica Comercial / Operacional',
      icon: Lightbulb,
      content: report.dica_comercial,
      imageUrl: imgs.dicaComercial?.[0],
      type: 'content',
      accentColor: ACCENT_AMBER,
    });
  }

  // 17. Proximos Dias
  if (report.next_30_days) {
    slides.push({
      id: 'proximos',
      title: 'O que Faremos nos Proximos Dias',
      icon: CalendarCheck,
      content: report.next_30_days,
      imageUrl: imgs.next30Days?.[0],
      type: 'content',
      accentColor: ACCENT_SKY,
    });
  }

  // 18. Closing
  slides.push({
    id: 'closing',
    title: 'Obrigado',
    subtitle: clientName,
    icon: Sparkles,
    content: 'Conte com a Millennials para acelerar seus resultados.\nVamos juntos construir o proximo capitulo.',
    type: 'closing',
    accentColor: ACCENT_BLUE,
  });

  return slides;
}

// -- Slide Components --

function CoverSlide({
  slide,
  clientLogoUrl,
}: {
  slide: SlideData;
  clientLogoUrl?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center relative">
      {/* Radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.07]"
        style={{ background: `radial-gradient(circle, ${ACCENT_BLUE}, ${ACCENT_VIOLET})` }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        {clientLogoUrl && (
          <motion.img
            src={clientLogoUrl}
            alt=""
            className="w-20 h-20 rounded-2xl object-cover mb-8 ring-1 ring-white/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          />
        )}

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400/80" />
          <span className="text-[11px] font-medium text-white/40 uppercase tracking-[0.15em]">
            Gestao Quinzenal
          </span>
        </div>

        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] mb-4"
          style={{
            background: `linear-gradient(135deg, #fff 0%, ${ACCENT_BLUE} 50%, ${ACCENT_VIOLET} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.04em',
          }}
        >
          {slide.title}
        </h1>

        <p className="text-base md:text-lg text-white/30 font-medium tracking-wide mt-2">
          {slide.subtitle}
        </p>

        <div className="mt-8 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <span className="text-sm text-white/25 font-mono tracking-wider">
            {slide.content}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function ClosingSlide({ slide, clientLogoUrl }: { slide: SlideData; clientLogoUrl?: string }) {
  const lines = slide.content.split('\n');

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center relative">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[140px] opacity-[0.06]"
        style={{ background: `radial-gradient(circle, ${ACCENT_VIOLET}, ${ACCENT_BLUE})` }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        {clientLogoUrl && (
          <img
            src={clientLogoUrl}
            alt=""
            className="w-14 h-14 rounded-xl object-cover mb-8 ring-1 ring-white/10 opacity-60"
          />
        )}

        <h1
          className="text-5xl md:text-7xl font-black mb-4"
          style={{
            background: `linear-gradient(135deg, #fff 0%, ${ACCENT_BLUE} 60%, ${ACCENT_VIOLET} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.04em',
          }}
        >
          {slide.title}
        </h1>

        <p className="text-lg font-semibold text-white/40 mb-6">{slide.subtitle}</p>

        <div className="space-y-1">
          {lines.map((line, i) => (
            <p key={i} className="text-sm text-white/25">{line}</p>
          ))}
        </div>

        <div className="mt-10 flex items-center gap-3 opacity-40">
          <img src={mgrowthLogo} alt="Millennials" className="h-5 w-auto object-contain" />
          <div className="h-3 w-px bg-white/10" />
          <span className="text-[10px] text-white/20 uppercase tracking-[0.2em]">Growth Marketing B2B</span>
        </div>
      </motion.div>
    </div>
  );
}

function ContentSlide({ slide, slideNumber, totalSlides }: { slide: SlideData; slideNumber: number; totalSlides: number }) {
  const Icon = slide.icon;
  const lines = parseLines(slide.content);

  // Split long content into paragraphs vs bullet items
  const isSingleBlock = lines.length === 1 && lines[0].length > 120;

  return (
    <div className="flex flex-col min-h-[70vh] px-6 md:px-12 py-8 justify-center relative">
      {/* Accent glow — top-left */}
      <div
        className="absolute -top-20 -left-20 w-[300px] h-[300px] rounded-full blur-[120px] opacity-[0.04]"
        style={{ background: slide.accentColor }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-3xl w-full mx-auto relative z-10"
      >
        {/* Section number + icon */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${slide.accentColor}15`, border: `1px solid ${slide.accentColor}25` }}
          >
            <Icon size={18} style={{ color: slide.accentColor }} />
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{ color: `${slide.accentColor}90` }}
            >
              {String(slideNumber).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2
          className="text-2xl md:text-4xl font-bold text-white/90 mb-8 leading-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          {slide.title}
        </h2>

        {/* Content */}
        <div
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 md:p-8"
        >
          {isSingleBlock ? (
            <p className="text-[15px] text-white/55 leading-[1.8]">{lines[0]}</p>
          ) : (
            <ul className="space-y-3" role="list">
              {lines.map((line, i) => (
                <li key={i} className="flex items-start gap-3 group">
                  <span
                    className="mt-2 w-1.5 h-1.5 rounded-full shrink-0 opacity-60"
                    style={{ background: slide.accentColor }}
                  />
                  <span className="text-[15px] text-white/55 leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Section image */}
        {slide.imageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-6"
          >
            <img
              src={slide.imageUrl}
              alt={slide.title}
              className="max-w-full max-h-[280px] rounded-xl border border-white/[0.06] object-contain mx-auto"
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// -- Progress Bar --

function ProgressBar({ current, total }: { current: number; total: number }) {
  const progress = ((current + 1) / total) * 100;

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${ACCENT_BLUE}, ${ACCENT_VIOLET})`,
          }}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// -- Main Component --

export default function ResultsPresentationView({ report, clientName, clientLogoUrl }: Props) {
  const slides = useMemo(() => buildSlides(report, clientName), [report, clientName]);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length) return;
      setDirection(index > current ? 1 : -1);
      setCurrent(index);
    },
    [current, slides.length],
  );

  const next = useCallback(() => goTo(current + 1), [goTo, current]);
  const prev = useCallback(() => goTo(current - 1), [goTo, current]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  const slide = slides[current];
  const isCover = slide.type === 'cover';
  const isClosing = slide.type === 'closing';

  // Compute slide number for content slides (1-indexed, excluding cover)
  const contentIndex = useMemo(() => {
    let count = 0;
    for (let i = 0; i < current; i++) {
      if (slides[i].type === 'content') count++;
    }
    return count + (slide.type === 'content' ? 1 : 0);
  }, [current, slides, slide.type]);

  const totalContent = useMemo(
    () => slides.filter((s) => s.type === 'content').length,
    [slides],
  );

  const slideVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 60 : -60,
      filter: 'blur(4px)',
    }),
    center: {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -60 : 60,
      filter: 'blur(4px)',
    }),
  };

  return (
    <div
      className="min-h-screen text-white relative overflow-hidden select-none"
      style={{ background: '#0a0a0a' }}
    >
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Deep blue/violet gradient orbs */}
        <div
          className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full blur-[180px] opacity-[0.03]"
          style={{ background: `radial-gradient(circle, ${ACCENT_BLUE}, transparent)` }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.025]"
          style={{ background: `radial-gradient(circle, ${ACCENT_VIOLET}, transparent)` }}
        />
        {/* Subtle noise texture via CSS */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          {clientLogoUrl && (
            <img
              src={clientLogoUrl}
              alt=""
              className="h-7 w-7 rounded-lg object-cover ring-1 ring-white/[0.08]"
            />
          )}
          <div className="h-4 w-px bg-white/[0.06]" />
          <img src={mgrowthLogo} alt="Millennials" className="h-5 w-auto object-contain opacity-30" />
        </div>

        <span className="text-[11px] font-mono text-white/20 tabular-nums tracking-wider">
          {String(current + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
      </header>

      {/* Slide area */}
      <main className="relative z-10 min-h-[calc(100vh-120px)] flex items-center justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {isCover && <CoverSlide slide={slide} clientLogoUrl={clientLogoUrl} />}
            {isClosing && <ClosingSlide slide={slide} clientLogoUrl={clientLogoUrl} />}
            {slide.type === 'content' && (
              <ContentSlide
                slide={slide}
                slideNumber={contentIndex}
                totalSlides={totalContent}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/[0.04] bg-[#0a0a0a]/80 backdrop-blur-md print:hidden">
        <div className="flex items-center justify-between px-6 md:px-10 py-3">
          <button
            onClick={prev}
            disabled={current === 0}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-white/[0.04] disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Slide anterior"
          >
            <ChevronLeft size={20} className="text-white/40" />
          </button>

          <ProgressBar current={current} total={slides.length} />

          <button
            onClick={next}
            disabled={current === slides.length - 1}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-white/[0.04] disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Proximo slide"
          >
            <ChevronRight size={20} className="text-white/40" />
          </button>
        </div>
      </footer>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: #0a0a0a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
