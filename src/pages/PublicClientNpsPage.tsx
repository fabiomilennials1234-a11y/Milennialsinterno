import { useParams } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ThumbsUp, CheckCircle2, Loader2 } from 'lucide-react';
import mgrowthLogo from '@/assets/mgrowth-logo.png';

// ── Types ──

interface NpsResponseData {
  id: string;
  client_id: string;
  nps_score: number | null;
  score_reason: string | null;
  reference_month: string;
  public_token: string;
}

type NpsClassification = 'promotor' | 'neutro' | 'detrator';

function getNpsClassification(score: number): NpsClassification {
  if (score >= 9) return 'promotor';
  if (score >= 7) return 'neutro';
  return 'detrator';
}

function getNpsLabel(c: NpsClassification): string {
  switch (c) {
    case 'promotor': return 'Promotor';
    case 'neutro': return 'Neutro';
    case 'detrator': return 'Detrator';
  }
}

// ── Hook: fetch NPS by public_token ──

function usePublicNps(token: string) {
  return useQuery({
    queryKey: ['public-client-nps', token],
    queryFn: async (): Promise<NpsResponseData | null> => {
      if (!token) return null;

      const { data, error } = await supabase
        .from('client_nps_responses')
        .select('id, client_id, nps_score, score_reason, reference_month, public_token')
        .eq('public_token', token)
        .maybeSingle();

      if (error) throw error;
      return data as NpsResponseData | null;
    },
    enabled: !!token,
    staleTime: 30_000,
    retry: 1,
  });
}

// ── Hook: submit NPS via RPC ──

function useSubmitPublicNps() {
  return useMutation({
    mutationFn: async ({
      token,
      score,
      reason,
    }: {
      token: string;
      score: number;
      reason: string | null;
    }) => {
      const { data, error } = await supabase.rpc('submit_public_nps', {
        p_token: token,
        p_score: score,
        p_reason: reason,
      });

      if (error) throw error;
      return data;
    },
  });
}

// ── Score Button ──

function ScoreButton({
  value,
  selected,
  onClick,
}: {
  value: number;
  selected: boolean;
  onClick: () => void;
}) {
  const classification = getNpsClassification(value);

  const baseColors =
    classification === 'detrator'
      ? 'border-red-500/30 hover:border-red-400/60 hover:bg-red-500/10'
      : classification === 'neutro'
        ? 'border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/10'
        : 'border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/10';

  const selectedColors =
    classification === 'detrator'
      ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30 scale-110'
      : classification === 'neutro'
        ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/30 scale-110'
        : 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30 scale-110';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 text-sm sm:text-base font-bold transition-all duration-200 ${
        selected
          ? selectedColors
          : `bg-white/[0.03] text-white/50 ${baseColors}`
      }`}
      aria-label={`Nota ${value}`}
      aria-pressed={selected}
    >
      {value}
    </button>
  );
}

// ── Loading ──

function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
      <div className="max-w-lg w-full px-6 space-y-6">
        <Skeleton className="h-8 w-32 mx-auto bg-white/[0.06]" />
        <Skeleton className="h-6 w-48 mx-auto bg-white/[0.06]" />
        <Skeleton className="h-20 w-full bg-white/[0.06] rounded-2xl" />
      </div>
    </div>
  );
}

// ── Not Found ──

function NotFoundState() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#000' }}>
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto">
          <ThumbsUp className="w-7 h-7 text-white/20" />
        </div>
        <h1
          className="text-xl font-bold text-white"
          style={{ fontFamily: "'Archivo Black', 'Inter', sans-serif" }}
        >
          Avaliacao nao encontrada
        </h1>
        <p className="text-sm text-white/40 leading-relaxed">
          Este link pode ter expirado ou a avaliacao nao esta disponivel.
        </p>
      </div>
    </div>
  );
}

// ── Already Answered ──

function AlreadyAnsweredState({ score }: { score: number }) {
  const classification = getNpsClassification(score);
  const label = getNpsLabel(classification);

  const scoreColor =
    classification === 'promotor'
      ? 'text-emerald-400'
      : classification === 'neutro'
        ? 'text-amber-400'
        : 'text-red-400';

  const badgeColor =
    classification === 'promotor'
      ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400'
      : classification === 'neutro'
        ? 'bg-amber-400/10 border-amber-400/20 text-amber-400'
        : 'bg-red-400/10 border-red-400/20 text-red-400';

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#000' }}>
      <div className="text-center space-y-6 max-w-sm">
        <img
          src={mgrowthLogo}
          alt="Milennials Growth B2B"
          className="h-7 w-auto mx-auto object-contain"
        />
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-white/30" />
        </div>
        <h1
          className="text-xl font-bold text-white"
          style={{ fontFamily: "'Archivo Black', 'Inter', sans-serif" }}
        >
          Avaliacao ja respondida
        </h1>
        <div className="space-y-2">
          <p className={`text-5xl font-black tabular-nums ${scoreColor}`}>{score}</p>
          <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${badgeColor}`}>
            {label}
          </span>
        </div>
        <p className="text-sm text-white/40 leading-relaxed">
          Agradecemos o seu feedback!
        </p>
      </div>
    </div>
  );
}

