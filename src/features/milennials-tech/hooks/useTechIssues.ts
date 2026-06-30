import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { applyBacklogFilters } from '../lib/backlogFilter';
import { buildSubtaskProgressMap } from '../lib/subtaskProgress';
import type { IssueStatus, IssueType, StoryPointValue } from '../lib/issueSystem';
import {
  type BacklogIssue,
  type BacklogFilters,
  type IssuePriority,
  type IssueSquad,
} from '../components/backlogTypes';

// ---------------------------------------------------------------------------
// Query keys — dedicated to the cross-project backlog (NOT the legacy
// per-project techTaskKeys). The fetch is filter-independent: we pull every
// top-level issue once and derive filtering in `select`, so changing a filter
// never refetches.
// ---------------------------------------------------------------------------

export const backlogIssueKeys = {
  all: ['tech', 'backlog'] as const,
  list: () => [...backlogIssueKeys.all, 'list'] as const,
};

// ---------------------------------------------------------------------------
// Read model: cross-project, top-level issues only (parent_id IS NULL).
//
// The #153 foundation dropped tech_projects_client_id_fkey (client_id is now a
// loose uuid), so a PostgREST `client:clients(...)` embed would 400. We fetch
// the four relations in parallel and join client-side. tech_tasks columns
// rank/key aren't in the regenerated supabase types yet -> localized `as any`
// (documented debt, same pattern as the legacy useTechTasks hook).
// ---------------------------------------------------------------------------

interface TaskRow {
  id: string;
  key: string | null;
  title: string;
  type: IssueType;
  status: BacklogIssue['status'];
  priority: IssuePriority;
  squad: IssueSquad | null;
  story_points: number | null;
  assignee_id: string | null;
  rank: string;
  project_id: string;
  epic_id: string | null;
  sprint_id: string | null;
  blocked: boolean | null;
  blocker_reason: string | null;
  added_after_start: boolean | null;
}

async function fetchBacklogIssues(): Promise<BacklogIssue[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [tasksRes, subtasksRes, projectsRes, clientsRes, profilesRes] = await Promise.all([
    sb
      .from('tech_tasks')
      .select(
        'id, key, title, type, status, priority, squad, story_points, assignee_id, rank, project_id, epic_id, sprint_id, blocked, blocker_reason, added_after_start',
      )
      .is('parent_id', null)
      .order('rank', { ascending: true }),
    // Every sub-task in ONE pass (#171). Cross-project, lightweight (parent + status
    // only), aggregated client-side into a per-parent progress map — never per row.
    sb.from('tech_tasks').select('parent_id, status').not('parent_id', 'is', null),
    sb.from('tech_projects').select('id, name, key_prefix, client_id'),
    sb.from('clients').select('id, name'),
    sb.from('profiles').select('user_id, name, avatar'),
  ]);

  if (tasksRes.error) throw tasksRes.error;
  if (subtasksRes.error) throw subtasksRes.error;
  if (projectsRes.error) throw projectsRes.error;
  if (clientsRes.error) throw clientsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const subtaskProgress = buildSubtaskProgressMap(
    (subtasksRes.data ?? []).map((s: { parent_id: string; status: IssueStatus }) => ({
      parentId: s.parent_id,
      status: s.status,
    })),
  );

  const projectMap = new Map<string, { name: string; prefix: string; clientId: string | null }>();
  for (const p of projectsRes.data ?? []) {
    projectMap.set(p.id, {
      name: p.name,
      prefix: p.key_prefix ?? '',
      clientId: p.client_id ?? null,
    });
  }

  const clientMap = new Map<string, string>();
  for (const c of clientsRes.data ?? []) clientMap.set(c.id, c.name);

  const profileMap = new Map<string, { name: string | null; avatar: string | null }>();
  for (const pr of profilesRes.data ?? []) {
    profileMap.set(pr.user_id, { name: pr.name ?? null, avatar: pr.avatar ?? null });
  }

  return (tasksRes.data as TaskRow[]).map((row): BacklogIssue => {
    const project = projectMap.get(row.project_id);
    const clientId = project?.clientId ?? null;
    const assignee = row.assignee_id ? profileMap.get(row.assignee_id) : undefined;

    return {
      id: row.id,
      key: row.key ?? '',
      title: row.title,
      type: row.type,
      status: row.status,
      priority: row.priority,
      squad: row.squad,
      storyPoints: row.story_points,
      assigneeId: row.assignee_id,
      assigneeName: assignee?.name ?? null,
      assigneeAvatar: assignee?.avatar ?? null,
      rank: row.rank,
      projectId: row.project_id,
      projectName: project?.name ?? 'Projeto',
      projectPrefix: project?.prefix ?? '',
      clientId,
      clientName: clientId ? clientMap.get(clientId) ?? null : null,
      epicId: row.epic_id,
      sprintId: row.sprint_id,
      blocked: row.blocked ?? false,
      blockerReason: row.blocker_reason ?? null,
      addedAfterStart: row.added_after_start ?? false,
      subtaskProgress: subtaskProgress.get(row.id),
    };
  });
}

