/* eslint-disable @typescript-eslint/no-explicit-any */
// Supabase types not regenerated — tables are new, `as any` required for PostgREST calls.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DevDailyRow {
  id: string;
  dev_user_id: string;
  filled_by: string;
  date: string;
  did_yesterday: string | null;
  doing_today: string | null;
  blockers: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevInfo {
  user_id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const devDailyKeys = {
  all: ['tech', 'dev-dailies'] as const,
  byDate: (date: string) => [...devDailyKeys.all, date] as const,
  devs: ['tech', 'dev-users'] as const,
};

// ---------------------------------------------------------------------------
// Fetch devs with role='devs'
// ---------------------------------------------------------------------------

export function useTechDevs() {
  return useQuery<DevInfo[]>({
    queryKey: devDailyKeys.devs,
    queryFn: async () => {
      // Get user_ids with 'devs' role
      const { data: roles, error: rolesErr } = await (supabase as any)
        .from('user_roles')
        .select('user_id')
        .eq('role', 'devs');
      if (rolesErr) throw rolesErr;

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map((r: any) => r.user_id);

      // Get names from profiles
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);
      if (profErr) throw profErr;

      return (profiles || []).map((p) => ({
        user_id: p.user_id,
        name: p.name ?? 'Sem nome',
      }));
    },
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Fetch dailies for a date
// ---------------------------------------------------------------------------

export function useTechDevDailies(date: string) {
  return useQuery<DevDailyRow[]>({
    queryKey: devDailyKeys.byDate(date),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tech_dev_dailies')
        .select('*')
        .eq('date', date);
      if (error) throw error;
      return (data || []) as DevDailyRow[];
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Upsert daily
// ---------------------------------------------------------------------------

export interface UpsertDevDailyInput {
  dev_user_id: string;
  date: string;
  did_yesterday?: string | null;
  doing_today?: string | null;
  blockers?: string | null;
  notes?: string | null;
}

export function useUpsertDevDaily() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpsertDevDailyInput) => {
      const { data, error } = await (supabase as any)
        .from('tech_dev_dailies')
        .upsert(
          {
            dev_user_id: input.dev_user_id,
            filled_by: user!.id,
            date: input.date,
            did_yesterday: input.did_yesterday ?? null,
            doing_today: input.doing_today ?? null,
            blockers: input.blockers ?? null,
            notes: input.notes ?? null,
          },
          { onConflict: 'dev_user_id,date' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: UpsertDevDailyInput) => {
      qc.invalidateQueries({ queryKey: devDailyKeys.byDate(variables.date) });
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar daily', { description: err.message });
    },
  });
}
