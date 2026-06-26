import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// useTechBillingHours (#164) — period-clipped hours, project + client grain.
//
// tech_billing_hours(p_start, p_end) returns one row per project that logged
// time in the window, carrying its client (NULL for unattributed projects) and
// the clipped second total. The client-side rollup (hours per client, drill by
// project) is a group of these rows — the RPC stays at project grain so a
// project under no client is never invented into a phantom group.
//
// The RPC isn't in the WIP-regenerated types yet -> localized `as any`, same
// pattern as useTechTeamThroughput / useTechVelocity. queryKey carries the
// window so each range caches independently; staleTime ~10s mirrors the other
// reporting hooks.
// ---------------------------------------------------------------------------

export interface BillingHoursRow {
  project_id: string;
  project_name: string;
  client_id: string | null;
  client_name: string | null;
  total_seconds: number;
  issue_count: number;
}

export interface UseTechBillingHoursArgs {
  start?: string | null;
  end?: string | null;
}

export const techBillingHoursKeys = {
  all: ['tech', 'billing', 'hours'] as const,
  range: (start?: string | null, end?: string | null) =>
    [...techBillingHoursKeys.all, start ?? null, end ?? null] as const,
};

export function useTechBillingHours({ start, end }: UseTechBillingHoursArgs = {}) {
  return useQuery({
    queryKey: techBillingHoursKeys.range(start, end),
    staleTime: 10_000,
    queryFn: async (): Promise<BillingHoursRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('tech_billing_hours', {
        p_start: start ?? null,
        p_end: end ?? null,
      });
      if (error) throw error;
      return (data ?? []) as BillingHoursRow[];
    },
  });
}
