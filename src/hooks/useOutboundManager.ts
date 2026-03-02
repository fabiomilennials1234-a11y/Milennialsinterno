import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTargetOutboundManager } from '@/contexts/OutboundManagerContext';
import { useActionJustification } from '@/contexts/JustificationContext';
import { toast } from 'sonner';

// Helper to get date key in Brazil timezone (YYYY-MM-DD)
function getDateKeyInBrazilTZ(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export interface OutboundClient {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  razao_social: string | null;
  general_info: string | null;
  expected_investment: number | null;
  group_id: string | null;
  squad_id: string | null;
  assigned_outbound_manager: string | null;
  status: string;
  onboarding_started_at: string | null;
  campaign_published_at: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  archived_at: string | null;
  sales_percentage: number;
  entry_date: string | null;
  client_label?: 'otimo' | 'bom' | 'medio' | 'ruim' | null;
}

export interface OutboundTask {
  id: string;
  outbound_manager_id: string;
  title: string;
  description: string | null;
  task_type: 'daily' | 'weekly';
  status: 'todo' | 'doing' | 'done';
  priority: string | null;
  due_date: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface OutboundTaskComment {
  id: string;
  task_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface OutboundMeeting {
  id: string;
  outbound_manager_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  meeting_date: string | null;
  created_at: string;
}

export interface OutboundDailyDocumentation {
  id: string;
  outbound_manager_id: string;
  client_id: string | null;
  documentation_date: string;
  metrics: string | null;
  actions_done: string | null;
  client_budget: string | null;
  created_at: string;
}

export interface OutboundClientTracking {
  id: string;
  client_id: string;
  ads_manager_id: string;
  current_day: string;
  last_moved_at: string;
  is_delayed: boolean;
}

export interface OutboundJustification {
  id: string;
  client_id: string;
  outbound_manager_id: string;
  reason: string;
  justification_type: string;
  resolved: boolean;
  created_at: string;
}

export interface ProTool {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  content: string | null;
  link: string | null;
  position: number;
}

export interface CompanyContent {
  id: string;
  slug: string;
  title: string;
  content: string | null;
}

export interface OutboundClientOnboarding {
  id: string;
  client_id: string;
  current_milestone: number;
  current_step: string;
  milestone_1_started_at: string | null;
  milestone_2_started_at: string | null;
  milestone_3_started_at: string | null;
  milestone_4_started_at: string | null;
  milestone_5_started_at: string | null;
  completed_at: string | null;
}

// Fetch assigned clients for outbound manager
export function useOutboundAssignedClients() {
  const { user, isCEO } = useAuth();
  const { targetUserId } = useTargetOutboundManager();

  const effectiveUserId = targetUserId || user?.id;
  const shouldFilterByManager = !!targetUserId || !isCEO;

  return useQuery({
    queryKey: ['outbound-assigned-clients', effectiveUserId, shouldFilterByManager],
    queryFn: async () => {
      const selectFields = 'id,name,cnpj,cpf,razao_social,general_info,expected_investment,group_id,squad_id,assigned_outbound_manager,status,onboarding_started_at,campaign_published_at,created_at,updated_at,archived,archived_at,sales_percentage,entry_date,client_label,contracted_products';
      let query = supabase
        .from('clients')
        .select(selectFields)
        .order('created_at', { ascending: false });

      if (effectiveUserId && shouldFilterByManager) {
        query = query.eq('assigned_outbound_manager', effectiveUserId);
      }

      if (!isCEO) {
        query = query.eq('archived', false);
      } else {
        query = query.or('archived.eq.false,and(archived.eq.true,status.eq.churned)');
      }

      const { data, error } = await query;
      if (error) {
        console.error('[useOutboundAssignedClients] Query error:', error);
        throw error;
      }
      return data as OutboundClient[];
    },
    enabled: !!effectiveUserId,
    staleTime: 30_000,
    refetchInterval: 10_000,
  });
}

// Fetch outbound tasks (only non-archived)
export function useOutboundTasks(taskType: 'daily' | 'weekly') {
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();

  const effectiveUserId = targetUserId || user?.id;

  return useQuery({
    queryKey: ['outbound-tasks', taskType, effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('outbound_tasks')
        .select('*')
        .eq('task_type', taskType)
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false });

      if (effectiveUserId) {
        query = query.eq('outbound_manager_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OutboundTask[];
    },
    enabled: !!effectiveUserId,
  });
}

// Fetch meetings (with client name)
export function useOutboundMeetings() {
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();

  const effectiveUserId = targetUserId || user?.id;

  return useQuery({
    queryKey: ['outbound-meetings', effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('outbound_meetings')
        .select('*, clients(name)')
        .order('meeting_date', { ascending: true });

      if (effectiveUserId) {
        query = query.eq('outbound_manager_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        client_name: m.clients?.name || null,
      })) as (OutboundMeeting & { client_name: string | null })[];
    },
    enabled: !!effectiveUserId,
  });
}

// Create meeting
export function useOutboundCreateMeeting() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async (meeting: { title: string; description?: string; meeting_date: string; client_id: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('outbound_meetings')
        .insert({
          ...meeting,
          outbound_manager_id: effectiveUserId,
          created_by: effectiveUserId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-meetings'] });
      toast.success('Reunião agendada!');
    },
    onError: () => {
      toast.error('Erro ao agendar reunião');
    },
  });
}

// Delete meeting
export function useOutboundDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('outbound_meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-meetings'] });
      toast.success('Reunião excluída!');
    },
    onError: () => {
      toast.error('Erro ao excluir reunião');
    },
  });
}

