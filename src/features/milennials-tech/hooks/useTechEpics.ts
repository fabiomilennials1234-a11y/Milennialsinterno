import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBacklogIssues } from './useTechIssues';
import { computeEpicRollup, type EpicRollup, type RollupIssue } from '../lib/rollup';

// ---------------------------------------------------------------------------
// Epics (#158). tech_epics has RLS + GRANT SELECT TO authenticated (anon
// revoked in the hardening pass). Reads go straight through the table; the
// create goes through the SECURITY DEFINER RPC `tech_epic_create`, which gates
// tech staff server-side. types.ts is WIP (no tech_epics row type yet) -> the
// localized `as any` mirrors the established pattern in useTechIssues /
// useTechProjects. Do NOT regenerate types.
// ---------------------------------------------------------------------------

export const techEpicKeys = {
  all: ['tech', 'epics'] as const,
  list: (projectId?: string) => [...techEpicKeys.all, 'list', projectId ?? null] as const,
};

export type EpicStatus = 'BACKLOG' | 'IN_PROGRESS' | 'DONE';

export type RoadmapBucket = 'NOW' | 'NEXT' | 'LATER';

export interface TechEpicRow {
  id: string;
  projectId: string;
  key: string | null;
  title: string;
  description: string | null;
  status: EpicStatus;
  startDate: string | null;
  deadline: string | null;
  roadmapBucket: RoadmapBucket | null;
  roadmapRank: string | null;
}

interface EpicDbRow {
  id: string;
  project_id: string;
  key: string | null;
  title: string;
  description: string | null;
  status: EpicStatus;
  start_date: string | null;
  deadline: string | null;
  roadmap_bucket: RoadmapBucket | null;
  roadmap_rank: string | null;
}

