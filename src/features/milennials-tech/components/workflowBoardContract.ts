import type { IssueStatus } from '../lib/issueSystem';
import type { IssueCardData } from './IssueCard';

// ---------------------------------------------------------------------------
// WorkflowBoard contract (#157) — the single shared interface between the
// data-wired container (engineer) and the presentational board (design).
//
// The presentational board:
//   - renders `columns` left-to-right (status lanes)
//   - uses `isLegalTarget(issueId, to)` to highlight ONLY legal drop zones and
//     to reject an illegal drop / keyboard move (it must not emit onMove for an
//     illegal target)
//   - emits `onMove` on a legal drop, `onReject` from the reject affordance,
//     `onToggleBlocked` from the block toggle, `onOpenCard` on card activation
//
// The container re-validates legality before persisting (defense in depth).
// ---------------------------------------------------------------------------

export interface WorkflowBoardColumn {
  status: IssueStatus;
  issues: IssueCardData[];
}

export interface WorkflowBoardProps {
  columns: WorkflowBoardColumn[];
  isLegalTarget: (issueId: string, to: IssueStatus) => boolean;
  onMove: (issueId: string, to: IssueStatus) => void;
  onReject: (issueId: string) => void;
  onToggleBlocked: (issueId: string, blocked: boolean, reason?: string) => void;
  onOpenCard?: (id: string) => void;
  // When true, suppress the keyboard legend. SprintBoard renders one board per
  // swimlane and shows a single shared legend, so per-board legends would repeat.
  hideKeyboardLegend?: boolean;
}