// Fetch daily documentation
export function useOutboundDailyDocumentation() {
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();

  const effectiveUserId = targetUserId || user?.id;

  return useQuery({
    queryKey: ['outbound-daily-documentation', effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('outbound_daily_documentation')
        .select('*')
        .order('documentation_date', { ascending: false });

      if (effectiveUserId) {
        query = query.eq('outbound_manager_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OutboundDailyDocumentation[];
    },
    enabled: !!effectiveUserId,
  });
}

// Fetch client tracking with realtime subscription
export function useOutboundClientTracking() {
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const queryClient = useQueryClient();

  const effectiveUserId = targetUserId || user?.id;

  const query = useQuery({
    queryKey: ['outbound-client-tracking', effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('client_daily_tracking')
        .select('*, clients(*)');

      if (effectiveUserId) {
        query = query.eq('ads_manager_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  useEffect(() => {
    if (!effectiveUserId) return;

    const channel = supabase
      .channel('outbound-client-tracking-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_daily_tracking',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['outbound-client-tracking'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, queryClient]);

  return query;
}

// Fetch justifications
export function useOutboundJustifications() {
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();

  const effectiveUserId = targetUserId || user?.id;

  return useQuery({
    queryKey: ['outbound-justifications', effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('outbound_justifications')
        .select('*, clients(name)')
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (effectiveUserId) {
        query = query.eq('outbound_manager_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });
}

// Fetch PRO+ tools (shared/global data)
export function useOutboundProTools() {
  return useQuery({
    queryKey: ['pro-tools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pro_tools')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      return data as ProTool[];
    },
  });
}

// Fetch company content (shared/global data)
export function useOutboundCompanyContent() {
  return useQuery({
    queryKey: ['company-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_content')
        .select('*');

      if (error) throw error;
      return data as CompanyContent[];
    },
  });
}

// Fetch client onboarding
export function useOutboundClientOnboarding(clientId?: string) {
  return useQuery({
    queryKey: ['outbound-client-onboarding', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_onboarding')
        .select('*, clients(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !clientId,
  });
}

// Mutations
export function useOutboundCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async (task: { title: string; task_type: 'daily' | 'weekly'; priority?: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('outbound_tasks')
        .insert({
          ...task,
          outbound_manager_id: effectiveUserId,
          status: 'todo',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks', variables.task_type] });
      toast.success('Tarefa criada!');
    },
    onError: () => {
      toast.error('Erro ao criar tarefa');
    },
  });
}

export function useOutboundUpdateTaskStatus() {
  const queryClient = useQueryClient();
  const { requireJustification } = useActionJustification();

  return useMutation({
    mutationFn: async ({ id, status, task_type, taskTitle }: { id: string; status: string; task_type: string; taskTitle?: string }) => {
      if (status === 'done') {
        await requireJustification({
          title: 'Justificativa: Tarefa Concluída',
          subtitle: 'Registro obrigatório',
          message: 'Descreva o resultado desta tarefa e o que foi realizado.',
          taskId: id,
          taskTable: 'outbound_task_done',
          taskTitle: taskTitle || 'Tarefa de Outbound concluída',
        });
      }

      const { error } = await supabase
        .from('outbound_tasks')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      return { id, status, task_type };
    },
    onMutate: async ({ id, status, task_type }) => {
      await queryClient.cancelQueries({ queryKey: ['outbound-tasks', task_type] });

      const previousTasks = queryClient.getQueryData<OutboundTask[]>(['outbound-tasks', task_type]);

      if (previousTasks) {
        queryClient.setQueryData<OutboundTask[]>(['outbound-tasks', task_type],
          previousTasks.map(task =>
            task.id === id ? { ...task, status: status as OutboundTask['status'] } : task
          )
        );
      }

      return { previousTasks, task_type };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['outbound-tasks', context.task_type], context.previousTasks);
      }
      toast.error('Erro ao mover tarefa');
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks', variables.task_type] });
    },
  });
}

export function useOutboundUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      description,
      title,
      tags,
      due_date
    }: {
      id: string;
      description?: string;
      title?: string;
      tags?: string[];
      due_date?: string | null;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (description !== undefined) updateData.description = description;
      if (title !== undefined) updateData.title = title;
      if (tags !== undefined) updateData.tags = tags;
      if (due_date !== undefined) updateData.due_date = due_date;

      const { error } = await supabase
        .from('outbound_tasks')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks'] });
      toast.success('Tarefa atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar tarefa');
    },
  });
}

// Task Comments
export function useOutboundTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ['outbound-task-comments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('outbound_task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as OutboundTaskComment[];
    },
    enabled: !!taskId,
  });
}

export function useOutboundAddTaskComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      const { data, error } = await supabase
        .from('outbound_task_comments')
        .insert({
          task_id: taskId,
          user_id: user?.id,
          author_name: user?.name || 'Usuário',
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-task-comments', variables.taskId] });
    },
    onError: () => {
      toast.error('Erro ao adicionar comentário');
    },
  });
}

export function useOutboundUpdateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, description, title }: { id: string; description?: string; title?: string }) => {
      const updateData: Record<string, string> = {};
      if (description !== undefined) updateData.description = description;
      if (title !== undefined) updateData.title = title;

      const { error } = await supabase
        .from('outbound_meetings')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-meetings'] });
      toast.success('Reunião atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar reunião');
    },
  });
}