/**
 * Cross-project backlog. Fetches once; `filters` are applied in `select` so the
 * cache holds the full list and filter changes never hit the network.
 */
export function useBacklogIssues(filters?: BacklogFilters) {
  return useQuery({
    queryKey: backlogIssueKeys.list(),
    queryFn: fetchBacklogIssues,
    select: filters ? (data: BacklogIssue[]) => applyBacklogFilters(data, filters) : undefined,
    staleTime: 30_000,
  });
}

/**
 * Issues scoped to one sprint (#161). Derives from the SAME cross-project query
 * as `useBacklogIssues` — identical queryKey means react-query shares one cache
 * entry and the `select` filters per-observer, so the sprint board never fires
 * its own request. A null/undefined sprint resolves to an empty list.
 */
export function useSprintIssues(sprintId: string | null | undefined) {
  return useQuery({
    queryKey: backlogIssueKeys.list(),
    queryFn: fetchBacklogIssues,
    select: (data: BacklogIssue[]) =>
      sprintId == null ? [] : data.filter((issue) => issue.sprintId === sprintId),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Create issue -> RPC tech_issue_create
// ---------------------------------------------------------------------------

export interface CreateIssueInput {
  projectId: string;
  title: string;
  type?: IssueType;
  priority?: IssuePriority;
  epicId?: string | null;
  parentId?: string | null;
  storyPoints?: number | null;
  squad?: IssueSquad | null;
  assigneeId?: string | null;
  description?: string | null;
}

export function useCreateIssue() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateIssueInput): Promise<string> => {
      const { data, error } = await supabase.rpc('tech_issue_create', {
        p_project_id: input.projectId,
        p_title: input.title,
        p_type: input.type ?? 'TASK',
        p_priority: input.priority ?? 'MEDIUM',
        p_epic_id: input.epicId ?? undefined,
        p_parent_id: input.parentId ?? undefined,
        p_story_points: input.storyPoints ?? undefined,
        p_squad: input.squad ?? undefined,
        p_assignee_id: input.assigneeId ?? undefined,
        p_description: input.description ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backlogIssueKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Create sub-task -> RPC tech_issue_create with p_parent_id set. A sub-task
// inherits the parent's project, carries NO points and NO epic (DB CHECK +
// RPC both enforce this), and never gets an issue key. Reuses tech_issue_create
// rather than a parallel path; we just pin the contract here.
// ---------------------------------------------------------------------------

export interface CreateSubtaskInput {
  parentId: string;
  title: string;
  assigneeId?: string | null;
  description?: string | null;
}

export function useCreateSubtask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSubtaskInput): Promise<string> => {
      const { data, error } = await supabase.rpc('tech_issue_create', {
        p_project_id: undefined, // inherited from parent server-side
        p_title: input.title,
        p_parent_id: input.parentId,
        p_epic_id: undefined, // sub-task never has an epic
        p_story_points: undefined, // sub-task never points
        p_assignee_id: input.assigneeId ?? undefined,
        p_description: input.description ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backlogIssueKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Re-link / unlink issue -> epic (#169.1). ONE write path: tech_issue_set_epic
// assigns epic_id UNCONDITIONALLY (a non-null id sets/swaps, null clears) — no
// COALESCE, so it can do what tech_issue_update can't. SECURITY DEFINER gates
// tech staff and, for a non-null epic, that the epic shares the issue's project.
// The DB rejects an epic on a sub-task (subtask nao tem epic). Top-level only.
// ---------------------------------------------------------------------------

export interface RelinkIssueEpicInput {
  id: string;
  epicId: string | null;
}

export function useRelinkIssueEpic() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, epicId }: RelinkIssueEpicInput): Promise<void> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('tech_issue_set_epic', {
        p_issue_id: id,
        p_epic_id: epicId,
      });
      if (error) throw error;
    },
    onMutate: async ({ id, epicId }: RelinkIssueEpicInput) => {
      await qc.cancelQueries({ queryKey: backlogIssueKeys.all });
      const previous = qc.getQueryData<BacklogIssue[]>(backlogIssueKeys.list());
      if (previous) {
        qc.setQueryData<BacklogIssue[]>(
          backlogIssueKeys.list(),
          previous.map((i) => (i.id === id ? { ...i, epicId } : i)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(backlogIssueKeys.list(), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: backlogIssueKeys.all });
      // The issue detail (TaskDetailModal) reads the legacy useTechTasks cache,
      // not the backlog — refresh it too so the epic field reflects the relink.
      // Key inlined as ['tech','tasks'] to avoid an import cycle (see #162).
      qc.invalidateQueries({ queryKey: ['tech', 'tasks'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Reorder issue -> RPC tech_issue_reorder (DB owns the lexorank arithmetic).
// Optimistic: reposition the moved row in the cached array immediately;
// rollback on error; invalidate on settle to reconcile the authoritative rank.
// ---------------------------------------------------------------------------

export interface ReorderIssueInput {
  id: string;
  prevRank: string | null;
  nextRank: string | null;
}

export function useReorderIssue() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, prevRank, nextRank }: ReorderIssueInput): Promise<string> => {
      const { data, error } = await supabase.rpc('tech_issue_reorder', {
        p_id: id,
        p_prev_rank: prevRank ?? undefined,
        p_next_rank: nextRank ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      return data as string;
    },
    onMutate: async ({ id, prevRank }: ReorderIssueInput) => {
      await qc.cancelQueries({ queryKey: backlogIssueKeys.all });
      const previous = qc.getQueryData<BacklogIssue[]>(backlogIssueKeys.list());
      if (previous) {
        const moved = previous.find((i) => i.id === id);
        if (moved) {
          const without = previous.filter((i) => i.id !== id);
          let insertAt: number;
          if (prevRank === null) {
            insertAt = 0;
          } else {
            const pi = without.findIndex((i) => i.rank === prevRank);
            insertAt = pi >= 0 ? pi + 1 : without.length;
          }
          qc.setQueryData<BacklogIssue[]>(backlogIssueKeys.list(), [
            ...without.slice(0, insertAt),
            moved,
            ...without.slice(insertAt),
          ]);
        }
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(backlogIssueKeys.list(), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: backlogIssueKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Transition issue -> RPC tech_issue_update (status only). The legality of the
// move is a CLIENT-SIDE guardrail (lib/workflow.ts); this hook just persists
// the chosen status. Optimistic: patch the card's status in cache immediately,
// rollback on error, invalidate on settle. Same shape as useReorderIssue.
// ---------------------------------------------------------------------------

export interface TransitionIssueInput {
  id: string;
  status: IssueStatus;
}

export function useTransitionIssue() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: TransitionIssueInput): Promise<void> => {
      const { error } = await supabase.rpc('tech_issue_update', {
        p_id: id,
        p_status: status,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
    },
    onMutate: async ({ id, status }: TransitionIssueInput) => {
      await qc.cancelQueries({ queryKey: backlogIssueKeys.all });
      const previous = qc.getQueryData<BacklogIssue[]>(backlogIssueKeys.list());
      if (previous) {
        qc.setQueryData<BacklogIssue[]>(
          backlogIssueKeys.list(),
          previous.map((i) => (i.id === id ? { ...i, status } : i)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(backlogIssueKeys.list(), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: backlogIssueKeys.all });
      // A status move to/from DONE shifts the burndown's COMPLETE events (#162).
      // sprintBurndownKeys.all inlined to avoid an import cycle.
      qc.invalidateQueries({ queryKey: ['tech', 'sprint-burndown'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Update story points -> RPC tech_issue_update (p_story_points only). The RPC
// COALESCEs, so this can only SET a Fibonacci value, never clear it back to null
// (matches the picker, which never emits null). Optimistic: patch storyPoints in
// cache immediately, rollback on error, invalidate on settle. Same shape as
// useTransitionIssue.
// ---------------------------------------------------------------------------

export interface UpdateStoryPointsInput {
  id: string;
  points: StoryPointValue;
}

export function useUpdateStoryPoints() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, points }: UpdateStoryPointsInput): Promise<void> => {
      const { error } = await supabase.rpc('tech_issue_update', {
        p_id: id,
        p_story_points: points,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
    },
    onMutate: async ({ id, points }: UpdateStoryPointsInput) => {
      await qc.cancelQueries({ queryKey: backlogIssueKeys.all });
      const previous = qc.getQueryData<BacklogIssue[]>(backlogIssueKeys.list());
      if (previous) {
        qc.setQueryData<BacklogIssue[]>(
          backlogIssueKeys.list(),
          previous.map((i) => (i.id === id ? { ...i, storyPoints: points } : i)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(backlogIssueKeys.list(), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: backlogIssueKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Set blocked -> RPC tech_issue_set_blocked. Dedicated RPC (not tech_issue_update)
// because the COALESCE contract there can't set blocked=false. DB enforces the
// "blocked requires a reason" invariant; we mirror the cache optimistically.
// ---------------------------------------------------------------------------

export interface SetBlockedInput {
  id: string;
  blocked: boolean;
  reason?: string | null;
}

export function useSetBlocked() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, blocked, reason }: SetBlockedInput): Promise<void> => {
      const { error } = await supabase.rpc('tech_issue_set_blocked', {
        p_id: id,
        p_blocked: blocked,
        p_reason: blocked ? reason ?? null : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
    },
    onMutate: async ({ id, blocked, reason }: SetBlockedInput) => {
      await qc.cancelQueries({ queryKey: backlogIssueKeys.all });
      const previous = qc.getQueryData<BacklogIssue[]>(backlogIssueKeys.list());
      if (previous) {
        qc.setQueryData<BacklogIssue[]>(
          backlogIssueKeys.list(),
          previous.map((i) =>
            i.id === id
              ? { ...i, blocked, blockerReason: blocked ? reason ?? null : null }
              : i,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(backlogIssueKeys.list(), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: backlogIssueKeys.all });
    },
  });
}
