// ---------------------------------------------------------------------------
// SprintCommitment (#161) — the points compromise, read at a glance.
//
// Two readings of the same sprint, switched by lifecycle:
//   PLANNING  — no commitment yet. Shows the *planned* sum (live story points
//               of every issue currently in the sprint) and tells the reader
//               that this number freezes into a commitment when the sprint
//               starts. Honest about being provisional.
//   ACTIVE /  — the commitment exists (snapshot at start). Shows delivered vs
//   COMPLETED   committed as "done / committed pts" plus a progress rail. When
//               the commitment is fully delivered the rail turns success-green;
//               until then it carries the accent.
//
// Compact by design — this lives in the sprint header beside the title, so it
// never grows taller than a couple of lines. Numbers are mono + tabular so the
// figure stays rock-steady as it ticks up.
//
// Pure presentational. Every number arrives as a prop.
// ---------------------------------------------------------------------------

export interface SprintCommitmentProps {
  /** Snapshot taken when the sprint started. null before start → "estimado". */
  committedPoints: number | null;
  /** Sum of story points of DONE issues in the sprint. */
  donePoints: number;
  /** Live sum of story points across every issue in the sprint (pre-start). */
  plannedPoints: number;
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED';
}

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]';

function pts(n: number): string {
  return n === 1 ? '1 pt' : `${n} pts`;
}

export function SprintCommitment({
  committedPoints,
  donePoints,
  plannedPoints,
  status,
}: SprintCommitmentProps) {
  // ---- PLANNING: provisional plan, no rail. -------------------------------
  if (status === 'PLANNING') {
    return (
      <div className="flex min-w-[150px] flex-col gap-1">
        <span className={LABEL_CLS}>Planejado</span>
        <div className="flex items-baseline gap-1.5">
          <span
            data-mono
            className="text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--mtech-text)]"
          >
            {plannedPoints}
          </span>
          <span className="text-[12px] text-[var(--mtech-text-muted)]">
            {plannedPoints === 1 ? 'pt' : 'pts'}
          </span>
        </div>
        <span className="text-[10px] text-[var(--mtech-text-subtle)]">
          Vira compromisso ao iniciar o sprint
        </span>
      </div>
    );
  }

  // ---- ACTIVE / COMPLETED: delivered vs commitment. -----------------------
  // committedPoints should be set once the sprint is active; fall back to the
  // planned figure (flagged "estimado") if a snapshot is somehow missing.
  const isEstimated = committedPoints == null;
  const commitment = committedPoints ?? plannedPoints;

  const ratio = commitment > 0 ? donePoints / commitment : 0;
  const pct = Math.round(ratio * 100);
  const fillWidth = `${Math.min(100, Math.max(0, ratio * 100))}%`;

  const isComplete = commitment > 0 && donePoints >= commitment;
  const railColor = isComplete ? 'var(--mtech-success)' : 'var(--mtech-accent)';

  return (
    <div className="flex min-w-[180px] flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={LABEL_CLS}>{isEstimated ? 'Entrega · estimado' : 'Entrega'}</span>
        <span
          data-mono
          className="text-[11px] tabular-nums"
          style={{ color: isComplete ? 'var(--mtech-success)' : 'var(--mtech-text-muted)' }}
        >
          {pct}%
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          data-mono
          className="text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--mtech-text)]"
        >
          {donePoints}
        </span>
        <span className="text-[13px] text-[var(--mtech-text-subtle)]">
          / {pts(commitment)}
        </span>
      </div>

      <div
        className="relative h-1.5 overflow-hidden rounded-full bg-[var(--mtech-surface-elev)]"
        role="progressbar"
        aria-valuenow={donePoints}
        aria-valuemin={0}
        aria-valuemax={commitment}
        aria-label={`${donePoints} de ${commitment} pontos entregues`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: fillWidth, backgroundColor: railColor }}
        />
      </div>
    </div>
  );
}
