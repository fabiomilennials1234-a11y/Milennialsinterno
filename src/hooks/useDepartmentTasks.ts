import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActionJustification } from '@/contexts/JustificationContext';
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
  // Extended fields for financeiro_tasks integration
  _source?: 'department' | 'financeiro';
  _financeiroMeta?: {
    clientId: string;
    productSlug: string;
  };
}

export function useDepartmentTasks(department: string, type: 'daily' | 'weekly' = 'daily') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['department-tasks', user?.id, department, type],
    queryFn: async () => {
      // 1. Fetch regular department tasks (personal, per user)
      const { data, error } = await supabase
        .from('department_tasks')
        .select('*')
        .eq('user_id', user?.id)
        .eq('department', department)
        .eq('task_type', type)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const departmentTasks = (data || []).map(t => ({
        ...t,
        _source: 'department' as const,
      })) as DepartmentTask[];

      // 2. For financeiro department, also fetch team-level financeiro_tasks
      if (department === 'financeiro' && type === 'daily') {
        const { data: finTasks, error: finError } = await supabase
          .from('financeiro_tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (!finError && finTasks) {
          const mappedFinTasks: DepartmentTask[] = finTasks.map(ft => ({
            id: ft.id,
            user_id: user?.id || '',
            title: ft.title,
            description: ft.product_slug,
            task_type: 'daily' as const,
            status: ft.status === 'done' ? 'done' as const : 'todo' as const,
            priority: 'normal',
            due_date: ft.due_date,
            department: 'financeiro',
            related_client_id: ft.client_id,
            created_at: ft.created_at,
            updated_at: ft.created_at,
            archived: false,
            archived_at: null,
            _source: 'financeiro' as const,
            _financeiroMeta: {
              clientId: ft.client_id,
              productSlug: ft.product_slug,
            },
          }));

          return [...mappedFinTasks, ...departmentTasks];
        }
      }

      return departmentTasks;
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
  const { user } = useAuth();
  const { requireJustification } = useActionJustification();

  return useMutation({
    mutationFn: async ({ taskId, status, _source, _financeiroMeta, taskTitle }: {
      taskId: string;
      status: 'todo' | 'doing' | 'done';
      _source?: 'department' | 'financeiro';
      _financeiroMeta?: { clientId: string; productSlug: string };
      taskTitle?: string;
    }) => {
      if (_source === 'financeiro') {
        // Map department status back to financeiro_tasks status
        const finStatus = status === 'todo' ? 'pending' : status; // todo→pending, doing→doing, done→done

        if (status === 'done') {
          // J1: Require justification before completing financeiro task
          await requireJustification({
            title: 'Justificativa: Tarefa Concluída',
            subtitle: 'Registro obrigatório',
            message: 'Descreva o que foi feito para concluir esta tarefa (ex: "cobrei boleto", "enviei contrato").',
            taskId: taskId,
            taskTable: 'financeiro_task_done',
            taskTitle: taskTitle || 'Tarefa financeira concluída',
          });

          // 1. Mark the financeiro_task as done
          const { error: taskError } = await supabase
            .from('financeiro_tasks')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('id', taskId);

          if (taskError) throw taskError;

          // 2. Activate THIS PRODUCT in financeiro_active_clients (per-product)
          if (_financeiroMeta) {
            const { data: pvData } = await supabase
              .from('client_product_values')
              .select('monthly_value')
              .eq('client_id', _financeiroMeta.clientId)
              .eq('product_slug', _financeiroMeta.productSlug)
              .single();

            const productValue = Number(pvData?.monthly_value || 0);

            if (productValue > 0) {
              // Update this specific product's monthly_value (per-product record)
              await supabase
                .from('financeiro_active_clients')
                .update({ monthly_value: productValue })
                .eq('client_id', _financeiroMeta.clientId)
                .eq('product_slug', _financeiroMeta.productSlug);
            }

            // Advance THIS PRODUCT's onboarding to contrato_assinado
            await supabase
              .from('financeiro_client_onboarding')
              .update({ current_step: 'contrato_assinado', updated_at: new Date().toISOString() })
              .eq('client_id', _financeiroMeta.clientId)
              .eq('product_slug', _financeiroMeta.productSlug);

            // N4: Check if ALL financeiro_tasks for this client are now done (for CEO notification)
            const { data: remainingTasks } = await supabase
              .from('financeiro_tasks')
              .select('id')
              .eq('client_id', _financeiroMeta.clientId)
              .neq('status', 'done');

            if (remainingTasks && remainingTasks.length === 0) {
              // All tasks done — notify CEO
              const { data: client } = await supabase
                .from('clients')
                .select('name')
                .eq('id', _financeiroMeta.clientId)
                .single();

              const { data: ceoUsers } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'ceo');

              for (const ceo of ceoUsers || []) {
                await supabase.from('system_notifications').insert({
                  recipient_id: ceo.user_id,
                  recipient_role: 'ceo',
                  notification_type: 'financeiro_tasks_completed',
                  title: '✅ Onboarding Financeiro Completo',
                  message: `Todas as tarefas financeiras do cliente "${client?.name || 'Cliente'}" foram concluídas.`,
                  client_id: _financeiroMeta.clientId,
                  priority: 'medium',
                  metadata: { completed_by: user?.id },
                } as any);
              }
            }
          }
        } else {
          // Just update the status (pending or doing)
          const { error } = await supabase
            .from('financeiro_tasks')
            .update({ status: finStatus })
            .eq('id', taskId);

          if (error) throw error;
        }

        return { _source: 'financeiro' as const, status };
      }

      // Normal department_tasks update
      const { error } = await supabase
        .from('department_tasks')
        .update({ status } as any)
        .eq('id', taskId);

      if (error) throw error;

      // When a financeiro department_task is completed, activate THIS PRODUCT
      let financeiroCompleted = false;
      let allClientTasksDone = false;
      if (status === 'done') {
        const { data: taskData } = await supabase
          .from('department_tasks')
          .select('related_client_id, department, description')
          .eq('id', taskId)
          .single();

        if (taskData?.department === 'financeiro' && taskData.related_client_id) {
          const clientId = taskData.related_client_id;
          const productSlug = taskData.description; // product_slug is stored in description
          financeiroCompleted = true;

          if (productSlug) {
            // Get this product's value
            const { data: pvData } = await supabase
              .from('client_product_values')
              .select('monthly_value')
              .eq('client_id', clientId)
              .eq('product_slug', productSlug)
              .maybeSingle();

            const productValue = Number(pvData?.monthly_value || 0);

            // Activate THIS product in financeiro_active_clients
            if (productValue > 0) {
              await supabase
                .from('financeiro_active_clients')
                .update({ monthly_value: productValue })
                .eq('client_id', clientId)
                .eq('product_slug', productSlug);
            }

            // Advance THIS product's onboarding to contrato_assinado
            await supabase
              .from('financeiro_client_onboarding')
              .update({ current_step: 'contrato_assinado', updated_at: new Date().toISOString() })
              .eq('client_id', clientId)
              .eq('product_slug', productSlug);
          }

          // Check if ALL financeiro department_tasks for this client are now done (for toast message)
          const { data: allClientTasks } = await supabase
            .from('department_tasks')
            .select('id, status')
            .eq('related_client_id', clientId)
            .eq('department', 'financeiro')
            .eq('archived', false);

          allClientTasksDone = !!(allClientTasks && allClientTasks.length > 0
            && allClientTasks.every((t: any) => t.status === 'done'));
        }
      }

      return { _source: 'department' as const, status, financeiroCompleted, allClientTasksDone };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      if (result?.financeiroCompleted) {
        queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
        queryClient.invalidateQueries({ queryKey: ['financeiro-onboarding'] });
        queryClient.invalidateQueries({ queryKey: ['novo-cliente-product-values'] });
        if (result?.allClientTasksDone) {
          toast.success('Todas as tarefas concluídas! Cliente ativado.');
        } else {
          toast.success('Tarefa concluída!');
        }
      }
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
    mutationFn: async ({ taskId, _source }: { taskId: string; _source?: 'department' | 'financeiro' }) => {
      // Financeiro tasks don't support archiving — just skip
      if (_source === 'financeiro') return;

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
    mutationFn: async ({ taskId, _source }: { taskId: string; _source?: 'department' | 'financeiro' }) => {
      // Financeiro tasks should not be deleted from here
      if (_source === 'financeiro') return;

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
