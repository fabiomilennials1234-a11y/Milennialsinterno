import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TechTag {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
}

export interface TechTaskTag {
  task_id: string;
  tag_id: string;
}

export const techTagKeys = {
  all: ['tech', 'tags'] as const,
  taskTags: (taskId: string) => ['tech', 'taskTags', taskId] as const,
  allTaskTags: ['tech', 'taskTags'] as const,
};

export function useTechTags() {
  return useQuery<TechTag[]>({
    queryKey: techTagKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tech_tags')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as TechTag[];
    },
    staleTime: 60_000,
  });
}

export function useTechTaskTags(taskId?: string) {
  return useQuery<TechTaskTag[]>({
    queryKey: taskId ? techTagKeys.taskTags(taskId) : techTagKeys.allTaskTags,
    queryFn: async () => {
      let query = supabase.from('tech_task_tags').select('*');
      if (taskId) query = query.eq('task_id', taskId);
      const { data, error } = await query;
      if (error) throw error;
      return data as TechTaskTag[];
    },
  });
}

export function useCreateTechTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color: string; created_by: string }) => {
      const { data, error } = await supabase
        .from('tech_tags')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as TechTag;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techTagKeys.all });
    },
  });
}

export function useDeleteTechTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tech_tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techTagKeys.all });
      qc.invalidateQueries({ queryKey: techTagKeys.allTaskTags });
    },
  });
}

export function useAddTaskTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, tagId }: { taskId: string; tagId: string }) => {
      const { error } = await supabase
        .from('tech_task_tags')
        .insert({ task_id: taskId, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: techTagKeys.taskTags(vars.taskId) });
      qc.invalidateQueries({ queryKey: techTagKeys.allTaskTags });
    },
  });
}

export function useRemoveTaskTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, tagId }: { taskId: string; tagId: string }) => {
      const { error } = await supabase
        .from('tech_task_tags')
        .delete()
        .eq('task_id', taskId)
        .eq('tag_id', tagId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: techTagKeys.taskTags(vars.taskId) });
      qc.invalidateQueries({ queryKey: techTagKeys.allTaskTags });
    },
  });
}
