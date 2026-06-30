import type { BacklogIssue } from '../components/backlogTypes';
import type { IssueCardData } from '../components/IssueCard';
import { epicColorFromKey } from './issueSystem';

// ---------------------------------------------------------------------------
// BacklogIssue -> IssueCardData adapter (#157, extended #158).
//
// The board card's exception badges DERIVE from status — there is no separate
// column for them: `changesRequested := status === 'CHANGES_REQUESTED'`,
// `awaitingApproval := status === 'AWAITING_APPROVAL'`. `isBlocked` is the real
// orthogonal flag from the DB. Epic accent falls back to the deterministic
// project color (we have no epic name in this read model).
//
// Sub-task linkage (#158) lives OUTSIDE BacklogIssue — the backlog read model
// only holds top-level issues (parent_id IS NULL), and the owned-sub-task tally
// is a separate aggregation. So the card's parent breadcrumb + sub-task counts
// arrive through an optional `relations` argument rather than the row itself.
// ---------------------------------------------------------------------------

export interface IssueCardRelations {
  /** Parent issue key when this card IS a sub-task (parent_id resolved to key). */
  parentKey?: string | null;
  /** Sub-tasks this issue OWNS. */
  subtaskCount?: number | null;
  /** Completed owned sub-tasks. */
  subtaskDoneCount?: number | null;
}

export function toIssueCardData(
  issue: BacklogIssue,
  relations?: IssueCardRelations,
): IssueCardData {
  return {
    id: issue.id,
    key: issue.key,
    title: issue.title,
    type: issue.type,
    storyPoints: issue.storyPoints,
    assignee: { name: issue.assigneeName, avatarUrl: issue.assigneeAvatar },
    epicColor: epicColorFromKey(issue.epicId ?? issue.projectPrefix),
    // #173: the row now carries its epic label (key, title fallback) and sub-task
    // tally (#170/#171). Explicit `relations` still win — they're the targeted
    // override path (#158) for callers that resolve linkage themselves.
    epicLabel: issue.epicKey ?? issue.epicTitle ?? null,
    isBlocked: issue.blocked,
    blockerReason: issue.blockerReason,
    changesRequested: issue.status === 'CHANGES_REQUESTED',
    awaitingApproval: issue.status === 'AWAITING_APPROVAL',
    addedAfterStart: issue.addedAfterStart,
    parentKey: relations?.parentKey ?? null,
    subtaskCount: relations?.subtaskCount ?? issue.subtaskProgress?.total ?? null,
    subtaskDoneCount: relations?.subtaskDoneCount ?? issue.subtaskProgress?.done ?? null,
  };
}