export function useOutboundUpdateDocumentation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actions_done }: { id: string; actions_done?: string }) => {
      const { error } = await supabase
        .from('outbound_daily_documentation')
        .update({ actions_done })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-daily-documentation'] });
      toast.success('Documentação atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar documentação');
    },
  });
}

export function useOutboundMoveClientDay() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async ({ clientId, newDay }: { clientId: string; newDay: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');

      const { data: existing } = await supabase
        .from('client_daily_tracking')
        .select('id, ads_manager_id')
        .eq('client_id', clientId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('client_daily_tracking')
          .update({
            current_day: newDay,
            last_moved_at: new Date().toISOString(),
            is_delayed: false,
            ads_manager_id: effectiveUserId,
          })
          .eq('client_id', clientId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_daily_tracking')
          .insert({
            client_id: clientId,
            ads_manager_id: effectiveUserId,
            current_day: newDay,
            last_moved_at: new Date().toISOString(),
            is_delayed: false,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-client-tracking', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['outbound-client-tracking'] });
    },
  });
}

export function useOutboundCreateJustification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async ({ clientId, reason, type }: { clientId: string; reason: string; type: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('outbound_justifications')
        .insert({
          client_id: clientId,
          outbound_manager_id: effectiveUserId,
          reason,
          justification_type: type,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-justifications'] });
      toast.success('Justificativa enviada!');
    },
  });
}

export function useOutboundResolveJustification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('outbound_justifications')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-justifications'] });
    },
  });
}

