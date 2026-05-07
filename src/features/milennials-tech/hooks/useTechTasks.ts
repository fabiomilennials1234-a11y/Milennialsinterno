import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TechTask, TechTaskInsert, TechTaskUpdate, TechTaskStatus, TechTaskType } from '../types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const techTaskKeys = {
  all: ['tech', 'tasks'] as const,
  list: (filters?: TechTaskFilters) => [...techTaskKeys.all, 'list', filters ?? {}] as const,
  one: (id: string) => [...techTaskKeys.all, 'one', id] as const,
};

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface TechTaskFilters {
  sprintId?: string;
  status?: TechTaskStatus;
  type?: TechTaskType;
  assigneeId?: string;
  search?: string;
  projectId?: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTechTasks(filters?: TechTaskFilters) {
  return useQuery<TechTask[]>({
    queryKey: techTaskKeys.list(filters),
    queryFn: async () => {
      // project_id FK exists in DB but supabase types aren't regenerated yet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any).from('tech_tasks').select('*');

      if (filters?.sprintId) {
        query = query.eq('sprint_id', filters.sprintId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.assigneeId) {
        query = query.eq('assignee_id', filters.assigneeId);
      }
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      if (filters?.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
        );
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateTechTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: TechTaskInsert) => {
      const { data, error } = await supabase
        .from('tech_tasks')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
    },
  });
}

export function useUpdateTechTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TechTaskUpdate }) => {
      const { data, error } = await supabase
        .from('tech_tasks')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
      qc.invalidateQueries({ queryKey: techTaskKeys.one(variables.id) });
    },
  });
}

export function useDeleteTechTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tech_tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
    },
  });
}
