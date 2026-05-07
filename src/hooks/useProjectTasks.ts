import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { DepartmentTask } from './useDepartmentTasks';

// ---------------------------------------------------------------------------
// Query: fetch department_tasks filtered by related_project_id
// ---------------------------------------------------------------------------

export function useProjectTasks(projectId: string, type: 'daily' | 'weekly' = 'daily') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['project-tasks', projectId, type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('department_tasks')
        .select('*, clients:related_client_id(name, razao_social)')
        .eq('related_project_id' as any, projectId)
        .eq('task_type', type)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(t => ({
        ...t,
        _source: 'department' as const,
      })) as DepartmentTask[];
    },
    enabled: !!user?.id && !!projectId,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create a task linked to a project
// ---------------------------------------------------------------------------

export function useCreateProjectTask(projectId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: {
      title: string;
      description?: string;
      task_type?: 'daily' | 'weekly';
      priority?: string;
      due_date?: string;
      related_client_id?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('department_tasks')
        .insert({
          user_id: user.id,
          title: taskData.title,
          description: taskData.description || null,
          task_type: taskData.task_type || 'daily',
          priority: taskData.priority || 'normal',
          due_date: taskData.due_date || null,
          department: 'devs',
          related_client_id: taskData.related_client_id || null,
          related_project_id: projectId,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Tarefa criada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar tarefa', { description: error.message });
    },
  });
}