export function useOutboundCreateDocumentation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async (doc: { clientId?: string; metrics: string; actions_done: string; client_budget: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('outbound_daily_documentation')
        .insert({
          outbound_manager_id: effectiveUserId,
          client_id: doc.clientId,
          metrics: doc.metrics,
          actions_done: doc.actions_done,
          client_budget: doc.client_budget,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-daily-documentation'] });
      queryClient.invalidateQueries({ queryKey: ['outbound-client-documentation'] });
      toast.success('Documentação salva!');
    },
  });
}

export function useOutboundUpsertClientDocumentation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async (doc: {
      clientId: string;
      metrics: string;
      actions_done: string;
      client_budget: string;
    }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');

      const today = getDateKeyInBrazilTZ();

      const { data: existing } = await supabase
        .from('outbound_daily_documentation')
        .select('id, metrics, actions_done, client_budget')
        .eq('client_id', doc.clientId)
        .eq('outbound_manager_id', effectiveUserId)
        .eq('documentation_date', today)
        .maybeSingle();

      if (existing) {
        const updatedMetrics = existing.metrics
          ? `${existing.metrics}\n---\n${doc.metrics}`
          : doc.metrics;
        const updatedActions = existing.actions_done
          ? `${existing.actions_done}\n---\n${doc.actions_done}`
          : doc.actions_done;
        const updatedBudget = doc.client_budget || existing.client_budget;

        const { error } = await supabase
          .from('outbound_daily_documentation')
          .update({
            metrics: updatedMetrics,
            actions_done: updatedActions,
            client_budget: updatedBudget,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('outbound_daily_documentation')
          .insert({
            outbound_manager_id: effectiveUserId,
            client_id: doc.clientId,
            metrics: doc.metrics,
            actions_done: doc.actions_done,
            client_budget: doc.client_budget,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-daily-documentation', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['outbound-client-documentation', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['outbound-daily-documentation'] });
      queryClient.invalidateQueries({ queryKey: ['outbound-client-documentation'] });
    },
  });
}

export function useOutboundClientDocumentation() {
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;

  return useQuery({
    queryKey: ['outbound-client-documentation', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      const { data, error } = await supabase
        .from('outbound_daily_documentation')
        .select('*, clients(name)')
        .eq('outbound_manager_id', effectiveUserId)
        .order('documentation_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });
}

export function useOutboundCreateCombinadoTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async (task: {
      title: string;
      dueDate: string;
      clientId: string;
      clientName: string;
    }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('outbound_tasks')
        .insert({
          outbound_manager_id: effectiveUserId,
          title: task.title,
          description: `Combinado com cliente ${task.clientName}`,
          task_type: 'daily',
          status: 'todo',
          priority: 'high',
          due_date: task.dueDate,
          tags: ['combinado', task.clientName],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks', 'daily', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks', 'daily'] });
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks'] });
      toast.success('Tarefa de combinado criada!');
    },
    onError: () => {
      toast.error('Erro ao criar tarefa de combinado');
    },
  });
}

export function useOutboundArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, task_type }: { id: string; task_type: string }) => {
      const { error } = await supabase
        .from('outbound_tasks')
        .update({
          archived: true,
          archived_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks', variables.task_type] });
      toast.success('Tarefa arquivada!');
    },
    onError: () => {
      toast.error('Erro ao arquivar tarefa');
    },
  });
}

export function useOutboundDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, task_type }: { id: string; task_type: string }) => {
      const { error } = await supabase
        .from('outbound_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-tasks', variables.task_type] });
      toast.success('Tarefa excluída!');
    },
    onError: () => {
      toast.error('Erro ao excluir tarefa');
    },
  });
}

// ─── Auto-create prospection analysis tasks ─────────────────────────────────
const PROSPECTION_TAG = 'type:prospection_analysis';

