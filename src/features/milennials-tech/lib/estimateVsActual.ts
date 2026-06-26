import type { StoryPointValue } from './issueSystem';

// ---------------------------------------------------------------------------
// estimate × actual (#160) — PURE base for the estimated-vs-real report.
//
// Estimated = an issue's story_points (top-level only; sub-tasks never point —
// DB CHECK tech_tasks_subtask_no_points_no_epic enforces it upstream).
// Real = timer seconds, sourced from useTechTimeTotals -> Record<task_id, sec>.
//
// No React, no Supabase: feed it the minimal subset and a time map. The report
// surface (deferred) consumes the rollup. Mirrors rollup.ts conventions (#158).
// ---------------------------------------------------------------------------

/** Minimal issue subset this lib needs — NOT the full BacklogIssue. */
export interface EstimateIssue {
  id: string;
  projectId: string;
  /** Story points; `null` = unestimated. Preserved (not coerced to 0) per-issue. */
  storyPoints: StoryPointValue | number | null;
}

/** Per-issue estimate paired with its measured timer effort. */
export interface IssueEstimate {
  issueId: string;
  projectId: string;
  /** Story points, or `null` when unestimated. */
  estimatedPoints: number | null;
  /** Total timer seconds attributed to the issue (0 when no timer entry). */
  realSeconds: number;
}

export interface ComputeIssueEstimatesOptions {
  /**
   * Map of parent issue id -> its sub-task ids. When provided, each issue's
   * realSeconds folds in its sub-tasks' timer seconds (sub-task time rolls up to
   * the parent). Omit for direct-time-only — the minimal, default behaviour.
   */
  childrenByParent?: Record<string, readonly string[]>;
}

/** Project-level aggregation of estimated points vs measured seconds. */
export interface ProjectEstimateRollup {
  projectId: string;
  /** Sum of estimatedPoints across the project's issues (nulls ignored). */
  totalPoints: number;
  /** Sum of realSeconds across the project's issues. */
  totalSeconds: number;
  /** Number of issues counted for this project. */
  issueCount: number;
}

export function computeIssueEstimates(
  issues: ReadonlyArray<EstimateIssue>,
  timeTotals: Record<string, number>,
  options: ComputeIssueEstimatesOptions = {},
): IssueEstimate[] {
  const { childrenByParent } = options;

  return issues.map((issue): IssueEstimate => {
    let realSeconds = timeTotals[issue.id] ?? 0;

    const children = childrenByParent?.[issue.id];
    if (children) {
      for (const childId of children) {
        realSeconds += timeTotals[childId] ?? 0;
      }
    }

    return {
      issueId: issue.id,
      projectId: issue.projectId,
      estimatedPoints: issue.storyPoints ?? null,
      realSeconds,
    };
  });
}

export function computeProjectEstimateRollup(
  estimates: ReadonlyArray<IssueEstimate>,
): ProjectEstimateRollup[] {
  const byProject = new Map<string, ProjectEstimateRollup>();

  for (const e of estimates) {
    let acc = byProject.get(e.projectId);
    if (!acc) {
      acc = { projectId: e.projectId, totalPoints: 0, totalSeconds: 0, issueCount: 0 };
      byProject.set(e.projectId, acc);
    }
    acc.totalPoints += e.estimatedPoints ?? 0;
    acc.totalSeconds += e.realSeconds;
    acc.issueCount += 1;
  }

  return Array.from(byProject.values());
}
