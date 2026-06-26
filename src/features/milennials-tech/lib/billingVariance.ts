import {
  computeIssueEstimates,
  type EstimateIssue,
  type IssueEstimate,
  type ComputeIssueEstimatesOptions,
} from './estimateVsActual';

// ---------------------------------------------------------------------------
// billingVariance (#164) — PURE display derive on top of the canonical
// estimate × actual base (#160).
//
// estimateVsActual is the source of truth: estimated = story_points (top-level
// only), real = timer seconds. This layer adds ONLY the billing-report display
// fields that base intentionally does not carry, so the canonical contract stays
// single-owner and this file never re-derives estimate/real itself:
//
//   • realHours        — realSeconds in hours, for a money-shaped read.
//   • secondsPerPoint  — measured cost per estimated point (realSeconds /
//                        estimatedPoints). This is the ONLY honest cross of the
//                        two units: points and hours have NO canonical
//                        conversion, so we never invent a points→hours factor —
//                        we report how many seconds each estimated point cost.
//   • unestimated      — true when the issue carries no estimate (null or ≤0
//                        points). secondsPerPoint is null for these (can't divide
//                        by a missing estimate); the UI flags them as "não
//                        estimado" rather than charting a fake ratio.
//
// Variance is all-time / per-issue / per-project — NOT period-clipped. Story
// points are not time-bound, so clipping the real side to a billing window would
// pair a full estimate against partial effort and read as a phantom overrun. The
// period-clipped read is tech_billing_hours' job; this is the estimate scorecard.
// ---------------------------------------------------------------------------

const SECONDS_PER_HOUR = 3600;

function secondsPerPoint(realSeconds: number, estimatedPoints: number | null): number | null {
  if (estimatedPoints == null || estimatedPoints <= 0) return null;
  return realSeconds / estimatedPoints;
}

/** Per-issue billing variance row — base estimate paired with display derives. */
export interface IssueVariance {
  issueId: string;
  projectId: string;
  /** Story points, or `null` when unestimated. */
  estimatedPoints: number | null;
  realSeconds: number;
  realHours: number;
  /** Measured seconds per estimated point; `null` when unestimated. */
  secondsPerPoint: number | null;
  /** True when the issue has no usable estimate (null or ≤0 points). */
  unestimated: boolean;
}

/** Project-level billing variance — summed estimate vs measured effort. */
export interface ProjectVariance {
  projectId: string;
  /** Σ estimatedPoints across the project's issues (nulls ignored). */
  totalPoints: number;
  totalSeconds: number;
  totalHours: number;
  /** Number of issues counted. */
  issueCount: number;
  /** Issues in the project with no usable estimate. */
  unestimatedCount: number;
  /** Project-level seconds per point (totalSeconds / totalPoints); `null` when no points. */
  secondsPerPoint: number | null;
}

export function computeIssueVariance(
  estimates: ReadonlyArray<IssueEstimate>,
): IssueVariance[] {
  return estimates.map((e): IssueVariance => {
    const unestimated = e.estimatedPoints == null || e.estimatedPoints <= 0;
    return {
      issueId: e.issueId,
      projectId: e.projectId,
      estimatedPoints: e.estimatedPoints,
      realSeconds: e.realSeconds,
      realHours: e.realSeconds / SECONDS_PER_HOUR,
      secondsPerPoint: secondsPerPoint(e.realSeconds, e.estimatedPoints),
      unestimated,
    };
  });
}

export function computeProjectVariance(
  issues: ReadonlyArray<IssueVariance>,
): ProjectVariance[] {
  const byProject = new Map<string, ProjectVariance>();

  for (const i of issues) {
    let acc = byProject.get(i.projectId);
    if (!acc) {
      acc = {
        projectId: i.projectId,
        totalPoints: 0,
        totalSeconds: 0,
        totalHours: 0,
        issueCount: 0,
        unestimatedCount: 0,
        secondsPerPoint: null,
      };
      byProject.set(i.projectId, acc);
    }
    acc.totalPoints += i.estimatedPoints ?? 0;
    acc.totalSeconds += i.realSeconds;
    acc.issueCount += 1;
    if (i.unestimated) acc.unestimatedCount += 1;
  }

  for (const acc of byProject.values()) {
    acc.totalHours = acc.totalSeconds / SECONDS_PER_HOUR;
    acc.secondsPerPoint = secondsPerPoint(acc.totalSeconds, acc.totalPoints > 0 ? acc.totalPoints : null);
  }

  return Array.from(byProject.values());
}

/**
 * One-shot derive: minimal issue subset + timer map -> per-issue and per-project
 * billing variance. Composes the canonical base (computeIssueEstimates) so the
 * estimate/real definition is never duplicated here.
 */
export function buildBillingVariance(
  issues: ReadonlyArray<EstimateIssue>,
  timeTotals: Record<string, number>,
  options?: ComputeIssueEstimatesOptions,
): { issues: IssueVariance[]; projects: ProjectVariance[] } {
  const estimates = computeIssueEstimates(issues, timeTotals, options);
  const issueVariance = computeIssueVariance(estimates);
  return { issues: issueVariance, projects: computeProjectVariance(issueVariance) };
}
