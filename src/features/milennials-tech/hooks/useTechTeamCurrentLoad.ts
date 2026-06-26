import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  computeLoadDistribution,
  type TeamLoadRow,
  type LoadDistribution,
} from '../lib/teamLoad';

// ---------------------------------------------------------------------------
// useTechTeamCurrentLoad (#165) — live open-work snapshot per dev on the ACTIVE
// sprint. tech_team_current_load() returns one row per dev (open_issues,
// open_points) ordered open_points DESC. We fold it through the pure lib to
// layer the honest median + overload/peak flags. RPC not in WIP types yet ->
// localized `as any`, same pattern as useTechVelocity. Identity resolved by the
// consumer via profiles; the RPC exposes only assignee_id.
// ---------------------------------------------------------------------------

const EMPTY_DISTRIBUTION: LoadDistribution = { devs: [], median: 0, devCount: 0 };

export const techTeamCurrentLoadKeys = {
  all: ['tech', 'team', 'current-load'] as const,
};

export function useTechTeamCurrentLoad(): {
  distribution: LoadDistribution;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: techTeamCurrentLoadKeys.all,
    staleTime: 30_000,
    queryFn: async (): Promise<TeamLoadRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('tech_team_current_load');
      if (error) throw error;
      return (data ?? []) as TeamLoadRow[];
    },
  });

  const distribution = useMemo<LoadDistribution>(() => {
    const rows = query.data ?? [];
    if (rows.length === 0) return EMPTY_DISTRIBUTION;
    return computeLoadDistribution(rows);
  }, [query.data]);

  return { distribution, isLoading: query.isLoading };
}
