import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectTaskTemplate {
  id: string;
  title: string;
  step: string | null;
  task_type: 'daily' | 'weekly';
  is_active: boolean;
  is_project_scoped: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateTemplateInput = Pick<
  ProjectTaskTemplate,
  'title' | 'step' | 'task_type' | 'is_project_scoped'
>;

export type UpdateTemplateInput = Partial<
  Pick<ProjectTaskTemplate, 'title' | 'step' | 'task_type' | 'is_active' | 'is_project_scoped'>
>;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const taskTemplateKeys = {
  all: ['project-task-templates'] as const,
};

// ---------------------------------------------------------------------------
// Query: list all templates
// ---------------------------------------------------------------------------

export function useProjectTaskTemplates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: taskTemplateKeys.all,
    queryFn: async (): Promise<ProjectTaskTemplate[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('project_task_templates')
        .select('*')
        .order('task_type', { ascending: true })
        .order('step', { ascending: true, nullsFirst: false })
        .order('title', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ProjectTaskTemplate[];
    },
    enabled: !!user?.id,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create template
// ---------------------------------------------------------------------------

export function useCreateProjectTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('project_task_templates')
        .insert({
          title: input.title,
          step: input.step || null,
          task_type: input.task_type,
          is_project_scoped: input.is_project_scoped,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all });
      toast.success('Template criado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar template', { description: error.message });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: update template
// ---------------------------------------------------------------------------

export function useUpdateProjectTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateTemplateInput }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('project_task_templates')
        .update(patch)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all });
      toast.success('Template atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar template', { description: error.message });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: delete template
// ---------------------------------------------------------------------------

export function useDeleteProjectTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('project_task_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskTemplateKeys.all });
      toast.success('Template excluido');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir template', { description: error.message });
    },
  });
}