export function useAutoCreateProspectionTasks() {
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;
  const queryClient = useQueryClient();
  const { data: clients = [] } = useOutboundAssignedClients();
  const { data: tasks = [] } = useOutboundTasks('daily');

  useEffect(() => {
    if (!effectiveUserId || clients.length === 0) return;

    const todayKey = getDateKeyInBrazilTZ();

    // Find which clients already have a prospection task for today
    const clientsWithTask = new Set(
      tasks
        .filter(t =>
          t.tags?.includes(PROSPECTION_TAG) &&
          t.created_at?.startsWith(todayKey)
        )
        .flatMap(t =>
          (t.tags || [])
            .filter(tag => tag.startsWith('client_id:'))
            .map(tag => tag.replace('client_id:', ''))
        )
    );

    // Only create for active (non-archived) clients missing today's task
    const missing = clients.filter(
      c => !c.archived && !clientsWithTask.has(c.id)
    );

    if (missing.length === 0) return;

    const insertAll = async () => {
      const rows = missing.map(client => ({
        outbound_manager_id: effectiveUserId,
        title: `Análise de Prospecção — ${client.name}`,
        task_type: 'daily' as const,
        status: 'todo' as const,
        tags: [PROSPECTION_TAG, `client_id:${client.id}`],
      }));

      const { error } = await supabase
        .from('outbound_tasks')
        .insert(rows);

      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['outbound-tasks', 'daily'] });
      }
    };

    insertAll();
  }, [effectiveUserId, clients.length, tasks.length]);
}

export function isProspectionTask(task: { tags?: string[] | null }): boolean {
  return !!task.tags?.includes(PROSPECTION_TAG);
}

export function getProspectionClientId(task: { tags?: string[] | null }): string | null {
  const tag = task.tags?.find(t => t.startsWith('client_id:'));
  return tag ? tag.replace('client_id:', '') : null;
}

// ─── Weekly task types & helpers ─────────────────────────────────────────────
const WEEKLY_REVISAO_TAG = 'type:revisao_metas';
const WEEKLY_RELATORIO_TAG = 'type:relatorio_interno';
const WEEKLY_REUNIAO_TAG = 'type:reuniao_quinzenal';

export function isWeeklyRevisaoTask(task: { tags?: string[] | null }): boolean {
  return !!task.tags?.includes(WEEKLY_REVISAO_TAG);
}
export function isWeeklyRelatorioTask(task: { tags?: string[] | null }): boolean {
  return !!task.tags?.includes(WEEKLY_RELATORIO_TAG);
}
export function isWeeklyReuniaoTask(task: { tags?: string[] | null }): boolean {
  return !!task.tags?.includes(WEEKLY_REUNIAO_TAG);
}
export function isAutoWeeklyTask(task: { tags?: string[] | null }): boolean {
  return isWeeklyRevisaoTask(task) || isWeeklyRelatorioTask(task) || isWeeklyReuniaoTask(task);
}

