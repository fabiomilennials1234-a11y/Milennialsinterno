import type { DevSprintThroughput } from '../lib/teamThroughput';

// ---------------------------------------------------------------------------
// DevSparkline (#165) — a dev's points-per-sprint trail, left → newest.
//
// Hand-drawn SVG mini-bars, not a recharts instance: a report lists every dev,
// and a sparkline that is one <svg> of plain <rect>s stays crisp at row scale
// without dragging an axis/tooltip/responsive-container engine per row. The
// data already arrives closed_at ASC (teamThroughput), so the bars read time
// left → right with no client sort.
//
// The most recent sprint is the one the team is judged on, so it lands at full
// accent; the history behind it recedes to a faint gold. Heights are scaled to
// the dev's own peak — a within-dev shape (is this person trending up?), not a
// cross-dev comparison (that is the totals column's job). A floor of 2px keeps
// a real-but-small sprint visible instead of vanishing to a hairline.
// ---------------------------------------------------------------------------

export function DevSparkline({
  data,
  width = 88,
  height = 28,
  className,
}: {
  data: DevSprintThroughput[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const n = data.length;
  if (n === 0) return null;

  const gap = n > 12 ? 1.5 : 3;
  const max = Math.max(...data.map((d) => d.points), 1);
  const bw = (width - gap * (n - 1)) / n;
  const radius = Math.min(2, bw / 2);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Pontos por sprint, mais antigo ao mais recente: ${data
        .map((d) => d.points)
        .join(', ')}`}
    >
      {data.map((d, i) => {
        const isLast = i === n - 1;
        const barHeight = d.points > 0 ? Math.max((d.points / max) * height, 2) : 0;
        const x = i * (bw + gap);
        const y = height - barHeight;

        return (
          <rect
            key={d.sprintId}
            x={x}
            y={y}
            width={bw}
            height={barHeight}
            rx={radius}
            fill="var(--mtech-accent)"
            fillOpacity={isLast ? 0.95 : 0.4}
          >
            <title>{`${d.sprintName}: ${d.points} ${d.points === 1 ? 'pt' : 'pts'}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
