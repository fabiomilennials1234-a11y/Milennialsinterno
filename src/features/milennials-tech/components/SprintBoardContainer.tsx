import { useCallback, useMemo } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSprintIssues, useTransitionIssue, useSetBlocked } from '../hooks/useTechIssues';
import { buildBoardColumns, isLegalTarget } from '../lib/boardModel';
import type { IssueStatus } from '../lib/issueSystem';
import { SQUAD_ORDER, type IssueSquad } from './backlogTypes';
import { SprintBoard, type SprintBoardLane } from './SprintBoard';
import { WorkflowBoardSkeleton } from './WorkflowBoard';

// ---------------------------------------------------------------------------
// SprintBoardContainer (#161) — the data-wired sprint board.
//
// Mirrors WorkflowBoardContainer: it owns fetch (useSprintIssues, sharing the
// backlog cache), squad grouping (one SprintBoardLane per FRONT/BACK/null),
// legality (boardModel.isLegalTarget -> workflow matrix, scoped to THIS sprint's
// issues), and persistence (transition / set-blocked RPCs). Hands SprintBoard a
// pure contract. Squad lanes are always emitted (count 0 included) — SprintBoard
// decides visibility (Front/Back always show; null lane only when it holds work).
//
// Defense in depth: onMove re-checks isLegalTarget against the live sprint list
// before persisting, so a UI bug can never push an illegal status.
// ---------------------------------------------------------------------------

const SQUAD_GROUPS: Array<IssueSquad | null> = [...SQUAD_ORDER, null];

export interface SprintBoardContainerProps {
  sprintId: string;
  onOpenCard?: (id: string) => void;
}

export function SprintBoardContainer({ sprintId, onOpenCard }: SprintBoardContainerProps) {
  const { data: issues = [], isLoading, isError, refetch } = useSprintIssues(sprintId);
  const transition = useTransitionIssue();
  const setBlocked = useSetBlocked();

  const lanes = useMemo<SprintBoardLane[]>(
    () =>
      SQUAD_GROUPS.map((squad) => {
        const subset = issues.filter((issue) => (issue.squad ?? null) === squad);
        return { squad, columns: buildBoardColumns(subset), count: subset.length };
      }),
    [issues],
  );

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
          Não foi possível carregar o board do sprint.
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
