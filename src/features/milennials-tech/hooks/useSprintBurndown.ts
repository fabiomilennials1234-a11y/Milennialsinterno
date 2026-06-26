import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computeBurndown, type BurndownEvent, type BurndownSeries } from '../lib/burndown';
import { useTechSprints } from './useTechSprints';
import type { TechSprintStatus } from '../types';

// ---------------------------------------------------------------------------
// useSprintBurndown (#162) — the data-wired burndown series for one sprint.
//
// Reads the sprint row from the shared useTechSprints cache (no extra fetch),
// pulls the raw event stream from tech_sprint_burndown_events, and folds both
// through the pure lib/burndown arithmetic. Only ACTIVE/COMPLETED sprints have a
// burndown — a sprint that never started has no committed baseline to burn down,
// so the query stays disabled and the series is empty (the chart shows its empty
// state). The RPC isn't in the WIP-regenerated types yet -> localized `as any`,
// same pattern as useCloseSprint.
//
// startDate = started_at ?? start_date (the real first burn day once started).
// asOf      = min(today, end_date) — the chart projects null past the last real
//             day, never past the sprint window.
// ---------------------------------------------------------------------------

const BURNDOWN_STATUSES: ReadonlySet<TechSprintStatus> = new Set<TechSprintStatus>([
  'ACTIVE',
  'COMPLETED',
]);

interface BurndownEventRow {
  event_date: string;
  event_type: BurndownEvent['type'];
  points: number;
}

/** timestamptz/date string -> bare UTC "YYYY-MM-DD". */
function toDayKey(value: string): string {
  return value.slice(0, 10);
}

/** Lexicographic min of two ISO day strings (valid for zero-padded dates). */
function minDay(a: string, b: string): string {
  return a < b ? a : b;
}

const EMPTY_SERIES: BurndownSeries = {
  points: [],
  committedPoints: 0,
  deliveredPoints: 0,
  addedPoints: 0,
};

export const sprintBurndownKeys = {
  all: ['tech', 'sprint-burndown'] as const,
  one: (sprintId: string) => [...sprintBurndownKeys.all, sprintId] as const,
};

export function useSprintBurndown(sprintId: string | null | undefined): {
  series: BurndownSeries;
  isLoading: boolean;
  isEnabled: boolean;
} {
  const { data: sprints = [] } = useTechSprints();
  const sprint = useMemo(
    () => (sprintId ? sprints.find((s) => s.id === sprintId) ?? null : null),
    [sprints, sprintId],
  );

  const committed = sprint?.committed_points_snapshot ?? 0;
  const isEnabled =
    !!sprint && BURNDOWN_STATUSES.has(sprint.status) && committed > 0;

  const eventsQuery = useQuery({
    queryKey: sprintId ? sprintBurndownKeys.one(sprintId) : sprintBurndownKeys.all,
    enabled: isEnabled,
    staleTime: 30_000,
    queryFn: async (): Promise<BurndownEventRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('tech_sprint_burndown_events', {
        _sprint_id: sprintId,
      });
      if (error) throw error;
      return (data ?? []) as BurndownEventRow[];
    },
  });

  const series = useMemo<BurndownSeries>(() => {
    if (!sprint || !isEnabled) return EMPTY_SERIES;

    const events: BurndownEvent[] = (eventsQuery.data ?? []).map((row) => ({
      date: toDayKey(row.event_date),
      type: row.event_type,
      points: row.points,
    }));

    const startDate = toDayKey(sprint.started_at ?? sprint.start_date);
    const endDate = toDayKey(sprint.end_date);
    const today = new Date().toISOString().slice(0, 10);
    const asOf = minDay(today, endDate);

    return computeBurndown({
      committedPoints: committed,
      startDate,
      endDate,
      asOf,
      events,
    });
  }, [sprint, isEnabled, committed, eventsQuery.data]);

  return { series, isLoading: eventsQuery.isLoading, isEnabled };
}
