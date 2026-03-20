import { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useDashGestores, useWeeklyProblemsStats } from '@/hooks/useDashGestores';
import { useOKRs } from '@/hooks/useOKRs';
import { useTVDashboardStats } from '@/hooks/useTVDashboard';
import {
  Loader2, Target, AlertTriangle, CheckCircle2, XCircle,
  Clock, TrendingUp, Zap, Users, ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ROLE_LABELS } from '@/types/auth';

// ─── Helper: cor por progresso ───
function progressColor(value: number) {
  if (value >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (value >= 50) return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
  if (value >= 25) return { bar: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50' };
  return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' };
}

export default function TVDashboardPage() {
  const { data: gestores, isLoading: gestoresLoading } = useDashGestores();
  const { okrs: annualOKRs, isLoading: annualLoading } = useOKRs('annual');
  const { okrs: weeklyOKRs, isLoading: weeklyLoading } = useOKRs('weekly');
  const { data: problemsStats } = useWeeklyProblemsStats();
  const { data: professionalStats } = useTVDashboardStats();

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const isLoading = gestoresLoading && annualLoading && weeklyLoading;

  // ─── Resumos da equipe ───
  const teamSummary = useMemo(() => {
    const all = professionalStats?.all || [];
    const totalPending = all.reduce((s, p) => s + p.pendingTasks, 0);
    const totalCompleted = all.reduce((s, p) => s + p.completedToday, 0);
    const totalDelayed = all.reduce((s, p) => s + p.delayedTasks, 0);
    return { totalPending, totalCompleted, totalDelayed, total: all.length };
  }, [professionalStats]);

  // ─── Totais de clientes (gestores) ───
  const clientSummary = useMemo(() => {
    if (!gestores) return { otimo: 0, bom: 0, medio: 0, ruim: 0, total: 0, churn: 0 };
    const otimo = gestores.reduce((s, g) => s + g.clientCounts.otimo, 0);
    const bom = gestores.reduce((s, g) => s + g.clientCounts.bom, 0);
    const medio = gestores.reduce((s, g) => s + g.clientCounts.medio, 0);
    const ruim = gestores.reduce((s, g) => s + g.clientCounts.ruim, 0);
    const churn = gestores.reduce((s, g) => s + g.churnCount, 0);
    return { otimo, bom, medio, ruim, total: otimo + bom + medio + ruim, churn };
  }, [gestores]);

  // ─── Profissionais com mais atrasos (top 5) ───
  const topDelayed = useMemo(() => {
    const all = professionalStats?.all || [];
    return [...all]
      .filter(p => p.delayedTasks > 0)
      .sort((a, b) => b.delayedTasks - a.delayedTasks)
      .slice(0, 5);
  }, [professionalStats]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen bg-white">
          <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] bg-white p-5 overflow-hidden flex flex-col">

        {/* ════════ HEADER ════════ */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-200/50">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
                MILLENNIALS <span className="text-amber-500">GROWTH</span>
              </h1>
              <p className="text-gray-400 text-sm font-medium">
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' '}&bull;{' '}
                {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold text-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            AO VIVO
          </div>
        </div>

        {/* ════════ KPI CARDS ROW ════════ */}
        <div className="grid grid-cols-6 gap-3 mb-4 shrink-0">
          {/* Equipe */}
          <KPICard
            label="Equipe"
            value={teamSummary.total}
            icon={<Users className="w-5 h-5" />}
            color="blue"
          />
          {/* Tarefas Pendentes */}
          <KPICard
            label="Pendentes"
            value={teamSummary.totalPending}
            icon={<Clock className="w-5 h-5" />}
            color="amber"
          />
          {/* Concluídas Hoje */}
          <KPICard
            label="Feitas Hoje"
            value={teamSummary.totalCompleted}
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="emerald"
          />
          {/* Atrasadas */}
          <KPICard
            label="Atrasadas"
            value={teamSummary.totalDelayed}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="red"
            alert={teamSummary.totalDelayed > 0}
          />
          {/* Total Clientes */}
          <KPICard
            label="Clientes"
            value={clientSummary.total}
            icon={<Target className="w-5 h-5" />}
            color="violet"
          />
          {/* Churn */}
          <KPICard
            label="Churn"
            value={clientSummary.churn}
            icon={<ArrowDown className="w-5 h-5" />}
            color="rose"
            alert={clientSummary.churn > 0}
          />
        </div>

        {/* ════════ MAIN GRID ════════ */}
        <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">

          {/* ──── COLUNA ESQUERDA: OKRs ──── */}
          <div className="col-span-5 flex flex-col gap-4 min-h-0">
            {/* OKRs Anuais */}
            <Section
              title="OKRs Anuais"
              icon={<TrendingUp className="w-4 h-4" />}
              color="amber"
              className="flex-[3] min-h-0"
            >
              <div className="space-y-3 overflow-auto pr-1">
                {annualOKRs.map((okr) => {
                  const progress = okr.current_value ?? 0;
                  const pc = progressColor(progress);
                  return (
                    <div key={okr.id}>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-sm font-semibold text-gray-800 truncate flex-1 pr-3">{okr.title}</span>
                        <span className={cn("text-lg font-extrabold tabular-nums", pc.text)}>
                          {progress}%
                        </span>
                      </div>
                      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          className={cn("h-full rounded-full", pc.bar)}
                        />
                      </div>
                    </div>
                  );
                })}
                {annualOKRs.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">Nenhum OKR anual cadastrado</p>
                )}
              </div>
            </Section>

            {/* OKRs Semanais */}
            <Section
              title="OKRs da Semana"
              icon={<Clock className="w-4 h-4" />}
              color="sky"
              className="flex-[2] min-h-0"
            >
              <div className="space-y-3 overflow-auto pr-1">
                {weeklyOKRs.map((okr) => {
                  const progress = okr.current_value ?? 0;
                  const pc = progressColor(progress);
                  return (
                    <div key={okr.id}>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-sm font-semibold text-gray-800 truncate flex-1 pr-3">{okr.title}</span>
                        <span className={cn("text-lg font-extrabold tabular-nums", pc.text)}>
                          {progress}%
                        </span>
                      </div>
                      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                          className={cn("h-full rounded-full", pc.bar)}
                        />
                      </div>
                    </div>
                  );
                })}
                {weeklyOKRs.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-4">Nenhum OKR semanal cadastrado</p>
                )}
              </div>
            </Section>
          </div>

          {/* ──── COLUNA CENTRAL: Gestores de Tráfego ──── */}
          <div className="col-span-4 min-h-0">
            <Section
              title="Gestores de Tráfego"
              icon={<Target className="w-4 h-4" />}
              color="violet"
              badge={`${gestores?.length || 0} gestores`}
              className="h-full"
            >
              {/* Resumo de clientes por label */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <ClientLabelChip label="Ótimo" count={clientSummary.otimo} color="emerald" />
                <ClientLabelChip label="Bom" count={clientSummary.bom} color="blue" />
                <ClientLabelChip label="Médio" count={clientSummary.medio} color="amber" />
                <ClientLabelChip label="Ruim" count={clientSummary.ruim} color="red" />
              </div>

              {/* Lista de gestores */}
              <div className="space-y-2 overflow-auto pr-1 flex-1">
                {gestores?.map((gestor) => {
                  const totalClients = gestor.clientCounts.otimo + gestor.clientCounts.bom + gestor.clientCounts.medio + gestor.clientCounts.ruim;
                  return (
                    <div
                      key={gestor.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center text-sm font-bold text-violet-600 overflow-hidden shrink-0 border border-violet-200">
                        {gestor.avatar ? (
                          <img src={gestor.avatar} alt={gestor.name} className="w-full h-full object-cover" />
                        ) : (
                          gestor.name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-800 truncate">{gestor.name}</p>
                          {gestor.documentedYesterday ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{totalClients} clientes</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <MiniPill value={gestor.clientCounts.otimo} color="emerald" />
                        <MiniPill value={gestor.clientCounts.bom} color="blue" />
                        <MiniPill value={gestor.clientCounts.medio} color="amber" />
                        <MiniPill value={gestor.clientCounts.ruim} color="red" />
                      </div>
                      {gestor.churnCount > 0 && (
                        <div className="flex items-center gap-1 text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1 shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="text-xs font-bold">{gestor.churnCount}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* ──── COLUNA DIREITA: Alertas + Equipe ──── */}
          <div className="col-span-3 flex flex-col gap-4 min-h-0">
            {/* Alertas / Problemas */}
            <Section
              title="Alertas"
              icon={<AlertTriangle className="w-4 h-4" />}
              color="amber"
              badge={problemsStats ? `${problemsStats.total}` : '0'}
              className="flex-1 min-h-0"
            >
              {problemsStats && problemsStats.total > 0 ? (
                <div className="space-y-2 overflow-auto pr-1">
                  {problemsStats.topChallenges.slice(0, 4).map((challenge, index) => (
                    <div
                      key={challenge.text}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-amber-50 border border-amber-100"
                    >
                      <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-700 truncate">{challenge.text}</span>
                      <span className="text-sm font-bold text-amber-600 shrink-0">{challenge.count}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                  <CheckCircle2 className="w-10 h-10 mb-2 text-emerald-400" />
                  <p className="text-sm font-medium">Nenhum problema</p>
                </div>
              )}
            </Section>

            {/* Tarefas Atrasadas por Pessoa */}
            <Section
              title="Mais Atrasados"
              icon={<ArrowDown className="w-4 h-4" />}
              color="red"
              className="flex-1 min-h-0"
            >
              {topDelayed.length > 0 ? (
                <div className="space-y-2 overflow-auto pr-1">
                  {topDelayed.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-red-50 border border-red-100"
                    >
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600 overflow-hidden shrink-0">
                        {person.avatar ? (
                          <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                        ) : (
                          person.name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{person.name}</p>
                        <p className="text-xs text-gray-400">{ROLE_LABELS[person.role as keyof typeof ROLE_LABELS] || person.role}</p>
                      </div>
                      <div className="flex items-center gap-1 bg-red-200/60 text-red-700 rounded-lg px-2.5 py-1 shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="text-sm font-bold">{person.delayedTasks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                  <CheckCircle2 className="w-10 h-10 mb-2 text-emerald-400" />
                  <p className="text-sm font-medium">Sem atrasos</p>
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

// ════════════════════════════════════════════════
// COMPONENTES AUXILIARES (inline no mesmo arquivo)
// ════════════════════════════════════════════════

const COLOR_MAP = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', icon: 'bg-blue-100 text-blue-600', header: 'text-blue-700' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', icon: 'bg-amber-100 text-amber-600', header: 'text-amber-700' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', icon: 'bg-emerald-100 text-emerald-600', header: 'text-emerald-700' },
  red: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600', icon: 'bg-red-100 text-red-600', header: 'text-red-700' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-600', icon: 'bg-violet-100 text-violet-600', header: 'text-violet-700' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', icon: 'bg-rose-100 text-rose-600', header: 'text-rose-700' },
  sky: { bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-600', icon: 'bg-sky-100 text-sky-600', header: 'text-sky-700' },
} as const;

type ColorKey = keyof typeof COLOR_MAP;

function KPICard({ label, value, icon, color, alert }: {
  label: string; value: number; icon: React.ReactNode; color: ColorKey; alert?: boolean;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={cn(
      "rounded-xl border p-3 flex items-center gap-3",
      c.bg, c.border,
      alert && "ring-2 ring-red-300 animate-pulse"
    )}>
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", c.icon)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900 leading-none tabular-nums">{value}</p>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Section({ title, icon, color, badge, children, className }: {
  title: string; icon: React.ReactNode; color: ColorKey; badge?: string; children: React.ReactNode; className?: string;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white flex flex-col overflow-hidden shadow-sm", className)}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 shrink-0">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", c.icon)}>
          {icon}
        </div>
        <h3 className={cn("font-bold text-sm uppercase tracking-wide", c.header)}>
          {title}
        </h3>
        {badge && (
          <span className={cn("ml-auto text-xs font-bold px-2 py-0.5 rounded-full", c.bg, c.text)}>
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1 p-3 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}

function ClientLabelChip({ label, count, color }: { label: string; count: number; color: ColorKey }) {
  const c = COLOR_MAP[color];
  return (
    <div className={cn("rounded-lg border p-2 text-center", c.bg, c.border)}>
      <p className={cn("text-xl font-extrabold tabular-nums", c.text)}>{count}</p>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function MiniPill({ value, color }: { value: number; color: ColorKey }) {
  const c = COLOR_MAP[color];
  return (
    <span className={cn(
      "inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold",
      c.bg, c.text, c.border, "border"
    )}>
      {value}
    </span>
  );
}
