import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface DepartmentTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  task_type: 'daily' | 'weekly';
  status: 'todo' | 'doing' | 'done';
  priority: string | null;
  due_date: string | null;
  department: string;
  related_client_id: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  archived_at: string | null;
}

export function useDepartmentTasks(department: string, type: 'daily' | 'weekly' = 'daily') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['department-tasks', user?.id, department, type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('department_tasks')
        .select('*')
        .eq('user_id', user?.id)
        .eq('department', department)
        .eq('task_type', type)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DepartmentTask[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateDepartmentTask(department: string) {
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
          department,
          related_client_id: taskData.related_client_id || null,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Tarefa criada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar tarefa', { description: error.message });
    },
  });
}

export function useUpdateDepartmentTaskStatus(department: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: 'todo' | 'doing' | 'done' }) => {
      const { error } = await supabase
        .from('department_tasks')
        .update({ status } as any)
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar tarefa', { description: error.message });
    },
  });
}

export function useUpdateDepartmentTask(department: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, ...data }: { taskId: string; title?: string; description?: string }) => {
      const { error } = await supabase
        .from('department_tasks')
        .update(data as any)
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Tarefa atualizada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar tarefa', { description: error.message });
    },
  });
}

export function useArchiveDepartmentTask(department: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('department_tasks')
        .update({ 
          archived: true, 
          archived_at: new Date().toISOString() 
        } as any)
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Tarefa arquivada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao arquivar tarefa', { description: error.message });
    },
  });
}

export function useDeleteDepartmentTask(department: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('department_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Tarefa excluída!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir tarefa', { description: error.message });
    },
  });
}
