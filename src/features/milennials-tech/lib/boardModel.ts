import type { BacklogIssue } from '../components/backlogTypes';
import type { IssueCardData } from '../components/IssueCard';
import { BOARD_STATUS_ORDER, type IssueStatus } from './issueSystem';
import { toIssueCardData } from './issueCardAdapter';
import { canTransition } from './workflow';

// ---------------------------------------------------------------------------
// Board model (#157) — pure data shaping + legality lookup that backs the
// workflow board container. Kept out of the component so the wiring is unit
// testable without React.
//
// BACKLOG is intentionally excluded from the board (it lives in the backlog
// view); BOARD_STATUS_ORDER drives column order.
// ---------------------------------------------------------------------------

export interface BoardColumnModel {
  status: IssueStatus;
  issues: IssueCardData[];
}

/** Group issues into the board's status columns, preserving incoming order. */
export function buildBoardColumns(issues: BacklogIssue[]): BoardColumnModel[] {
  const byStatus = new Map<IssueStatus, IssueCardData[]>();
  for (const status of BOARD_STATUS_ORDER) byStatus.set(status, []);

  for (const issue of issues) {
    const bucket = byStatus.get(issue.status);
    if (bucket) bucket.push(toIssueCardData(issue));
  }

  return BOARD_STATUS_ORDER.map((status) => ({
    status,
    issues: byStatus.get(status) ?? [],
  }));
}

/**
 * Is moving issue `id` to `to` legal, given the live issue list? Resolves the
 * issue's current status + context (client/blocked) and defers to the matrix.
 * Unknown ids and BACKLOG-bound moves are illegal.
 */
export function isLegalTarget(issues: BacklogIssue[], id: string, to: IssueStatus): boolean {
  const issue = issues.find((i) => i.id === id);
  if (!issue) return false;
  return canTransition(issue.status, to, {
    hasClient: issue.clientId != null,
    isBlocked: issue.blocked,
  });
}
