import { useEffect, useId, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// ---------------------------------------------------------------------------
// SprintVelocityChart (#163) — the team's throughput, sprint over sprint.
//
// Where the burndown (#162) is one sprint told as lines, velocity is the
// fleet of closed sprints told as bars. Reading, back to front (z-order, like
// the burndown's layered envelope):
//   1. committed ghost  — drawn ONLY as the SHORTFALL: a faint shelf sitting
//                          above the delivered bar, from the delivered height up
//                          to the commitment line. It is the gap between what
//                          the sprint promised and what it shipped, made literal.
//                          When a sprint meets or beats its commitment there is
//                          no shelf — the gold simply crosses the line.
//   2. committed cap    — a 1.5px rule at the committed height. The promise,
//                          marked crisply whether the bar fell short of it or
//                          punched through it.
//   3. delivered        — the star. Solid accent bars (a subtle top→bottom
//                          gradient for depth), the real Σ DONE per sprint.
//   4. rolling average  — a near-white trailing line laid over the bars: the
//                          smoothed truth the team actually quotes in planning.
//                          It reads ABOVE the gold because white on gold on
//                          near-black is the only line that survives the noise.
//
// The header restates the same story as figures, in the SprintCommitment
// vocabulary (uppercase micro-labels, mono tabular numerals): the velocity the
// team cites, how many sprints back it, and what the last sprint actually shipped.
//
// Pure presentational. Every number arrives as a prop; the component never
// fetches, never knows about Supabase. The engineer feeds `series`.
// ---------------------------------------------------------------------------

export interface VelocityPoint {
  /** Stable identity for the sprint (React key, not rendered). */
  sprintId: string;
  /** Sprint label — X-axis category + tooltip title. */
  name: string;
  /** committed_points_snapshot — the promise. Drawn as a reference cap/ghost. */
  committed: number;
  /** Points delivered (Σ DONE) — the gold bar. */
  delivered: number;
  /** Trailing rolling average — the line laid over the bars. */
  rollingAverage: number;
}

export interface VelocitySeries {
  /** Closed sprints, oldest → newest. */
  points: VelocityPoint[];
  /** Trailing average of the last N sprints — the number the team quotes. */
  averageVelocity: number;
  /** Window used for the rolling/trailing average (e.g. 3). */
  window: number;
  /** How many closed sprints back the average. */
  sprintCount: number;
}

export interface SprintVelocityChartProps {
  series: VelocitySeries;
  className?: string;
}

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]';

function ptsLabel(n: number): string {
  return n === 1 ? 'pt' : 'pts';
}

