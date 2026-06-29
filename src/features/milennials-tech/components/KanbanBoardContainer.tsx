import { useCallback, useMemo } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBacklogIssues, useTransitionIssue, useSetBlocked } from '../hooks/useTechIssues';
import { buildSquadLanes, isLegalTarget } from '../lib/boardModel';
import type { IssueStatus } from '../lib/issueSystem';
import type { BacklogFilters } from './backlogTypes';
import { SprintBoard } from './SprintBoard';
import { WorkflowBoardSkeleton } from './WorkflowBoard';

// ---------------------------------------------------------------------------
// KanbanBoardContainer (#168) — the data-wired Kanban board.
//
// Twin of SprintBoardContainer, one difference: the source is
// useBacklogIssues(filters) (EVERY top-level issue, cross-project) instead of
// useSprintIssues(sprintId). Everything downstream is identical — squad lanes
// (buildSquadLanes), legality (isLegalTarget -> workflow matrix), persistence
// (transition / set-blocked RPCs), rendered through the same SprintBoard.
//
// The handlers are duplicated from SprintBoardContainer on purpose: they are
// ~30 lines and sharing them would couple two live containers. Low coupling
// beats DRY here. Only the genuinely reusable, pure part (lane grouping) is
// shared, via lib/boardModel.buildSquadLanes.
//
// Defense in depth: onMove re-checks isLegalTarget against the live list before
// persisting, so a UI bug can never push an illegal status.
// ---------------------------------------------------------------------------

export interface KanbanBoardContainerProps {
  filters?: BacklogFilters;
  onOpenCard?: (id: string) => void;
}

export function KanbanBoardContainer({ filters, onOpenCard }: KanbanBoardContainerProps) {
  const { data: issues = [], isLoading, isError, refetch } = useBacklogIssues(filters);
  const transition = useTransitionIssue();
  const setBlocked = useSetBlocked();

  const lanes = useMemo(() => buildSquadLanes(issues), [issues]);

  const legalTarget = useCallback(
    (issueId: string, to: IssueStatus) => isLegalTarget(issues, issueId, to),
    [issues],
  );

  const handleMove = useCallback(
    (issueId: string, to: IssueStatus) => {
      if (!isLegalTarget(issues, issueId, to)) return; // defense in depth
      transition.mutate({ id: issueId, status: to });
    },
    [issues, transition],
  );

  const handleReject = useCallback(
    (issueId: string) => {
      if (!isLegalTarget(issues, issueId, 'CHANGES_REQUESTED')) return;
      transition.mutate({ id: issueId, status: 'CHANGES_REQUESTED' });
    },
    [issues, transition],
  );

  const handleToggleBlocked = useCallback(
    (issueId: string, blocked: boolean, reason?: string) => {
      setBlocked.mutate({ id: issueId, blocked, reason });
    },
    [setBlocked],
  );

  if (isLoading) return <WorkflowBoardSkeleton />;

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] px-6 py-16 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-[var(--mtech-danger)]" aria-hidden />
        <p className="text-[13px] text-[var(--mtech-text-muted)]">
          Não foi possível carregar o Kanban.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <SprintBoard
      lanes={lanes}
      isLegalTarget={legalTarget}
      onMove={handleMove}
      onReject={handleReject}
      onToggleBlocked={handleToggleBlocked}
      onOpenCard={onOpenCard}
    />
  );
}
