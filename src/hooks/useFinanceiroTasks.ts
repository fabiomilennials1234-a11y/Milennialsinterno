import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FinanceiroTask {
  id: string;
  client_id: string;
  product_slug: string;
  product_name: string;
  title: string;
  due_date: string | null;
  status: 'pending' | 'done';
  completed_at: string | null;
  created_at: string;
  client?: {
    id: string;
    name: string;
    razao_social: string | null;
    cnpj: string | null;
    cpf: string | null;
    niche: string | null;
    entry_date: string | null;
    assigned_ads_manager: string | null;
    archived: boolean;
  };
  product_value?: number;
}

export function useFinanceiroTasks() {
  const queryClient = useQueryClient();

  // Fetch all financeiro tasks with client data
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['financeiro-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_tasks')
        .select(`
          *,
          client:clients(id, name, razao_social, cnpj, cpf, niche, entry_date, assigned_ads_manager, archived)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out archived clients
      const filtered = (data || []).filter((t: any) => t.client && !t.client.archived);

      // Fetch product values for all tasks
      const clientIds = [...new Set(filtered.map((t: any) => t.client_id))];
      if (clientIds.length === 0) return [] as FinanceiroTask[];

      const { data: productValues } = await supabase
        .from('client_product_values')
        .select('client_id, product_slug, monthly_value')
        .in('client_id', clientIds);

      const pvMap = new Map<string, number>();
      (productValues || []).forEach((pv: any) => {
        pvMap.set(`${pv.client_id}:${pv.product_slug}`, Number(pv.monthly_value));
      });

      return filtered.map((t: any) => ({
        ...t,
        product_value: pvMap.get(`${t.client_id}:${t.product_slug}`) || 0,
      })) as FinanceiroTask[];
    },
  });

  // Get pending tasks (for "Novo Cliente" column)
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  // Get completed tasks
  const completedTasks = tasks.filter(t => t.status === 'done');

  // Complete a task (mark as done) and update financeiro_active_clients value
  const completeTask = useMutation({
    mutationFn: async ({ taskId, clientId, productValue }: {
      taskId: string;
      clientId: string;
      productValue: number;
    }) => {
      // 1. Mark task as done
      const { error: taskError } = await supabase
        .from('financeiro_tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // 2. Check if client already exists in financeiro_active_clients
      const { data: existing } = await supabase
        .from('financeiro_active_clients')
        .select('id, monthly_value')
        .eq('client_id', clientId)
        .single();

      if (existing) {
        // Update: add the product value to the existing monthly_value
        const newValue = Number(existing.monthly_value) + productValue;
        const { error: updateError } = await supabase
          .from('financeiro_active_clients')
          .update({ monthly_value: newValue })
          .eq('client_id', clientId);

        if (updateError) throw updateError;
      }
      // If no existing record, the client was already inserted at creation with monthly_value=0
      // This shouldn't happen in normal flow since useCreateClient inserts with monthly_value=0

      return { taskId, clientId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-active-clients'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-onboarding'] });
      toast.success('Tarefa concluída! Produto cadastrado no Asaas.');
    },
    onError: (error) => {
      toast.error('Erro ao concluir tarefa: ' + (error as Error).message);
    },
  });

  // Get unique clients that have at least one completed task
  const getClientsWithCompletedTasks = () => {
    const clientMap = new Map<string, {
      clientId: string;
      completedValue: number;
      totalValue: number;
      completedProducts: string[];
      pendingProducts: string[];
    }>();

    for (const task of tasks) {
      const key = task.client_id;
      if (!clientMap.has(key)) {
        clientMap.set(key, {
          clientId: key,
          completedValue: 0,
          totalValue: 0,
          completedProducts: [],
          pendingProducts: [],
        });
      }
      const entry = clientMap.get(key)!;
      const value = task.product_value || 0;
      entry.totalValue += value;

      if (task.status === 'done') {
        entry.completedValue += value;
        entry.completedProducts.push(task.product_slug);
      } else {
        entry.pendingProducts.push(task.product_slug);
      }
    }

    return clientMap;
  };

  return {
    tasks,
    pendingTasks,
    completedTasks,
    isLoading,
    completeTask,
    getClientsWithCompletedTasks,
  };
}
