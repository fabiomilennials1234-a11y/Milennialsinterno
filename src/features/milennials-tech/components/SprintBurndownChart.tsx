import { useEffect, useId, useMemo, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// ---------------------------------------------------------------------------
// SprintBurndownChart (#162) — the sprint told as three lines.
//
// Reading, back to front (z-order matters here):
//   1. scope envelope  — a faint stepped area. Its ceiling is the *total* scope.
//                        When work is added mid-sprint the envelope STEPS UP, so
//                        scope creep is visible as a literal shelf in the chart,
//                        not buried in a number. type="stepAfter" keeps the step
//                        honest (the scope was that value *until* the add).
//   2. ideal           — the dashed plan: committed → 0 in a straight line. It
//                        recedes the most; it is the reference, not the story.
//   3. remaining       — the star. Solid accent, the real burn-down. It is null
//                        for days that haven't happened yet, so the line simply
//                        STOPS at today (connectNulls={false}) instead of lying
//                        its way down to zero in the future. A "hoje" guide marks
//                        where reality ends and the plan continues alone.
//
// The header restates the same three truths as figures, in the SprintCommitment
// vocabulary (uppercase micro-labels, mono tabular numerals): what was
// committed, what was delivered, and what crept in after the gun.
//
// Pure presentational. Every number arrives as a prop; the component never
// fetches, never knows about Supabase. The engineer feeds `series`.
// ---------------------------------------------------------------------------

export interface BurndownPoint {
  /** ISO day, e.g. "2026-06-25". X-axis category + tooltip title. */
  date: string;
  /** Ideal remaining for this day on the straight committed→0 line. */
  ideal: number;
  /** Actual remaining points. null for future days → the line stops at today. */
  remaining: number | null;
  /** Total scope (committed + adds) up to this day. null for future days. */
  scope: number | null;
}

export interface BurndownSeries {
  points: BurndownPoint[];
  /** Snapshot of scope at sprint start — the line everyone is judged against. */
  committedPoints: number;
  /** Points delivered (DONE) so far. */
  deliveredPoints: number;
  /** Points added after the sprint started — the scope creep. */
  addedPoints: number;
}

export interface SprintBurndownChartProps {
  series: BurndownSeries;
  className?: string;
}

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]';

function ptsLabel(n: number): string {
  return n === 1 ? 'pt' : 'pts';
}

/** Format an ISO-ish day string to dd/MM, defensively (no tz drift). */
function dayMonth(iso: string): string {
  const datePart = iso.split('T')[0];
  const segments = datePart.split('-');
  if (segments.length === 3) {
    const [, month, day] = segments;
    return `${day}/${month}`;
  }
  return iso;
}

// ---------------------------------------------------------------------------
// Custom tooltip — dark, mono, only the series present on the hovered day.
// ---------------------------------------------------------------------------

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | null;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

const SERIES_META: Record<string, { label: string; color: string }> = {
  remaining: { label: 'Restante', color: 'var(--mtech-accent)' },
  ideal: { label: 'Ideal', color: 'var(--mtech-text-subtle)' },
  scope: { label: 'Escopo', color: 'var(--mtech-text-muted)' },
};

