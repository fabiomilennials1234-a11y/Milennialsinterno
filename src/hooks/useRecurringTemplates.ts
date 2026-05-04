import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/auth';
import { toast } from 'sonner';

export interface RecurringTemplate {
  id: string;
  title: string;
  description: string | null;
  department: string;
  target_role: UserRole;
  recurrence: string;
  task_type: string;
  priority: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

type CreatePayload = {
  title: string;
  description?: string | null;
  department: string;
  target_role: UserRole;
  recurrence: string;
  task_type: string;
  priority: string;
};

type UpdatePayload = Partial<CreatePayload> & { is_active?: boolean };

const QUERY_KEY = ['recurring-task-templates'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export function useRecurringTemplates() {
  return useQuery<RecurringTemplate[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await sb
        .from('recurring_task_templates')
        .select('id, title, description, department, target_role, recurrence, task_type, priority, is_active, created_by, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RecurringTemplate[];
    },
  });
}

export function useCreateRecurringTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('auth required');

      const { data, error } = await sb
        .from('recurring_task_templates')
        .insert({
          ...payload,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Template criado');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar template: ${err.message}`);
    },
  });
}

export function useUpdateRecurringTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePayload & { id: string }) => {
      const { data, error } = await sb
        .from('recurring_task_templates')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Template atualizado');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar template: ${err.message}`);
    },
  });
}

export function useDeleteRecurringTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from('recurring_task_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Template excluído');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir template: ${err.message}`);
    },
  });
}

export function useGenerateRecurringTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc('generate_recurring_tasks');
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count: number) => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success(`${count} tarefa(s) gerada(s)`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao gerar tarefas: ${err.message}`);
    },
  });
}