/** Integers stay clean; fractional averages show a single decimal. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Custom tooltip — dark, mono, only the series present on the hovered sprint.
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
  delivered: { label: 'Entregue', color: 'var(--mtech-accent)' },
  rollingAverage: { label: 'Média móvel', color: 'var(--mtech-text)' },
  committed: { label: 'Comprometido', color: 'var(--mtech-text-subtle)' },
};

const TOOLTIP_ORDER = ['delivered', 'rollingAverage', 'committed'] as const;

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
          {label}
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
                {fmt(byKey.get(key) as number)}
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
  divider = false,
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: 'neutral' | 'success' | 'accent';
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
          {fmt(value)}
        </span>
        {unit && <span className="text-[11px] text-[var(--mtech-text-subtle)]">{unit}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bespoke bar — delivered (animated, gradient) + committed ghost/cap, drawn
// as one shape so the promise and the delivery share a pixel-perfect baseline.
//
// `background` carries the full plot band (0 → yMax in pixels); we map the
// committed value onto it. `y`/`height` are the recharts-animated geometry of
// the DELIVERED value, so the gold bar still draws in on mount.
// ---------------------------------------------------------------------------

interface SprintBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  yMax?: number;
  fillId?: string;
  background?: { x?: number; y?: number; width?: number; height?: number };
  payload?: VelocityPoint;
}

function SprintBar({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  yMax = 1,
  fillId,
  background,
  payload,
}: SprintBarProps) {
  if (!payload || width <= 0) return null;

  const bandTop = background?.y ?? y;
  const bandHeight = background?.height ?? height;
  const baseline = bandTop + bandHeight;
  const safeMax = yMax > 0 ? yMax : 1;
  const yFor = (v: number) => baseline - (Math.max(0, v) / safeMax) * bandHeight;

  // Narrow, centered bar — generous air between sprints (Linear density).
  const bw = Math.min(width * 0.62, 34);
  const bx = x + (width - bw) / 2;
  const radius = Math.min(3, bw / 2);

  const committedY = yFor(payload.committed);
  const deliveredTop = payload.delivered > 0 ? y : baseline;
  const deliveredHeight = payload.delivered > 0 ? height : 0;

  const shortfall = payload.committed > payload.delivered;
  const hasCap = payload.committed > 0;
  // Cap reads ON the gold when the bar punched through the promise → dark
  // hairline; reads above the bar on a shortfall → subtle light rule.
  const capColor = shortfall ? 'var(--mtech-text-subtle)' : 'var(--mtech-bg)';
  const capOpacity = shortfall ? 0.9 : 0.4;

  return (
    <g>
      {/* 1 · committed ghost — only the shortfall shelf, above the delivery */}
      {shortfall && (
        <rect
          x={bx}
          y={committedY}
          width={bw}
          height={Math.max(0, deliveredTop - committedY)}
          rx={radius}
          fill="var(--mtech-text-muted)"
          fillOpacity={0.07}
        />
      )}

      {/* 3 · delivered — the star, recharts-animated gradient bar */}
      {deliveredHeight > 0 && (
        <rect
          x={bx}
          y={deliveredTop}
          width={bw}
          height={deliveredHeight}
          rx={radius}
          fill={fillId ? `url(#${fillId})` : 'var(--mtech-accent)'}
        />
      )}

      {/* 2 · committed cap — the promise line, crisp in both cases */}
      {hasCap && (
        <line
          x1={bx}
          x2={bx + bw}
          y1={committedY}
          y2={committedY}
          stroke={capColor}
          strokeOpacity={capOpacity}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Empty — no closed sprints yet. Honest copy, no full stop, points forward.
// ---------------------------------------------------------------------------

function VelocityEmpty() {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-3 text-center">
      <BarChart3 className="h-9 w-9 text-[var(--mtech-text-subtle)] opacity-40" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm text-[var(--mtech-text-muted)]">Sem velocity ainda</p>
        <p className="max-w-[280px] text-xs text-[var(--mtech-text-subtle)]">
          A velocity aparece após o primeiro sprint concluído — uma barra por sprint, com a média
          móvel sobreposta
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SprintVelocityChart({ series, className = '' }: SprintVelocityChartProps) {
  const { points, averageVelocity, window: avgWindow, sprintCount } = series;

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

  const isEmpty = points.length === 0;
  const lastDelivered = points.length > 0 ? points[points.length - 1].delivered : 0;

  // Y ceiling with headroom, rounded to a clean multiple — committed can sit
  // above delivered, so it has to be in the running for the max.
  const yMax = useMemo(() => {
    let max = 0;
    for (const p of points) {
      max = Math.max(max, p.committed, p.delivered, p.rollingAverage);
    }
    const padded = Math.ceil((max * 1.12) / 5) * 5;
    return Math.max(padded, 5);
  }, [points]);

  return (
    <section
      className={`rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] ${className}`}
      aria-label={`Velocity por sprint: média de ${fmt(averageVelocity)} pontos sobre ${avgWindow} ${
        avgWindow === 1 ? 'sprint' : 'sprints'
      }, ${sprintCount} ${sprintCount === 1 ? 'sprint' : 'sprints'} concluídos${
        points.length > 0 ? `, último entregou ${lastDelivered} pontos` : ''
      }`}
    >
      {/* Header — the velocity story as figures */}
      <header className="flex flex-wrap items-start justify-between gap-4 px-4 pt-4">
        <div className="flex flex-col gap-0.5">
          <span className={LABEL_CLS}>Velocity</span>
          <span className="text-[13px] text-[var(--mtech-text-muted)]">
            Pontos entregues por sprint
          </span>
        </div>

        <div className="flex items-start gap-4">
          <StatCell label="Velocity média" value={averageVelocity} unit={ptsLabel(averageVelocity)} tone="accent" />
          <StatCell label="Sprints" value={sprintCount} divider />
          <StatCell label="Última" value={lastDelivered} unit={ptsLabel(lastDelivered)} divider />
        </div>
      </header>

      {/* Chart body */}
      <div className="px-2 pb-3 pt-4">
        {isEmpty ? (
          <VelocityEmpty />
        ) : (
          <div className="h-[240px] w-full" role="img" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={{ top: 8, right: 14, bottom: 4, left: -8 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--mtech-accent)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--mtech-accent)" stopOpacity={0.55} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="var(--mtech-border)" vertical={false} />

                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--mtech-text-subtle)' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={8}
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
                  cursor={{ fill: 'var(--mtech-border)', fillOpacity: 0.25 }}
                />

                {/* delivered + committed reference, one bespoke shape */}
                <Bar
                  dataKey="delivered"
                  background={{ fill: 'transparent' }}
                  shape={<SprintBar yMax={yMax} fillId={gradientId} />}
                  isAnimationActive={!reduceMotion}
                  animationDuration={460}
                />

                {/* rolling average — the smoothed truth, over the bars */}
                <Line
                  type="monotone"
                  dataKey="rollingAverage"
                  stroke="var(--mtech-text)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 3.5,
                    fill: 'var(--mtech-text)',
                    stroke: 'var(--mtech-bg)',
                    strokeWidth: 2,
                  }}
                  isAnimationActive={!reduceMotion}
                  animationDuration={560}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
