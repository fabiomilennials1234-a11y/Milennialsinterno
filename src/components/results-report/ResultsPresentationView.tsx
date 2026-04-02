import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ResultsReport } from '@/hooks/useClientResultsReports';

interface Props {
  report: ResultsReport;
  clientName: string;
  clientLogoUrl?: string;
}

interface Slide {
  title: string;
  content: string;
  icon: string;
  imageUrl?: string;
}

function buildSlides(report: ResultsReport, clientName: string): Slide[] {
  const slides: Slide[] = [];

  slides.push({
    title: clientName,
    content: 'Relatório de Resultados\nÚltimos 30 dias',
    icon: '🚀',
  });

  // Resumo executivo (gerado pela IA)
  const resumo = (report.custom_content as any)?.resumoExecutivo;
  if (resumo) {
    slides.push({ title: 'Resumo Executivo', content: resumo, icon: '📋' });
  }

  const imgs = ((report.custom_content as any)?.sectionImages || {}) as Record<string, string[]>;

  if (report.actions_last_30_days) {
    slides.push({ title: 'Ações Realizadas', content: report.actions_last_30_days, icon: '⚡', imageUrl: imgs.actionsLast30Days?.[0] });
  }
  if (report.achievements) {
    slides.push({ title: 'Conquistas', content: report.achievements, icon: '🏆', imageUrl: imgs.achievements?.[0] });
  }
  if (report.traffic_results) {
    slides.push({ title: 'Resultados de Tráfego Pago', content: report.traffic_results, icon: '📊', imageUrl: imgs.trafficResults?.[0] });
  }
  if (report.key_metrics) {
    slides.push({ title: 'Métricas de Desempenho', content: report.key_metrics, icon: '📈', imageUrl: imgs.keyMetrics?.[0] });
  }
  if (report.top_campaign) {
    slides.push({ title: 'Campanha Top 1', content: report.top_campaign, icon: '🥇', imageUrl: imgs.topCampaign?.[0] });
  }
  if (report.improvement_points) {
    slides.push({ title: 'Pontos a Melhorar', content: report.improvement_points, icon: '🔧', imageUrl: imgs.improvementPoints?.[0] });
  }
  if (report.next_30_days) {
    slides.push({ title: 'Próximos 30 Dias', content: report.next_30_days, icon: '🗓️', imageUrl: imgs.next30Days?.[0] });
  }
  if (report.next_steps) {
    slides.push({ title: 'Próximos Passos', content: report.next_steps, icon: '🎯', imageUrl: imgs.nextSteps?.[0] });
  }

  slides.push({
    title: 'Obrigado!',
    content: `${clientName}\nMillennials Growth Marketing B2B`,
    icon: '🙌',
  });

  return slides;
}

export default function ResultsPresentationView({ report, clientName, clientLogoUrl }: Props) {
  const slides = buildSlides(report, clientName);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  const goTo = (index: number) => {
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
  };

  const next = () => current < slides.length - 1 && goTo(current + 1);
  const prev = () => current > 0 && goTo(current - 1);

  const slide = slides[current];
  const isCover = current === 0;
  const isClosing = current === slides.length - 1;

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0c0a09 0%, #1c1917 40%, #0c0a09 100%)' }}>
      {/* Floating shapes — Millennials gold/amber tones */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl animate-pulse" style={{ background: 'rgba(234, 179, 8, 0.08)' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ background: 'rgba(245, 158, 11, 0.06)', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl" style={{ background: 'rgba(251, 191, 36, 0.04)' }} />
      </div>

      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-4" style={{ borderBottom: '1px solid rgba(251, 191, 36, 0.15)' }}>
        <div className="flex items-center gap-3">
          {clientLogoUrl && (
            <img src={clientLogoUrl} alt="Logo" className="h-8 w-8 rounded-full object-cover border border-amber-500/30" />
          )}
          <span className="text-sm font-medium" style={{ color: 'rgba(251, 191, 36, 0.7)' }}>
            Millennials Growth Marketing B2B
          </span>
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {current + 1} / {slides.length}
        </span>
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex-1 flex items-center justify-center min-h-[calc(100vh-140px)] px-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -100 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="max-w-3xl w-full text-center"
          >
            <div className="text-5xl mb-6">{slide.icon}</div>

            <h1 className={`font-bold mb-6 ${isCover || isClosing ? 'text-5xl' : 'text-4xl'}`}>
              <span style={{ background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #eab308)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {slide.title}
              </span>
            </h1>

            <div className="space-y-4">
              {slide.content.split('\n').map((line, i) => (
                <p key={i} className={`${isCover || isClosing ? 'text-xl' : 'text-lg leading-relaxed text-left'}`} style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {line}
                </p>
              ))}
            </div>

            {/* Section image */}
            {slide.imageUrl && !isCover && !isClosing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 flex justify-center"
              >
                <img
                  src={slide.imageUrl}
                  alt={slide.title}
                  className="max-w-full max-h-[300px] rounded-xl border border-amber-500/20 object-contain"
                />
              </motion.div>
            )}

            {/* Cover extra: logo + period */}
            {isCover && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 flex flex-col items-center gap-3"
              >
                {clientLogoUrl && (
                  <img src={clientLogoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500/30" />
                )}
                <p className="text-xs" style={{ color: 'rgba(251, 191, 36, 0.5)' }}>
                  {report.cycle_start_date} — {report.cycle_end_date}
                </p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="relative z-10 flex items-center justify-between px-8 py-4" style={{ borderTop: '1px solid rgba(251, 191, 36, 0.15)' }}>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-amber-500/10"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onClick={prev}
          disabled={current === 0}
        >
          <ChevronLeft size={24} />
        </Button>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                background: i === current ? '#fbbf24' : 'rgba(255,255,255,0.15)',
              }}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-amber-500/10"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onClick={next}
          disabled={current === slides.length - 1}
        >
          <ChevronRight size={24} />
        </Button>
      </div>
    </div>
  );
}
