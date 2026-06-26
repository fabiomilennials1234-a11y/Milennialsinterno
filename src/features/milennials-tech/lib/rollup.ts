import type { IssueStatus } from './issueSystem';

// ---------------------------------------------------------------------------
// Epic rollup (#158) — PURE aggregation of an epic's child issues.
//
// PROGRESS DECISION: progressPct is COUNT-based (doneCount / issueCount), per
// the AC "% progresso (DONE/total)". It is NOT weighted by story points. Point
// totals (totalPoints / donePoints) are exposed separately for the points
// display so the UI can show both without conflating the two metrics.
//
// TOP-LEVEL ONLY: sub-tasks (parent_id != null) are excluded from EVERYTHING —
// the points sums, the done count, and the progress denominator. The DB already
// enforces "sub-task has no points and no epic" via the
// tech_tasks_subtask_no_points_no_epic CHECK; this filter is defense in depth so
// the rollup is correct even if a stray sub-task reaches this function.
// ---------------------------------------------------------------------------

export interface RollupIssue {
  parent_id: string | null;
  story_points: number | null;
  status: IssueStatus;
}

export interface EpicRollup {
  totalPoints: number;
  donePoints: number;
  progressPct: number;
  issueCount: number;
  doneCount: number;
}

export function computeEpicRollup(issues: ReadonlyArray<RollupIssue>): EpicRollup {
  let totalPoints = 0;
  let donePoints = 0;
  let issueCount = 0;
  let doneCount = 0;

  for (const issue of issues) {
    if (issue.parent_id != null) continue; // sub-task — excluded from all metrics

    const points = issue.story_points ?? 0;
    const isDone = issue.status === 'DONE';

    issueCount += 1;
    totalPoints += points;
    if (isDone) {
      doneCount += 1;
      donePoints += points;
    }
  }

  const progressPct = issueCount === 0 ? 0 : Math.round((doneCount / issueCount) * 100);

  return { totalPoints, donePoints, progressPct, issueCount, doneCount };
}
