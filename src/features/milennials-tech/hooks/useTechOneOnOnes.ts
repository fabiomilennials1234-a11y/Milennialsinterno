/* eslint-disable @typescript-eslint/no-explicit-any */
// Supabase types not regenerated — tables are new, `as any` required for PostgREST calls.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OneOnOneRow {
  id: string;
  dev_user_id: string;
  dev_name: string;
  reviewer_user_id: string;
  reviewer_name: string;
  week_start: string;
  performance_rating: number;
  positives: string | null;
  improvements: string | null;
  agreements: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevWeekContext {
  tasks_completed: number;
  tasks_delayed: number;
  dailies_filled: number;
  dailies_total: number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const oneOnOneKeys = {
  all: ['tech', 'one-on-ones'] as const,
  byDev: (devId: string) => [...oneOnOneKeys.all, devId] as const,
  context: (devId: string, weekStart: string) =>
    ['tech', 'one-on-one-context', devId, weekStart] as const,
};

// ---------------------------------------------------------------------------
// Fetch 1:1s for a dev (or all)
// ---------------------------------------------------------------------------

export function useTechOneOnOnes(devUserId?: string) {
  return useQuery<OneOnOneRow[]>({
    queryKey: devUserId ? oneOnOneKeys.byDev(devUserId) : oneOnOneKeys.all,
    queryFn: async () => {
      // Fetch meetings
      let query = (supabase as any)
        .from('tech_one_on_ones')
        .select('*')
        .order('week_start', { ascending: false });

      if (devUserId) {
        query = query.eq('dev_user_id', devUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Get unique user IDs for profile lookup
      const userIds = new Set<string>();
      for (const r of data) {
        userIds.add(r.dev_user_id);
        userIds.add(r.reviewer_user_id);
      }

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', Array.from(userIds));
      if (profErr) throw profErr;

      const nameMap: Record<string, string> = {};
      for (const p of profiles || []) {
        nameMap[p.user_id] = p.name ?? 'Sem nome';
      }

      return data.map((r: any) => ({
        id: r.id,
        dev_user_id: r.dev_user_id,
        dev_name: nameMap[r.dev_user_id] ?? 'Sem nome',
        reviewer_user_id: r.reviewer_user_id,
        reviewer_name: nameMap[r.reviewer_user_id] ?? 'Sem nome',
        week_start: r.week_start,
        performance_rating: r.performance_rating,
        positives: r.positives,
        improvements: r.improvements,
        agreements: r.agreements,
        notes: r.notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })) as OneOnOneRow[];
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Create/update 1:1
// ---------------------------------------------------------------------------

export interface CreateOneOnOneInput {
  dev_user_id: string;
  week_start: string;
  performance_rating: number;
  positives?: string | null;
  improvements?: string | null;
  agreements?: string | null;
  notes?: string | null;
}

export function useCreateOneOnOne() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateOneOnOneInput) => {
      const { data, error } = await (supabase as any)
        .from('tech_one_on_ones')
        .upsert(
          {
            dev_user_id: input.dev_user_id,
            reviewer_user_id: user!.id,
            week_start: input.week_start,
            performance_rating: input.performance_rating,
            positives: input.positives ?? null,
            improvements: input.improvements ?? null,
            agreements: input.agreements ?? null,
            notes: input.notes ?? null,
          },
          { onConflict: 'dev_user_id,week_start' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: oneOnOneKeys.all });
      toast.success('Reuniao 1:1 salva');
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar reuniao', { description: err.message });
    },
  });
}

// ---------------------------------------------------------------------------
// Dev week context (automatic context for 1:1)
// ---------------------------------------------------------------------------

export function useDevWeekContext(devUserId: string | undefined, weekStart: string | undefined) {
  return useQuery<DevWeekContext>({
    queryKey: oneOnOneKeys.context(devUserId ?? '', weekStart ?? ''),
    queryFn: async () => {
      if (!devUserId || !weekStart) {
        return { tasks_completed: 0, tasks_delayed: 0, dailies_filled: 0, dailies_total: 0 };
      }

      // Calculate week end (6 days from start = Sun)
      const start = new Date(weekStart + 'T12:00:00');
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const endStr = end.toISOString().slice(0, 10);

      // Tasks completed that week (updated_at within range + status DONE)
      const { count: completedCount, error: err1 } = await (supabase as any)
        .from('tech_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_id', devUserId)
        .eq('status', 'DONE')
        .gte('updated_at', weekStart + 'T00:00:00')
        .lte('updated_at', endStr + 'T23:59:59');
      if (err1) throw err1;

      // Tasks delayed (deadline passed, status != DONE)
      const today = new Date().toISOString().slice(0, 10);
      const { count: delayedCount, error: err2 } = await (supabase as any)
        .from('tech_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_id', devUserId)
        .neq('status', 'DONE')
        .lt('deadline', today + 'T00:00:00');
      if (err2) throw err2;

      // Dailies filled that week
      const { count: dailiesCount, error: err3 } = await (supabase as any)
        .from('tech_dev_dailies')
        .select('id', { count: 'exact', head: true })
        .eq('dev_user_id', devUserId)
        .gte('date', weekStart)
        .lte('date', endStr);
      if (err3) throw err3;

      // Business days in the week (Mon-Fri)
      let bizDays = 0;
      const cursor = new Date(start);
      for (let i = 0; i < 7; i++) {
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) bizDays++;
        cursor.setDate(cursor.getDate() + 1);
      }

      return {
        tasks_completed: completedCount ?? 0,
        tasks_delayed: delayedCount ?? 0,
        dailies_filled: dailiesCount ?? 0,
        dailies_total: bizDays,
      };
    },
    enabled: !!devUserId && !!weekStart,
    staleTime: 60_000,
  });
}
