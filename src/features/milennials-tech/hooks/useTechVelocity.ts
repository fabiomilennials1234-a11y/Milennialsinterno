import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  computeVelocity,
  type VelocitySprintInput,
  type VelocitySeries,
} from '../lib/velocity';

// ---------------------------------------------------------------------------
// useTechVelocity (#163) — the data-wired velocity series, cross-sprint.
//
// Unlike the burndown (one sprint, keyed by id), velocity is global: one bar per
// CLOSED sprint. tech_velocity_series() returns every COMPLETED sprint with its
// committed snapshot and Σ DONE parent points already aggregated (#162 contract),
// ordered closed_at ASC. We fold it through the pure lib/velocity arithmetic for
// the rolling average. The RPC isn't in the WIP-regenerated types yet -> localized
// `as any`, same pattern as useSprintBurndown.
// ---------------------------------------------------------------------------

interface VelocityRow {
  sprint_id: string;
  name: string;
  committed_points: number;
  delivered_points: number;
  closed_at: string;
  started_at: string | null;
}

const EMPTY_SERIES: VelocitySeries = {
  points: [],
  averageVelocity: 0,
  window: 0,
  sprintCount: 0,
};

export const techVelocityKeys = {
  all: ['tech', 'velocity'] as const,
};

export function useTechVelocity(): {
  series: VelocitySeries;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: techVelocityKeys.all,
    staleTime: 30_000,
    queryFn: async (): Promise<VelocityRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('tech_velocity_series');
      if (error) throw error;
      return (data ?? []) as VelocityRow[];
    },
  });

  const series = useMemo<VelocitySeries>(() => {
    const rows = query.data ?? [];
    if (rows.length === 0) return EMPTY_SERIES;

    const inputs: VelocitySprintInput[] = rows.map((row) => ({
      sprintId: row.sprint_id,
      name: row.name,
      committedPoints: row.committed_points,
      deliveredPoints: row.delivered_points,
      closedAt: row.closed_at,
    }));

    return computeVelocity(inputs);
  }, [query.data]);

  return { series, isLoading: query.isLoading };
}
