// ---------------------------------------------------------------------------
// Team throughput (#165) — PURE arithmetic, no React, no Supabase.
//
// tech_team_throughput() returns a FLAT stream: one row per (dev × closed
// sprint), already aggregated server-side (issues_closed, points_closed) under
// the #162 delivered contract. This module folds that flat stream into one
// series per developer — the shape a per-dev sparkline consumes: a totals
// headline plus the sprint-by-sprint trail, oldest → newest.
//
//   perSprint — the dev's closed sprints in closed_at ASC order, so the
//               sparkline reads left → right without a client sort. The RPC
//               already orders ASC; we re-sort defensively so a mis-fed stream
//               can never warp the trail.
//   totals    — Σ over the dev's sprints. These sum, across devs, back to the
//               velocity team bar (#163) because both rest on the same
//               delivered definition.
//
// Devs are ordered heaviest-first by totalPoints (the report leads with the
// biggest contributor), tie-broken by assigneeId for a stable, deterministic
// order the UI can rely on. Name/avatar are NOT here — the RPC exposes only
// assigneeId; the component resolves identity via profiles, same as velocity.
// ---------------------------------------------------------------------------

export interface TeamThroughputRow {
  assignee_id: string;
  sprint_id: string;
  sprint_name: string;
  closed_at: string;
  issues_closed: number;
  points_closed: number;
}

export interface DevSprintThroughput {
  sprintId: string;
  sprintName: string;
  /** closed_at — ISO timestamp. Sort key, oldest → newest. */
  closedAt: string;
  issues: number;
  points: number;
}

export interface DevThroughput {
  assigneeId: string;
  totalIssues: number;
  totalPoints: number;
  perSprint: DevSprintThroughput[];
}

function ascByClosedAt(a: DevSprintThroughput, b: DevSprintThroughput): number {
  return a.closedAt < b.closedAt ? -1 : a.closedAt > b.closedAt ? 1 : 0;
}

export function computeTeamThroughput(rows: TeamThroughputRow[]): DevThroughput[] {
  const byDev = new Map<string, DevThroughput>();

  for (const row of rows) {
    let dev = byDev.get(row.assignee_id);
    if (!dev) {
      dev = { assigneeId: row.assignee_id, totalIssues: 0, totalPoints: 0, perSprint: [] };
      byDev.set(row.assignee_id, dev);
    }
    dev.totalIssues += row.issues_closed;
    dev.totalPoints += row.points_closed;
    dev.perSprint.push({
      sprintId: row.sprint_id,
      sprintName: row.sprint_name,
      closedAt: row.closed_at,
      issues: row.issues_closed,
      points: row.points_closed,
    });
  }

  const devs = [...byDev.values()];
  for (const dev of devs) dev.perSprint.sort(ascByClosedAt);

  devs.sort((a, b) =>
    b.totalPoints - a.totalPoints || (a.assigneeId < b.assigneeId ? -1 : a.assigneeId > b.assigneeId ? 1 : 0),
  );

  return devs;
}