export function useTechEpics(projectId?: string) {
  return useQuery<TechEpicRow[]>({
    queryKey: techEpicKeys.list(projectId),
    enabled: projectId == null ? true : Boolean(projectId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('tech_epics')
        .select(
          'id, project_id, key, title, description, status, start_date, deadline, roadmap_bucket, roadmap_rank',
        );
      if (projectId) query = query.eq('project_id', projectId);

      const { data, error } = await query.order('key_number', { ascending: true });
      if (error) throw error;

      return (data as EpicDbRow[]).map((row): TechEpicRow => ({
        id: row.id,
        projectId: row.project_id,
        key: row.key,
        title: row.title,
        description: row.description,
        status: row.status,
        startDate: row.start_date,
        deadline: row.deadline,
        roadmapBucket: row.roadmap_bucket,
        roadmapRank: row.roadmap_rank,
      }));
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Create epic -> RPC tech_epic_create
// ---------------------------------------------------------------------------

export interface CreateEpicInput {
  projectId: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  deadline?: string | null;
}

export function useCreateEpic() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEpicInput): Promise<string> => {
      const { data, error } = await supabase.rpc('tech_epic_create', {
        p_project_id: input.projectId,
        p_title: input.title,
        p_description: input.description ?? undefined,
        p_start_date: input.startDate ?? undefined,
        p_deadline: input.deadline ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techEpicKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Derived rollup. The cross-project backlog already holds every TOP-LEVEL issue
// (parent_id IS NULL) — exactly the set the rollup counts. We filter to this
// epic's children and run the pure aggregator. Sub-tasks never appear in the
// backlog cache, which lines up with the rollup excluding them anyway.
// ---------------------------------------------------------------------------

export function useEpicRollup(epicId: string | null | undefined): EpicRollup {
  const { data: issues } = useBacklogIssues();

  return useMemo(() => {
    if (!epicId || !issues) return computeEpicRollup([]);
    const children: RollupIssue[] = issues
      .filter((i) => i.epicId === epicId)
      .map((i) => ({ parent_id: null, story_points: i.storyPoints, status: i.status }));
    return computeEpicRollup(children);
  }, [epicId, issues]);
}

// ---------------------------------------------------------------------------
// Rollup for MANY epics in ONE pass (#166 roadmap). The roadmap renders every
// epic's progress at once — calling useEpicRollup in a loop would break the
// rules-of-hooks and re-scan the backlog per epic. Instead we pull the backlog
// ONCE, bucket its top-level issues by epic, and aggregate each group. The map
// is keyed by epicId; an epic with no issues is simply absent (callers fall
// back to an empty rollup).
// ---------------------------------------------------------------------------

export function useEpicRollupMap(): Map<string, EpicRollup> {
  const { data: issues } = useBacklogIssues();

  return useMemo(() => {
    const map = new Map<string, EpicRollup>();
    if (!issues) return map;

    const byEpic = new Map<string, RollupIssue[]>();
    for (const i of issues) {
      if (!i.epicId) continue;
      const group = byEpic.get(i.epicId);
      const entry: RollupIssue = { parent_id: null, story_points: i.storyPoints, status: i.status };
      if (group) group.push(entry);
      else byEpic.set(i.epicId, [entry]);
    }

    for (const [epicId, group] of byEpic) {
      map.set(epicId, computeEpicRollup(group));
    }
    return map;
  }, [issues]);
}

// ---------------------------------------------------------------------------
// Position an epic on the roadmap -> RPC tech_epic_set_roadmap (DB owns the
// lexorank arithmetic). bucket=null removes the epic from the roadmap. Optimistic:
// patch bucket + rank in every cached epic list, rollback on error, invalidate on
// settle. Mirrors useReorderIssue. The authoritative rank is reconciled on settle.
// ---------------------------------------------------------------------------

export interface SetEpicRoadmapInput {
  id: string;
  bucket: RoadmapBucket | null;
  prevRank: string | null;
  nextRank: string | null;
}

export function useSetEpicRoadmap() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, bucket, prevRank, nextRank }: SetEpicRoadmapInput): Promise<string> => {
      // tech_epic_set_roadmap is newer than the WIP-frozen generated types.ts, so
      // the RPC name is absent from its union — cast the client locally (same as
      // the (supabase as any).from used elsewhere in this file). Do not regen types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('tech_epic_set_roadmap', {
        p_id: id,
        p_bucket: bucket ?? undefined,
        p_prev_rank: prevRank ?? undefined,
        p_next_rank: nextRank ?? undefined,
      });
      if (error) throw error;
      return data as string;
    },
    onMutate: async ({ id, bucket }: SetEpicRoadmapInput) => {
      await qc.cancelQueries({ queryKey: techEpicKeys.all });
      const snapshots = qc.getQueriesData<TechEpicRow[]>({ queryKey: techEpicKeys.all });
      for (const [key, rows] of snapshots) {
        if (!rows) continue;
        qc.setQueryData<TechEpicRow[]>(
          key,
          rows.map((e) => (e.id === id ? { ...e, roadmapBucket: bucket } : e)),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      for (const [key, rows] of context?.snapshots ?? []) {
        qc.setQueryData(key, rows);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: techEpicKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Remark an epic's dates -> RPC tech_epic_update (start_date + deadline only; the
// RPC COALESCEs the rest). Feeds the timeline drag/resize. Optimistic: patch the
// dates in every cached epic list, rollback on error, invalidate on settle.
// ---------------------------------------------------------------------------

export interface UpdateEpicDatesInput {
  id: string;
  startDate: string | null;
  deadline: string | null;
}

export function useUpdateEpicDates() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, startDate, deadline }: UpdateEpicDatesInput): Promise<void> => {
      const { error } = await supabase.rpc('tech_epic_update', {
        p_id: id,
        p_start_date: startDate ?? undefined,
        p_deadline: deadline ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (error) throw error;
    },
    onMutate: async ({ id, startDate, deadline }: UpdateEpicDatesInput) => {
      await qc.cancelQueries({ queryKey: techEpicKeys.all });
      const snapshots = qc.getQueriesData<TechEpicRow[]>({ queryKey: techEpicKeys.all });
      for (const [key, rows] of snapshots) {
        if (!rows) continue;
        qc.setQueryData<TechEpicRow[]>(
          key,
          rows.map((e) => (e.id === id ? { ...e, startDate, deadline } : e)),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      for (const [key, rows] of context?.snapshots ?? []) {
        qc.setQueryData(key, rows);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: techEpicKeys.all });
    },
  });
}