/** Returns ISO week key like "2026-W09" in Brazil TZ */
function getWeekKeyInBrazilTZ(date: Date = new Date()): string {
  const brazilDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const jan1 = new Date(brazilDate.getFullYear(), 0, 1);
  const dayOfYear = Math.ceil((brazilDate.getTime() - jan1.getTime()) / 86400000);
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${brazilDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Returns day of week in Brazil TZ (0=Sun, 1=Mon, ..., 5=Fri, 6=Sat) */
function getDayOfWeekBrazilTZ(date: Date = new Date()): number {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay();
}

export function useAutoCreateWeeklyTasks() {
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const effectiveUserId = targetUserId || user?.id;
  const queryClient = useQueryClient();
  const { data: clients = [] } = useOutboundAssignedClients();
  const { data: tasks = [] } = useOutboundTasks('weekly');

  useEffect(() => {
    if (!effectiveUserId || clients.length === 0) return;

    const weekKey = getWeekKeyInBrazilTZ();
    const dayOfWeek = getDayOfWeekBrazilTZ();
    const activeClients = clients.filter(c => !c.archived);
    if (activeClients.length === 0) return;

    // Helper: find tasks of a given type for the current week
    const weekTaskClientIds = (typeTag: string) => new Set(
      tasks
        .filter(t => t.tags?.includes(typeTag) && t.tags?.includes(`week:${weekKey}`))
        .flatMap(t => (t.tags || []).filter(tag => tag.startsWith('client_id:')).map(tag => tag.replace('client_id:', '')))
    );

    const rows: Array<{
      outbound_manager_id: string;
      title: string;
      task_type: 'weekly';
      status: 'todo';
      tags: string[];
    }> = [];

    // ── Revisão de Metas: create on Monday (1) or later if not yet created ──
    if (dayOfWeek >= 1) {
      const existing = weekTaskClientIds(WEEKLY_REVISAO_TAG);
      for (const client of activeClients) {
        if (!existing.has(client.id)) {
          rows.push({
            outbound_manager_id: effectiveUserId,
            title: `Revisão de Metas — ${client.name}`,
            task_type: 'weekly',
            status: 'todo',
            tags: [WEEKLY_REVISAO_TAG, `client_id:${client.id}`, `week:${weekKey}`],
          });
        }
      }
    }

    // ── Relatório Interno: create on Friday (5) or later if not yet created ──
    if (dayOfWeek >= 5 || dayOfWeek === 0) {
      const existing = weekTaskClientIds(WEEKLY_RELATORIO_TAG);
      for (const client of activeClients) {
        if (!existing.has(client.id)) {
          rows.push({
            outbound_manager_id: effectiveUserId,
            title: `Relatório Interno — ${client.name}`,
            task_type: 'weekly',
            status: 'todo',
            tags: [WEEKLY_RELATORIO_TAG, `client_id:${client.id}`, `week:${weekKey}`],
          });
        }
      }
    }

    // ── Reunião Quinzenal: create every other week (even weeks) ──
    const weekNumber = parseInt(weekKey.split('-W')[1], 10);
    if (weekNumber % 2 === 0) {
      const existing = weekTaskClientIds(WEEKLY_REUNIAO_TAG);
      for (const client of activeClients) {
        if (!existing.has(client.id)) {
          rows.push({
            outbound_manager_id: effectiveUserId,
            title: `Reunião Quinzenal — ${client.name}`,
            task_type: 'weekly',
            status: 'todo',
            tags: [WEEKLY_REUNIAO_TAG, `client_id:${client.id}`, `week:${weekKey}`],
          });
        }
      }
    }

    if (rows.length === 0) return;

    const insertAll = async () => {
      const { error } = await supabase.from('outbound_tasks').insert(rows);
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['outbound-tasks', 'weekly'] });
      }
    };

    insertAll();
  }, [effectiveUserId, clients.length, tasks.length]);
}

// ─── Complete outbound onboarding → activate client + move to Acompanhamento ───
export function useOutboundCompleteOnboarding() {
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const queryClient = useQueryClient();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async ({ clientId, clientName }: { clientId: string; clientName: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');

      // 1. Get current day of week in Brazil timezone
      const dayOfWeek = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(new Date());
      const dayMap: Record<string, string> = {
        'Monday': 'segunda', 'Tuesday': 'terca', 'Wednesday': 'quarta',
        'Thursday': 'quinta', 'Friday': 'sexta', 'Saturday': 'segunda', 'Sunday': 'segunda',
      };
      const currentDay = dayMap[dayOfWeek] || 'segunda';

      // 2. Update client status to active
      const { error: clientError } = await supabase
        .from('clients')
        .update({ status: 'active' })
        .eq('id', clientId);
      if (clientError) throw clientError;

      // 3. Mark onboarding as completed
      await supabase
        .from('client_onboarding')
        .update({
          completed_at: new Date().toISOString(),
          current_step: 'acompanhamento',
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', clientId);

      // 4. Create daily tracking record with current day of week
      await supabase
        .from('client_daily_tracking')
        .upsert({
          client_id: clientId,
          ads_manager_id: effectiveUserId,
          current_day: currentDay,
          last_moved_at: new Date().toISOString(),
          is_delayed: false,
        });

      return { clientName, currentDay };
    },
    onSuccess: ({ clientName, currentDay }) => {
      queryClient.invalidateQueries({ queryKey: ['outbound-assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['outbound-client-tracking'] });
      toast.success(`Onboarding concluído! ${clientName} está no Acompanhamento (${currentDay}).`);
    },
    onError: () => {
      toast.error('Erro ao concluir onboarding');
    },
  });
}
