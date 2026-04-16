import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TechSprint } from '../types';
import type { Database } from '@/integrations/supabase/types';
import { techTaskKeys } from './useTechTasks';

type TechSprintInsert = Database['public']['Tables']['tech_sprints']['Insert'];
type TechSprintUpdate = Database['public']['Tables']['tech_sprints']['Update'];

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const techSprintKeys = {
  all: ['tech', 'sprints'] as const,
  list: () => [...techSprintKeys.all, 'list'] as const,
  one: (id: string) => [...techSprintKeys.all, 'one', id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTechSprints() {
  return useQuery<TechSprint[]>({
    queryKey: techSprintKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tech_sprints')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateTechSprint() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: TechSprintInsert) => {
      const { data, error } = await supabase
        .from('tech_sprints')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techSprintKeys.all });
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
    },
  });
}

export function useUpdateTechSprint() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TechSprintUpdate }) => {
      const { data, error } = await supabase
        .from('tech_sprints')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: techSprintKeys.all });
      qc.invalidateQueries({ queryKey: techSprintKeys.one(variables.id) });
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
    },
  });
}

export function useDeleteTechSprint() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tech_sprints')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techSprintKeys.all });
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Sprint RPC actions
// ---------------------------------------------------------------------------

export function useStartSprint() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_start_sprint', { _sprint_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techSprintKeys.all });
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
    },
  });
}

export function useEndSprint() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('tech_end_sprint', { _sprint_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techSprintKeys.all });
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
    },
  });
}
