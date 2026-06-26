// ---------------------------------------------------------------------------
// Team load distribution (#165) — PURE arithmetic, no React, no Supabase.
//
// tech_team_current_load() returns one row per dev with open_issues/open_points
// on the ACTIVE sprint, already ordered open_points DESC. This module layers the
// HONEST overload signal on top: a real median, and a per-dev overload flag that
// only fires when the signal is statistically meaningful.
//
//   median — the true median of open_points across devs. Even count → the mean
//            of the two central values (never a silent floor that lies low).
//   isOverloaded — open_points strictly above the median, AND devCount ≥ 3, AND
//            open_points > 0. Below 3 devs a median is noise (with 2 devs the
//            heavier one is ALWAYS "above median"), so we refuse to cry overload
//            on insufficient signal — every flag is false. A dev at exactly the
//            median is balanced, not overloaded. Zero-load devs are never flagged.
//   isPeak — the single heaviest dev (top of the DESC order) when they carry any
//            load. It marks the bar to highlight, distinct from overload: the
//            peak exists even with < 3 devs; overload requires the quorum. Ties
//            at the top resolve to the first row (deterministic under the RPC's
//            DESC + the input order) — one peak, never two.
//
// Rows are re-sorted defensively by open_points DESC so a mis-fed feed can't
// misplace the peak or scramble the display order.
// ---------------------------------------------------------------------------

export interface TeamLoadRow {
  assignee_id: string;
  open_issues: number;
  open_points: number;
}

export interface DevLoad {
  assignee_id: string;
  open_issues: number;
  open_points: number;
  isOverloaded: boolean;
  isPeak: boolean;
}

export interface LoadDistribution {
  devs: DevLoad[];
  median: number;
  devCount: number;
}

const MIN_DEVS_FOR_OVERLOAD = 3;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeLoadDistribution(rows: TeamLoadRow[]): LoadDistribution {
  const devCount = rows.length;

  if (devCount === 0) {
    return { devs: [], median: 0, devCount: 0 };
  }

  const ordered = [...rows].sort((a, b) => b.open_points - a.open_points);
  const med = median(ordered.map((r) => r.open_points));
  const overloadEligible = devCount >= MIN_DEVS_FOR_OVERLOAD;
  const peakPoints = ordered[0].open_points;

  const devs: DevLoad[] = ordered.map((r, index) => ({
    assignee_id: r.assignee_id,
    open_issues: r.open_issues,
    open_points: r.open_points,
    isOverloaded: overloadEligible && r.open_points > med && r.open_points > 0,
    isPeak: index === 0 && peakPoints > 0,
  }));

  return { devs, median: med, devCount };
}
