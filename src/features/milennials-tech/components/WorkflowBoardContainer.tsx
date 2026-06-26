import { useCallback, useMemo } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBacklogIssues, useTransitionIssue, useSetBlocked } from '../hooks/useTechIssues';
import { buildBoardColumns, isLegalTarget } from '../lib/boardModel';
import type { IssueStatus } from '../lib/issueSystem';
import { WorkflowBoard, WorkflowBoardSkeleton } from './WorkflowBoard';

// ---------------------------------------------------------------------------
// WorkflowBoardContainer (#157) — the data-wired board.
//
// Owns: fetch (useBacklogIssues), grouping (buildBoardColumns), legality
// (boardModel.isLegalTarget -> workflow matrix), and persistence (transition /
// set-blocked RPCs). Hands the presentational WorkflowBoard a pure contract.
//
// Defense in depth: even though the presentational layer only surfaces legal
// targets, onMove re-checks `isLegalTarget` against the LIVE list before
// persisting — a UI bug must never push an illegal status.
// ---------------------------------------------------------------------------

export interface WorkflowBoardContainerProps {
  onOpenCard?: (id: string) => void;
}

export function WorkflowBoardContainer({ onOpenCard }: WorkflowBoardContainerProps) {
  const { data: issues = [], isLoading, isError, refetch } = useBacklogIssues();
  const transition = useTransitionIssue();
  const setBlocked = useSetBlocked();

  const columns = useMemo(() => buildBoardColumns(issues), [issues]);

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
          Não foi possível carregar o board.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <WorkflowBoard
      columns={columns}
      isLegalTarget={legalTarget}
      onMove={handleMove}
      onReject={handleReject}
      onToggleBlocked={handleToggleBlocked}
      onOpenCard={onOpenCard}
    />
  );
}
