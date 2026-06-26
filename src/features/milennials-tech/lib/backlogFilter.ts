// Backlog filtering (slice #156). Pure, client-side, over the cross-project
// fetch. Multi-select within a dimension is OR; across dimensions is AND. An
// empty array (or blank search) means that dimension imposes no constraint.

import type { BacklogIssue, BacklogFilters } from '../components/backlogTypes';

export function applyBacklogFilters(
  issues: BacklogIssue[],
  filters: BacklogFilters,
): BacklogIssue[] {
  const search = filters.search.trim().toLowerCase();

  return issues.filter((issue) => {
    if (filters.projectIds.length > 0 && !filters.projectIds.includes(issue.projectId)) {
      return false;
    }
    if (filters.clientIds.length > 0 && (issue.clientId === null || !filters.clientIds.includes(issue.clientId))) {
      return false;
    }
    if (filters.squads.length > 0 && (issue.squad === null || !filters.squads.includes(issue.squad))) {
      return false;
    }
    if (filters.assigneeIds.length > 0 && (issue.assigneeId === null || !filters.assigneeIds.includes(issue.assigneeId))) {
      return false;
    }
    if (filters.types.length > 0 && !filters.types.includes(issue.type)) {
      return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(issue.status)) {
      return false;
    }
    if (search.length > 0) {
      const haystack = `${issue.title} ${issue.key}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
