// ---------------------------------------------------------------------------
// Velocity series (#163) — PURE arithmetic, no React, no Supabase.
//
// Where the burndown (#162) is one sprint folded over its calendar, velocity is
// the fleet of CLOSED sprints folded into one bar each, oldest → newest, with a
// trailing rolling average laid over them.
//
//   delivered — Σ DONE parent points for the sprint. The SAME definition the
//               burndown delivers (#162): scope-added work counts, sub-tasks and
//               non-DONE never do, null story_points → 0. The RPC computes it;
//               this module only receives it per sprint and never re-derives it.
//   committed — committed_points_snapshot, the frozen promise. Drawn as a cap.
//   rolling   — average of delivered over the trailing window [i-window+1 .. i],
//               partial at the head (uses what exists). ALWAYS defined — the chart
//               draws a monotone line that does not tolerate gaps.
//
// averageVelocity is the rolling average of the LAST sprint — the trailing-N
// number the team quotes in planning. `window` is the EFFECTIVE window: clamped
// to the number of sprints available, so the chart can honestly say "média sobre
// N sprints" instead of claiming a window it never had.
//
// The RPC already orders by closed_at ASC; we re-sort defensively so a mis-fed
// series can never warp the rolling window or mislabel the bars.
// ---------------------------------------------------------------------------

export interface VelocitySprintInput {
  sprintId: string;
  name: string;
  committedPoints: number;
  deliveredPoints: number;
  /** closed_at — ISO timestamp. Sort key, oldest → newest. */
  closedAt: string;
}

export interface VelocityPoint {
  sprintId: string;
  name: string;
  committed: number;
  delivered: number;
  rollingAverage: number;
}

export interface VelocitySeries {
  points: VelocityPoint[];
  averageVelocity: number;
  window: number;
  sprintCount: number;
}

const DEFAULT_WINDOW = 3;

/** One decimal, the precision the chart formats to. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeVelocity(
  sprints: VelocitySprintInput[],
  window: number = DEFAULT_WINDOW,
): VelocitySeries {
  const effectiveWindow = Math.min(window, sprints.length);

  if (sprints.length === 0) {
    return { points: [], averageVelocity: 0, window: effectiveWindow, sprintCount: 0 };
  }

  const ordered = [...sprints].sort((a, b) =>
    a.closedAt < b.closedAt ? -1 : a.closedAt > b.closedAt ? 1 : 0,
  );

  const points: VelocityPoint[] = ordered.map((s, index) => {
    const from = Math.max(0, index - window + 1);
    let sum = 0;
    for (let i = from; i <= index; i += 1) sum += ordered[i].deliveredPoints;
    const rollingAverage = round1(sum / (index - from + 1));

    return {
      sprintId: s.sprintId,
      name: s.name,
      committed: s.committedPoints,
      delivered: s.deliveredPoints,
      rollingAverage,
    };
  });

  return {
    points,
    averageVelocity: points[points.length - 1].rollingAverage,
    window: effectiveWindow,
    sprintCount: points.length,
  };
}
