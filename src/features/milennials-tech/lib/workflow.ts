import type { IssueStatus } from './issueSystem';

// ---------------------------------------------------------------------------
// Workflow engine (#157) — pure transition matrix, the source of truth for
// legal status moves on the board.
//
// SCOPE: this is a workflow GUARDRAIL, not a security boundary. mtech is a
// staff-only internal tool; the matrix lives client-side and is NOT enforced
// in the DB. The container re-checks `canTransition` before persisting
// (defense-in-depth against a UI bug), but a determined staffer hitting the
// RPC directly can still set any status — by design for this slice. BLOCKED,
// by contrast, IS a DB invariant (column + CHECK).
// ---------------------------------------------------------------------------

export interface TransitionCtx {
  /** Issue belongs to a project that has a client. Gates the REVIEW fork. */
  hasClient: boolean;
  /** Issue is blocked. Freezes every status move until unblocked. */
  isBlocked: boolean;
}

/**
 * Base legal edges when NOT blocked, keyed from → allowed targets.
 * The REVIEW fork (AWAITING_APPROVAL vs DONE) is client-gated below.
 */
const TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  BACKLOG: ['TODO'],
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['REVIEW', 'TODO'],
  REVIEW: ['AWAITING_APPROVAL', 'DONE', 'CHANGES_REQUESTED', 'IN_PROGRESS'],
  AWAITING_APPROVAL: ['DONE', 'CHANGES_REQUESTED'],
  CHANGES_REQUESTED: ['IN_PROGRESS'],
  DONE: ['IN_PROGRESS'],
};

/** Canonical full status order (includes BACKLOG). Drives `nextStatuses`. */
const STATUS_ORDER: readonly IssueStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'AWAITING_APPROVAL',
  'CHANGES_REQUESTED',
  'DONE',
];

/**
 * Is `from → to` a legal status move under `ctx`?
 *
 * BLOCKED is orthogonal: when `ctx.isBlocked`, every move is illegal (you must
 * unblock first — toggling BLOCKED is a separate action, not a transition).
 * Self-moves and unlisted pairs are always illegal.
 */
export function canTransition(from: IssueStatus, to: IssueStatus, ctx: TransitionCtx): boolean {
  if (ctx.isBlocked) return false;
  if (from === to) return false;
  if (!TRANSITIONS[from].includes(to)) return false;

  // REVIEW fork: with a client the work goes for approval; without one it's
  // done directly (the approval column is skipped).
  if (from === 'REVIEW' && to === 'AWAITING_APPROVAL') return ctx.hasClient;
  if (from === 'REVIEW' && to === 'DONE') return !ctx.hasClient;

  return true;
}

/** Every status `from` can legally move to under `ctx`. Empty when blocked. */
export function nextStatuses(from: IssueStatus, ctx: TransitionCtx): IssueStatus[] {
  return STATUS_ORDER.filter((to) => canTransition(from, to, ctx));
}

/** Returns the next status on a legal move; throws otherwise. */
export function applyTransition(from: IssueStatus, to: IssueStatus, ctx: TransitionCtx): IssueStatus {
  if (!canTransition(from, to, ctx)) {
    throw new Error(`Transição ilegal: ${from} → ${to}`);
  }
  return to;
}
