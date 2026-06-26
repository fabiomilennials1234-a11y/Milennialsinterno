import type { IssueStatus } from './issueSystem';

// ---------------------------------------------------------------------------
// Sprint lifecycle — pure display/preview helpers (#161).
//
// SCOPE: the authoritative sprint mutations live in the DB RPCs
// (tech_start_sprint snapshots committed points; tech_close_sprint partitions
// DONE vs not-DONE). These functions are the CLIENT-SIDE re-encoding of the
// same arithmetic, used purely for display: the commitment bar (committed /
// done / planned) and the close-modal counts. No React, no Supabase — unit
// testable in isolation, same discipline as lib/workflow.ts.
//
// `null` story points always count as 0 (an unestimated issue contributes
// nothing to a total), matching the DB's coalesce(sum(story_points), 0).
// ---------------------------------------------------------------------------

interface PointsLike {
  storyPoints: number | null;
}

interface StatusLike {
  status: IssueStatus;
}

function sumPoints(issues: PointsLike[]): number {
  return issues.reduce((total, issue) => total + (issue.storyPoints ?? 0), 0);
}

/**
 * Committed points preview — the baseline a sprint would freeze on start.
 * Same arithmetic as `computePlannedPoints`; named separately because intent
 * diverges after start, when the DB snapshot freezes while planned stays live.
 */
export function computeCommittedPoints(issues: PointsLike[]): number {
  return sumPoints(issues);
}

/** Planned points — the live total currently scoped to the sprint. */
export function computePlannedPoints(issues: PointsLike[]): number {
  return sumPoints(issues);
}

/** Delivered points — sum of story points on DONE issues only. */
export function computeDonePoints(issues: (PointsLike & StatusLike)[]): number {
  return sumPoints(issues.filter((issue) => issue.status === 'DONE'));
}

/**
 * Split issues the way `tech_close_sprint` does: DONE issues are completed (they
 * stay on the sprint), everything else is incomplete (it dumps to backlog or
 * carries over). Preserves element identity and incoming order.
 */
export function partitionOnClose<T extends StatusLike>(
  issues: T[],
): { completed: T[]; incomplete: T[] } {
  const completed: T[] = [];
  const incomplete: T[] = [];
  for (const issue of issues) {
    if (issue.status === 'DONE') completed.push(issue);
    else incomplete.push(issue);
  }
  return { completed, incomplete };
}
