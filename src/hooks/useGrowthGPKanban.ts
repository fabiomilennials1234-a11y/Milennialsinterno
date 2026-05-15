import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fireCelebration } from '@/lib/confetti';

// ── Types ──────────────────────────────────────────────────────────────────

export type GrowthGPStep =
  | 'novos_clientes'
  | 'call_1_agendada'
  | 'call_1_realizada'
  | 'acompanhamento_gestores';

export interface GrowthGPClient {
  id: string;
  name: string;
  razao_social: string | null;
  growth_gp_step: string | null;
  growth_counter_started_at: string | null;
  growth_counter_ended_at: string | null;
  assigned_ads_manager: string | null;
  group_id: string | null;
  created_at: string;
}

export interface GrowthGPTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  related_client_id: string | null;
  created_at: string;
}

// ── Valid V2 task description discriminators ──
const V2_TASK_DESCRIPTIONS = new Set([
  'growth:marcar_call_1',
  'growth:realizar_call_1',
  'growth:alinhar_projeto',
  'growth:brifar_crm',
  'growth:brifar_crm_alinhar',
]);

export function isGrowthV2Task(task: { description?: string | null }): boolean {
  if (!task.description) return false;
  return V2_TASK_DESCRIPTIONS.has(task.description);
}

// ── Queries ────────────────────────────────────────────────────────────────

const SELECT_COLS =
  'id, name, razao_social, growth_gp_step, growth_counter_started_at, growth_counter_ended_at, assigned_ads_manager, group_id, created_at';

/**
 * Novos Clientes column: clients in the first 3 GP steps.
 * (novos_clientes, call_1_agendada, call_1_realizada)
 */
export function useGrowthGPNovosClientes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['growth-gp-novos', user?.group_id],
    queryFn: async (): Promise<GrowthGPClient[]> => {
      if (!user?.group_id) return [];

      const { data, error } = await supabase
        .from('clients')
        .select(SELECT_COLS)
        .eq('archived', false)
        .eq('group_id', user.group_id)
        .in('growth_gp_step', ['novos_clientes', 'call_1_agendada', 'call_1_realizada'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as GrowthGPClient[];
    },
    enabled: !!user?.id && !!user?.group_id,
    staleTime: 30_000,
  });
}

/**
 * Acompanhamento column: clients in acompanhamento_gestores step.
 */
export function useGrowthGPAcompanhamento() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['growth-gp-acompanhamento', user?.group_id],
    queryFn: async (): Promise<GrowthGPClient[]> => {
      if (!user?.group_id) return [];

      const { data, error } = await supabase
        .from('clients')
        .select(SELECT_COLS)
        .eq('archived', false)
        .eq('group_id', user.group_id)
        .eq('growth_gp_step', 'acompanhamento_gestores')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as GrowthGPClient[];
    },
    enabled: !!user?.id && !!user?.group_id,
    staleTime: 30_000,
  });
}

/**
 * Fetch GP auto-tasks for a batch of Growth clients.
 * Returns Map<clientId, GrowthGPTask[]>.
 */
export function useGrowthGPTasks(clientIds: string[]) {
  const sortedIds = [...clientIds].sort();
  const key = sortedIds.join(',');

  return useQuery({
    queryKey: ['growth-gp-v2-tasks', key],
    queryFn: async () => {
      if (sortedIds.length === 0) return new Map<string, GrowthGPTask[]>();

      const { data, error } = await supabase
        .from('department_tasks')
        .select('id, title, description, status, due_date, related_client_id, created_at')
        .eq('department', 'gestor_projetos')
        .eq('archived', false)
        .in('related_client_id', sortedIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const map = new Map<string, GrowthGPTask[]>();
      for (const id of sortedIds) map.set(id, []);
      for (const task of (data || []) as GrowthGPTask[]) {
        if (task.related_client_id) {
          const list = map.get(task.related_client_id);
          if (list) list.push(task);
        }
      }
      return map;
    },
    enabled: sortedIds.length > 0,
    staleTime: 15_000,
  });
}

/**
 * Resolve assigned_ads_manager UUIDs to profile names.
 * Returns Map<userId, name>.
 */
export function useAdsManagerNames(managerIds: string[]) {
  const sorted = [...new Set(managerIds.filter(Boolean))].sort();
  const key = sorted.join(',');

  return useQuery({
    queryKey: ['ads-manager-names', key],
    queryFn: async (): Promise<Map<string, string>> => {
      if (sorted.length === 0) return new Map();

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', sorted);

      if (error) throw error;

      const map = new Map<string, string>();
      for (const p of (data || []) as { user_id: string; name: string }[]) {
        if (p.name) map.set(p.user_id, p.name);
      }
      return map;
    },
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Advance a client to the next growth_gp_step via the server RPC.
 * Handles CX block validation, team assignment requirement, etc.
 */
export function useGrowthAdvanceStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      newStep,
    }: {
      clientId: string;
      newStep: string;
    }) => {
      const { data, error } = await supabase.rpc('growth_advance_gp_step', {
        p_client_id: clientId,
        p_new_step: newStep,
      });
      if (error) throw error;
      return data as { success: boolean; previous_step: string; new_step: string };
    },
    onSuccess: () => {
      fireCelebration();
      toast.success('Step avancado!');
      queryClient.invalidateQueries({ queryKey: ['growth-gp-novos'] });
      queryClient.invalidateQueries({ queryKey: ['growth-gp-acompanhamento'] });
      queryClient.invalidateQueries({ queryKey: ['growth-gp-v2-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['client-tags'] });
      queryClient.invalidateQueries({ queryKey: ['client-tags-batch'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      // Also invalidate old V1 queries in case anything references them
      queryClient.invalidateQueries({ queryKey: ['growth-novos-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['growth-acompanhamento'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao avancar step', { description: error.message });
    },
  });
}

/**
 * Mark a GP auto-task as done.
 * Simple status update — the RPC handles the step transitions server-side.
 */
export function useCompleteGrowthGPTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      const { error } = await supabase
        .from('department_tasks')
        .update({ status: 'done' } as never)
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      fireCelebration();
      toast.success('Tarefa concluida!');
      queryClient.invalidateQueries({ queryKey: ['growth-gp-v2-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao concluir tarefa', { description: error.message });
    },
  });
}
