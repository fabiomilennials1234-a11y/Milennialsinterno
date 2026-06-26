// ---------------------------------------------------------------------------
// StoryPoints — Fibonacci estimate pill (1·2·3·5·8·13).
//
// `points === null` renders nothing by default (Jira hides unestimated cards),
// or a faint dash when `emptyAs="dash"` (useful in the backlog/estimation view
// where the gap itself is signal).
//
// Pure presentational. Engineer pairs against StoryPointsProps.
// ---------------------------------------------------------------------------

export interface StoryPointsProps {
  points: number | null | undefined;
  size?: 'sm' | 'md';
  /** How to render an unestimated value. Default: hidden. */
  emptyAs?: 'hidden' | 'dash';
  className?: string;
}

const SIZE = {
  sm: 'h-[18px] min-w-[18px] px-1 text-[10px]',
  md: 'h-5 min-w-5 px-1.5 text-[11px]',
} as const;

export function StoryPoints({
  points,
  size = 'md',
  emptyAs = 'hidden',
  className = '',
}: StoryPointsProps) {
  const empty = points === null || points === undefined;

  if (empty && emptyAs === 'hidden') return null;

  const label = empty ? 'Sem estimativa' : `${points} ${points === 1 ? 'ponto' : 'pontos'}`;

  return (
    <span
      data-mono
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-full border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] font-semibold tabular-nums text-[var(--mtech-text-muted)] select-none ${SIZE[size]} ${className}`}
    >
      {empty ? '–' : points}
    </span>
  );
}
