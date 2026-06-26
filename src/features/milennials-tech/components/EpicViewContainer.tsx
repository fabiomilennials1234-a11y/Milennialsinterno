import { useMemo, type ReactNode } from 'react';
import { useTechEpics, useEpicRollup } from '../hooks/useTechEpics';
import { useBacklogIssues } from '../hooks/useTechIssues';
import { EpicView } from './EpicView';
import type { EpicHeaderData } from './EpicHeader';
import type { EpicChildIssue } from './EpicIssueRow';

// ---------------------------------------------------------------------------
// EpicViewContainer (#158) — the data-wired epic surface.
//
// Owns: epic identity (useTechEpics), the count-based rollup (useEpicRollup),
// and the child list (the cross-project backlog filtered to this epic). The
// backlog cache holds only TOP-LEVEL issues (parent_id IS NULL), which is
// exactly the set an epic counts — sub-tasks correctly never appear here.
//
// Hands the presentational EpicView a pure contract + the four list states.
// ---------------------------------------------------------------------------

export interface EpicViewContainerProps {
  epicId: string;
  /** Open a child issue (issue-view). */
  onOpenIssue?: (id: string) => void;
  /** Add an issue to this epic (host opens the picker/composer). */
  onAddIssue?: () => void;
  /**
   * Demand-link slot for the header. The container does NOT fetch demands —
   * the host resolves scope/options/current (useTechDemandas + the epic's
   * linked demanda) and passes a configured <EpicDemandaLink>. Keeps the demand
   * data dependency out of the epic-view critical path.
   */
  headerDemanda?: ReactNode;
  selectedIssueId?: string | null;
  className?: string;
}

export function EpicViewContainer({
  epicId,
  onOpenIssue,
  onAddIssue,
  headerDemanda,
  selectedIssueId,
  className,
}: EpicViewContainerProps) {
  const epicsQuery = useTechEpics();
  const issuesQuery = useBacklogIssues();
  const rollup = useEpicRollup(epicId);

  const epic = epicsQuery.data?.find((e) => e.id === epicId);

  const children = useMemo<EpicChildIssue[]>(() => {
    const issues = issuesQuery.data ?? [];
    return issues
      .filter((i) => i.epicId === epicId)
      .map((i) => ({
        id: i.id,
        key: i.key,
        title: i.title,
        type: i.type,
        status: i.status,
        storyPoints: i.storyPoints,
        assigneeName: i.assigneeName,
        assigneeAvatar: i.assigneeAvatar,
        isBlocked: i.blocked,
        blockerReason: i.blockerReason,
      }));
  }, [issuesQuery.data, epicId]);

  const loading = epicsQuery.isLoading || issuesQuery.isLoading;
  const error =
    epicsQuery.isError || issuesQuery.isError
      ? 'Não foi possível carregar os dados do epic.'
      : !loading && !epic
        ? 'Epic não encontrado.'
        : null;

  const header: EpicHeaderData = epic
    ? { id: epic.id, key: epic.key ?? '—', title: epic.title }
    : { id: epicId, key: '—', title: 'Epic' };

  function retry() {
    epicsQuery.refetch();
    issuesQuery.refetch();
  }

  return (
    <EpicView
      epic={header}
      rollup={rollup}
      issues={children}
      loading={loading}
      error={error}
      onRetry={retry}
      onIssueClick={onOpenIssue}
      onAddIssue={onAddIssue}
      headerDemanda={headerDemanda}
      selectedId={selectedIssueId}
      className={className}
    />
  );
}
