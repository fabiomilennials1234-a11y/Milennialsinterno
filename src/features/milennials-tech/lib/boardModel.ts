import { SQUAD_ORDER, type BacklogIssue, type IssueSquad } from '../components/backlogTypes';
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

// ---------------------------------------------------------------------------
// Squad swimlanes (#168) — the shape the squad-grouped boards (sprint + kanban)
// render. Lives here, in lib, because it is data — SprintBoard re-exports it so
// existing import sites keep working without a lib->component dependency.
// ---------------------------------------------------------------------------

export interface SprintBoardLane {
  squad: IssueSquad | null;
  columns: BoardColumnModel[];
  count: number;
}

const SQUAD_LANE_GROUPS: Array<IssueSquad | null> = [...SQUAD_ORDER, null];

/**
 * Group issues into one lane per squad, in fixed order (FRONT, BACK, then the
 * null "Sem squad" bucket). Every lane is always emitted, count 0 included —
 * the board decides which lanes earn a row. Each lane's columns are the full
 * BOARD_STATUS_ORDER set for that squad's subset.
 */
export function buildSquadLanes(issues: BacklogIssue[]): SprintBoardLane[] {
  return SQUAD_LANE_GROUPS.map((squad) => {
    const subset = issues.filter((issue) => (issue.squad ?? null) === squad);
    return { squad, columns: buildBoardColumns(subset), count: subset.length };
  });
}