const TOOLTIP_ORDER = ['remaining', 'ideal', 'scope'] as const;

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const byKey = new Map<string, number>();
  for (const entry of payload) {
    const key = typeof entry.dataKey === 'string' ? entry.dataKey : undefined;
    if (key && entry.value != null) byKey.set(key, entry.value);
  }
  if (byKey.size === 0) return null;

  return (
    <div
      data-mono
      className="rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-border-strong)] bg-[var(--mtech-surface-elev)] px-2.5 py-2 shadow-[var(--mtech-shadow-card)]"
    >
      {label != null && (
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--mtech-text-subtle)]">
          {dayMonth(label)}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {TOOLTIP_ORDER.filter((k) => byKey.has(k)).map((key) => {
          const meta = SERIES_META[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-[var(--mtech-text-muted)]">{meta.label}</span>
              </span>
              <span className="tabular-nums font-semibold text-[var(--mtech-text)]">
                {byKey.get(key)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header stat — one figure in the SprintCommitment vocabulary.
// ---------------------------------------------------------------------------

function StatCell({
  label,
  value,
  unit,
  tone = 'neutral',
  prefix,
  divider = false,
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: 'neutral' | 'success' | 'accent';
  prefix?: string;
  divider?: boolean;
}) {
  const valueColor =
    tone === 'success'
      ? 'var(--mtech-success)'
      : tone === 'accent'
        ? 'var(--mtech-accent)'
        : 'var(--mtech-text)';

  return (
    <div
      className={`flex flex-col gap-1 ${
        divider ? 'border-l border-[var(--mtech-border)] pl-4' : ''
      }`}
    >
      <span className={LABEL_CLS}>{label}</span>
      <div className="flex items-baseline gap-1">
        <span
          data-mono
          className="text-[19px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
          style={{ color: valueColor }}
        >
          {prefix}
          {value}
        </span>
        {unit && <span className="text-[11px] text-[var(--mtech-text-subtle)]">{unit}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / edge — no committed work, or no points yet.
// ---------------------------------------------------------------------------

function BurndownEmpty() {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-3 text-center">
      <TrendingDown className="h-9 w-9 text-[var(--mtech-text-subtle)] opacity-40" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--mtech-text-muted)]">Sem dados de burndown ainda</p>
        <p className="max-w-[260px] text-xs text-[var(--mtech-text-subtle)]">
          O gráfico aparece quando a sprint tiver pontos comprometidos e o primeiro dia for
          registrado
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SprintBurndownChart({ series, className = '' }: SprintBurndownChartProps) {
  const { points, committedPoints, deliveredPoints, addedPoints } = series;

  // Respect the user's motion preference — recharts animates draw-in by default.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const gradientId = useId();

  const isEmpty = points.length === 0 || committedPoints <= 0;
  const hasCreep = addedPoints > 0;
  const isComplete = committedPoints > 0 && deliveredPoints >= committedPoints;

  // The last day with real burn data — where "today" is, and where the
  // remaining line stops. Anchors the "hoje" guide rail.
  const todayDate = useMemo(() => {
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (points[i].remaining != null) return points[i].date;
    }
    return null;
  }, [points]);

  // Y ceiling with a little headroom, rounded to a clean multiple.
  const yMax = useMemo(() => {
    let max = committedPoints;
    for (const p of points) {
      if (p.scope != null) max = Math.max(max, p.scope);
      if (p.remaining != null) max = Math.max(max, p.remaining);
      max = Math.max(max, p.ideal);
    }
    const padded = Math.ceil((max * 1.08) / 5) * 5;
    return Math.max(padded, 5);
  }, [points, committedPoints]);

  return (
    <section
      className={`rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] ${className}`}
      aria-label={`Burndown da sprint: ${deliveredPoints} de ${committedPoints} pontos entregues${
        hasCreep ? `, ${addedPoints} adicionados após o início` : ''
      }`}
    >
      {/* Header — three truths as figures */}
      <header className="flex flex-wrap items-start justify-between gap-4 px-4 pt-4">
        <div className="flex flex-col gap-0.5">
          <span className={LABEL_CLS}>Burndown</span>
          <span className="text-[13px] text-[var(--mtech-text-muted)]">
            Pontos restantes ao longo da sprint
          </span>
        </div>

        <div className="flex items-start gap-4">
          <StatCell label="Comprometido" value={committedPoints} unit={ptsLabel(committedPoints)} />
          <StatCell
            label="Entregue"
            value={deliveredPoints}
            unit={ptsLabel(deliveredPoints)}
            tone={isComplete ? 'success' : 'neutral'}
            divider
          />
          <StatCell
            label="Escopo +"
            value={addedPoints}
            unit={ptsLabel(addedPoints)}
            tone={hasCreep ? 'accent' : 'neutral'}
            prefix={hasCreep ? '+' : undefined}
            divider
          />
        </div>
      </header>

      {/* Chart body */}
      <div className="px-2 pb-3 pt-4">
        {isEmpty ? (
          <BurndownEmpty />
        ) : (
          <div className="h-[240px] w-full" role="img" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 8, right: 14, bottom: 4, left: -8 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--mtech-text-muted)" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="var(--mtech-text-muted)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--mtech-border)"
                  vertical={false}
                />

                <XAxis
                  dataKey="date"
                  tickFormatter={dayMonth}
                  tick={{ fontSize: 10, fill: 'var(--mtech-text-subtle)' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
                  dy={4}
                />
                <YAxis
                  domain={[0, yMax]}
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'var(--mtech-text-subtle)' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />

                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'var(--mtech-border-strong)', strokeDasharray: '3 3' }}
                />

                {/* 1 · scope envelope — steps up on a mid-sprint add */}
                <Area
                  type="stepAfter"
                  dataKey="scope"
                  stroke="var(--mtech-text-muted)"
                  strokeWidth={1}
                  strokeOpacity={0.5}
                  fill={`url(#${gradientId})`}
                  connectNulls={false}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={!reduceMotion}
                  animationDuration={420}
                />

                {/* 2 · ideal — the dashed plan */}
                <Line
                  type="linear"
                  dataKey="ideal"
                  stroke="var(--mtech-text-subtle)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={!reduceMotion}
                  animationDuration={420}
                />

                {/* hoje — where reality ends, the plan walks on alone */}
                {todayDate && (
                  <ReferenceLine
                    x={todayDate}
                    stroke="var(--mtech-border-strong)"
                    strokeDasharray="2 3"
                    label={{
                      value: 'hoje',
                      position: 'top',
                      fontSize: 9,
                      fill: 'var(--mtech-text-subtle)',
                    }}
                  />
                )}

                {/* 3 · remaining — the star, stops at today */}
                <Line
                  type="linear"
                  dataKey="remaining"
                  stroke="var(--mtech-accent)"
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={false}
                  activeDot={{
                    r: 3.5,
                    fill: 'var(--mtech-accent)',
                    stroke: 'var(--mtech-bg)',
                    strokeWidth: 2,
                  }}
                  isAnimationActive={!reduceMotion}
                  animationDuration={520}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