// ── Thank You (after submit) ──

function ThankYouState() {
  const checkRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = checkRef.current;
    if (!el) return;
    el.classList.add('animate-bounce');
    const t = setTimeout(() => el.classList.remove('animate-bounce'), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#000' }}>
      {/* Ambient gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.06]"
          style={{ background: '#FFD600' }}
        />
      </div>

      <div className="relative z-10 text-center space-y-6 max-w-sm">
        <img
          src={mgrowthLogo}
          alt="Milennials Growth B2B"
          className="h-7 w-auto mx-auto object-contain"
        />
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2
            ref={checkRef}
            className="w-10 h-10 text-emerald-400"
          />
        </div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "'Archivo Black', 'Inter', sans-serif" }}
        >
          Obrigado!
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">
          Sua avaliacao foi enviada com sucesso.<br />
          O seu feedback e fundamental para continuarmos evoluindo.
        </p>
        <div className="pt-4">
          <img
            src={mgrowthLogo}
            alt="Milennials Growth B2B"
            className="h-5 w-auto mx-auto opacity-20"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function PublicClientNpsPage() {
  const { token } = useParams<{ token: string }>();
  const { data: npsData, isLoading, error } = usePublicNps(token || '');
  const submitMutation = useSubmitPublicNps();

  const [score, setScore] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

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
    document.title = 'Avaliacao de Satisfacao — Milennials Growth B2B';
    return () => {
      document.title = 'MGrowth Marketing B2B | Sistema de Gestao';
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (score === null || !token) return;

    try {
      await submitMutation.mutateAsync({
        token,
        score,
        reason: reason.trim() || null,
      });
      setSubmitted(true);
    } catch {
      // Error state handled by mutation
    }
  }, [score, token, reason, submitMutation]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !npsData) return <NotFoundState />;
  if (npsData.nps_score !== null) return <AlreadyAnsweredState score={npsData.nps_score} />;
  if (submitted) return <ThankYouState />;

  const selectedClassification = score !== null ? getNpsClassification(score) : null;
  const selectedLabel = selectedClassification ? getNpsLabel(selectedClassification) : null;

  return (
    <div className="min-h-screen text-white" style={{ background: '#000' }}>
      {/* Ambient gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.04]"
          style={{ background: '#FFD600' }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="max-w-xl mx-auto px-6 py-4 flex items-center justify-center">
          <img
            src={mgrowthLogo}
            alt="Milennials Growth B2B"
            className="h-7 w-auto object-contain"
          />
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-xl mx-auto px-6 py-12 md:py-20">
        <div className="text-center space-y-3 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD600]/10 border border-[#FFD600]/15 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600]" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-[#FFD600]/80 uppercase tracking-wider">
              NPS
            </span>
          </div>
          <h1
            className="text-2xl md:text-3xl font-black text-white leading-tight"
            style={{
              fontFamily: "'Archivo Black', 'Inter', sans-serif",
              letterSpacing: '-0.03em',
            }}
          >
            Avaliacao de Satisfacao
          </h1>
          <p className="text-sm md:text-base text-white/40 leading-relaxed max-w-md mx-auto">
            O quanto voce recomendaria a Milennials para outro empresario?
          </p>
        </div>

        {/* Score Selector */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <ScoreButton
                key={n}
                value={n}
                selected={score === n}
                onClick={() => setScore(n)}
              />
            ))}
          </div>

          {/* Scale labels */}
          <div className="flex justify-between text-[10px] text-white/20 uppercase tracking-wider px-1">
            <span>Nada provavel</span>
            <span>Muito provavel</span>
          </div>

          {/* Dynamic classification label */}
          {selectedClassification && (
            <div className="text-center">
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${
                selectedClassification === 'promotor'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : selectedClassification === 'neutro'
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {selectedLabel}
              </span>
            </div>
          )}
        </div>

        {/* Reason */}
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm p-6">
          <label className="block text-sm font-medium text-white/60 mb-3">
            Motivo da nota <span className="text-white/30">(opcional)</span>
          </label>
          <textarea
            placeholder="Conte-nos o que motivou sua nota..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#FFD600]/30 focus:border-[#FFD600]/40 transition-all resize-none"
          />
        </div>

        {/* Submit */}
        <div className="mt-8">
          <button
            onClick={handleSubmit}
            disabled={score === null || submitMutation.isPending}
            className="w-full h-12 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-[#FFD600] text-black hover:bg-[#FFD600]/90 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar Avaliacao'
            )}
          </button>

          {submitMutation.isError && (
            <p className="mt-3 text-center text-sm text-red-400">
              Erro ao enviar avaliacao. Tente novamente.
            </p>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center space-y-3">
          <img
            src={mgrowthLogo}
            alt="Milennials Growth B2B"
            className="h-5 w-auto mx-auto opacity-20"
          />
          <p className="text-[10px] text-white/10">
            Milennials Growth B2B — Marketing B2B
          </p>
        </footer>
      </main>
    </div>
  );
}
