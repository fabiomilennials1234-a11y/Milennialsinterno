import type { IssueStatus } from './issueSystem';

// ---------------------------------------------------------------------------
// Sub-task progress (#171). A parent issue's completion is the cheapest dense
// signal on a backlog row: "done/total". "done" means the sub-task reached the
// terminal status DONE — the same terminal the rollup uses (lib/rollup.ts:
// `issue.status === 'DONE'`), kept as a literal rather than a parallel constant.
// ---------------------------------------------------------------------------

export interface SubtaskRow {
  parentId: string;
  status: IssueStatus;
}

export interface SubtaskProgress {
  done: number;
  total: number;
}

export function computeSubtaskProgress(parentId: string, subtasks: SubtaskRow[]): SubtaskProgress {
  let done = 0;
  let total = 0;
  for (const s of subtasks) {
    if (s.parentId !== parentId) continue;
    total += 1;
    if (s.status === 'DONE') done += 1;
  }
  return { done, total };
}

// Single pass over EVERY sub-task -> one progress entry per parent. Used by the
// backlog read model so the whole queue is aggregated in O(n), never per row.
// A parent with no sub-tasks is simply absent (callers render no badge).
export function buildSubtaskProgressMap(subtasks: SubtaskRow[]): Map<string, SubtaskProgress> {
  const map = new Map<string, SubtaskProgress>();
  for (const s of subtasks) {
    const entry = map.get(s.parentId);
    if (entry) {
      entry.total += 1;
      if (s.status === 'DONE') entry.done += 1;
    } else {
      map.set(s.parentId, { done: s.status === 'DONE' ? 1 : 0, total: 1 });
    }
  }
  return map;
}
