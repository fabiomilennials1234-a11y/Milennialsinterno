import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  computeTeamThroughput,
  type TeamThroughputRow,
  type DevThroughput,
} from '../lib/teamThroughput';

// ---------------------------------------------------------------------------
// useTechTeamThroughput (#165) — per-dev delivery across closed sprints.
//
// tech_team_throughput() returns a FLAT (dev × COMPLETED sprint) stream already
// aggregated under the #162 delivered contract, ordered closed_at ASC. We fold
// it through the pure lib into one series per dev (totals + sparkline trail).
// The RPC isn't in the WIP-regenerated types yet -> localized `as any`, same
// pattern as useTechVelocity. Identity (name/avatar) is resolved by the consumer
// via profiles; the RPC exposes only assignee_id.
// ---------------------------------------------------------------------------

export const techTeamThroughputKeys = {
  all: ['tech', 'team', 'throughput'] as const,
};

export function useTechTeamThroughput(): {
  devs: DevThroughput[];
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: techTeamThroughputKeys.all,
    staleTime: 30_000,
    queryFn: async (): Promise<TeamThroughputRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('tech_team_throughput');
      if (error) throw error;
      return (data ?? []) as TeamThroughputRow[];
    },
  });

  const devs = useMemo<DevThroughput[]>(
    () => computeTeamThroughput(query.data ?? []),
    [query.data],
  );

  return { devs, isLoading: query.isLoading };
}
