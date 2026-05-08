/* eslint-disable @typescript-eslint/no-explicit-any */
// Supabase types not regenerated — tables are new, `as any` required for PostgREST calls.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectDailyStatus = 'on_track' | 'at_risk' | 'blocked';

export interface ProjectDailyRow {
  id: string;
  project_id: string;
  filled_by: string;
  date: string;
  status: ProjectDailyStatus;
  progress_today: string | null;
  next_steps: string | null;
  blockers: string | null;
  completion_pct: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const projectDailyKeys = {
  all: ['tech', 'project-dailies'] as const,
  byDate: (date: string) => [...projectDailyKeys.all, date] as const,
};

// ---------------------------------------------------------------------------
// Fetch project dailies for a date
// ---------------------------------------------------------------------------

export function useTechProjectDailies(date: string) {
  return useQuery<ProjectDailyRow[]>({
    queryKey: projectDailyKeys.byDate(date),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tech_project_dailies')
        .select('*')
        .eq('date', date);
      if (error) throw error;
      return (data || []) as ProjectDailyRow[];
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Upsert project daily
// ---------------------------------------------------------------------------

export interface UpsertProjectDailyInput {
  project_id: string;
  date: string;
  status?: ProjectDailyStatus;
  progress_today?: string | null;
  next_steps?: string | null;
  blockers?: string | null;
  completion_pct?: number;
}

export function useUpsertProjectDaily() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpsertProjectDailyInput) => {
      const { data, error } = await (supabase as any)
        .from('tech_project_dailies')
        .upsert(
          {
            project_id: input.project_id,
            filled_by: user!.id,
            date: input.date,
            status: input.status ?? 'on_track',
            progress_today: input.progress_today ?? null,
            next_steps: input.next_steps ?? null,
            blockers: input.blockers ?? null,
            completion_pct: input.completion_pct ?? 0,
          },
          { onConflict: 'project_id,date' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: UpsertProjectDailyInput) => {
      qc.invalidateQueries({ queryKey: projectDailyKeys.byDate(variables.date) });
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar daily do projeto', { description: err.message });
    },
  });
}
