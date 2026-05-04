import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTargetAdsManager } from '@/contexts/AdsManagerContext';
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

export interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  razao_social: string | null;
  general_info: string | null;
  expected_investment: number | null;
  group_id: string | null;
  squad_id: string | null;
  assigned_ads_manager: string | null;
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

export interface AdsTask {
  id: string;
  ads_manager_id: string;
  title: string;
  description: string | null;
  task_type: 'daily' | 'weekly';
  status: 'todo' | 'doing' | 'done';
  priority: string | null;
  due_date: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface AdsTaskComment {
  id: string;
  task_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface AdsMeeting {
  id: string;
  ads_manager_id: string;
  title: string;
  description: string | null;
  meeting_date: string | null;
  created_at: string;
}

export interface DailyDocumentation {
  id: string;
  ads_manager_id: string;
  client_id: string | null;
  documentation_date: string;
  metrics: string | null;
  actions_done: string | null;
  client_budget: string | null;
  created_at: string;
}

export interface ClientTracking {
  id: string;
  client_id: string;
  ads_manager_id: string;
  current_day: string;
  last_moved_at: string;
  is_delayed: boolean;
}

export interface Justification {
  id: string;
  client_id: string;
  ads_manager_id: string;
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

export interface ClientOnboarding {
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

// Fetch assigned clients for ads manager
// Now filters by the target manager ID from context
export function useAssignedClients() {
  const { user, isCEO } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  
  // Use target user if specified, otherwise use logged-in user
  const effectiveUserId = targetUserId || user?.id;
  
  // If we have a targetUserId, we're viewing a specific manager's board
  // and MUST filter by that manager regardless of CEO status
  const shouldFilterByManager = !!targetUserId || !isCEO;
  
  return useQuery({
    queryKey: ['assigned-clients', effectiveUserId, shouldFilterByManager],
    queryFn: async () => {
      const selectFields = 'id,name,cnpj,cpf,razao_social,general_info,expected_investment,group_id,squad_id,assigned_ads_manager,status,onboarding_started_at,campaign_published_at,created_at,updated_at,archived,archived_at,sales_percentage,entry_date,client_label,contracted_products,torque_crm_products';
      let query = supabase
        .from('clients')
        .select(selectFields)
        .order('created_at', { ascending: false });

      // ALWAYS filter by assigned_ads_manager when viewing a specific manager's board
      if (effectiveUserId && shouldFilterByManager) {
        query = query.eq('assigned_ads_manager', effectiveUserId);
      }

      // Handle archived filtering
      if (!isCEO) {
        query = query.eq('archived', false);
      } else {
        query = query.or('archived.eq.false,and(archived.eq.true,status.eq.churned)');
      }

      const { data, error } = await query;
      if (error) {
        console.error('[useAssignedClients] Query error:', error);
        throw error;
      }

      // Include clients where user is secondary manager
      if (effectiveUserId && shouldFilterByManager) {
        const { data: secondaryRecords, error: secError } = await supabase
          .from('client_secondary_managers')
          .select('client_id, phase')
          .eq('secondary_manager_id', effectiveUserId);

        if (secError) {
          console.error('[useAssignedClients] Secondary manager query error:', secError);
        }

        if (secondaryRecords && secondaryRecords.length > 0) {
          const existingIds = new Set((data || []).map(c => c.id));
          const missingIds = secondaryRecords
            .map(r => r.client_id)
            .filter(id => !existingIds.has(id));

          if (missingIds.length > 0) {
            const { data: secondaryClients, error: clientError } = await supabase
              .from('clients')
              .select(selectFields)
              .in('id', missingIds)
              .eq('archived', false);

            if (clientError) {
              console.error('[useAssignedClients] Secondary clients fetch error:', clientError);
            }

            if (secondaryClients) {
              // Override status for onboarding-phase secondary clients
              // Secondary sees client as "new_client" regardless of actual status
              const phaseMap = new Map(secondaryRecords.map(r => [r.client_id, r.phase]));
              const adjusted = secondaryClients.map(c => {
                if (phaseMap.get(c.id) === 'onboarding') {
                  return { ...c, status: 'new_client' as const };
                }
                return c;
              });
              return [...(data || []), ...adjusted] as Client[];
            }
          }
        }
      }

      return data as Client[];
    },
    enabled: !!effectiveUserId,
    staleTime: 30_000,
    refetchInterval: 10_000,
  });
}

// Fetch ads tasks (only non-archived) - filtered by target manager
export function useAdsTasks(taskType: 'daily' | 'weekly') {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  
  const effectiveUserId = targetUserId || user?.id;
  
  return useQuery({
    queryKey: ['ads-tasks', taskType, effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('ads_tasks')
        .select('*')
        .eq('task_type', taskType)
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false });
      
      if (effectiveUserId) {
        query = query.eq('ads_manager_id', effectiveUserId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as AdsTask[];
    },
    enabled: !!effectiveUserId,
  });
}

// Fetch meetings - filtered by target manager
export function useAdsMeetings() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  
  const effectiveUserId = targetUserId || user?.id;
  
  return useQuery({
    queryKey: ['ads-meetings', effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('ads_meetings')
        .select('*')
        .order('meeting_date', { ascending: true });
      
      if (effectiveUserId) {
        query = query.eq('ads_manager_id', effectiveUserId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as AdsMeeting[];
    },
    enabled: !!effectiveUserId,
  });
}

// Fetch daily documentation - filtered by target manager
export function useDailyDocumentation() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  
  const effectiveUserId = targetUserId || user?.id;
  
  return useQuery({
    queryKey: ['daily-documentation', effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('ads_daily_documentation')
        .select('*')
        .order('documentation_date', { ascending: false });
      
      if (effectiveUserId) {
        query = query.eq('ads_manager_id', effectiveUserId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DailyDocumentation[];
    },
    enabled: !!effectiveUserId,
  });
}

// Fetch client tracking - filtered by target manager with realtime subscription
export function useClientTracking() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const queryClient = useQueryClient();
  
  const effectiveUserId = targetUserId || user?.id;
  
  const query = useQuery({
    queryKey: ['client-tracking', effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('client_daily_tracking')
        .select('*, clients(*)');

      if (effectiveUserId) {
        query = query.eq('ads_manager_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Include tracking for clients where user is secondary manager
      if (effectiveUserId) {
        const { data: secondaryRecords } = await supabase
          .from('client_secondary_managers')
          .select('client_id')
          .eq('secondary_manager_id', effectiveUserId);

        if (secondaryRecords && secondaryRecords.length > 0) {
          const existingClientIds = new Set((data || []).map((t: any) => t.client_id));
          const missingClientIds = secondaryRecords
            .map(r => r.client_id)
            .filter(id => !existingClientIds.has(id));

          if (missingClientIds.length > 0) {
            const { data: secondaryTracking } = await supabase
              .from('client_daily_tracking')
              .select('*, clients(*)')
              .in('client_id', missingClientIds);

            if (secondaryTracking && secondaryTracking.length > 0) {
              return [...(data || []), ...secondaryTracking];
            }
          }
        }
      }

      return data;
    },
    enabled: !!effectiveUserId,
  });

  // Setup realtime subscription for client_daily_tracking changes
  useEffect(() => {
    if (!effectiveUserId) return;
    
    const channel = supabase
      .channel('client-tracking-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_daily_tracking',
        },
        () => {
          // Invalidate queries when tracking changes
          queryClient.invalidateQueries({ queryKey: ['client-tracking'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, queryClient]);

  return query;
}

// Fetch justifications - filtered by target manager
export function useJustifications() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  
  const effectiveUserId = targetUserId || user?.id;
  
  return useQuery({
    queryKey: ['justifications', effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from('ads_justifications')
        .select('*, clients(name)')
        .eq('resolved', false)
        .order('created_at', { ascending: false });
      
      if (effectiveUserId) {
        query = query.eq('ads_manager_id', effectiveUserId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });
}

// Fetch PRO+ tools
export function useProTools() {
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

// Fetch company content (bonus, lemas)
export function useCompanyContent() {
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
export function useClientOnboarding(clientId?: string) {
  return useQuery({
    queryKey: ['client-onboarding', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_onboarding')
        .select('*, clients(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !clientId, // fetch all if no specific client
  });
}

// Mutations
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async (task: { title: string; task_type: 'daily' | 'weekly'; priority?: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('ads_tasks')
        .insert({
          ...task,
          ads_manager_id: effectiveUserId,
          status: 'todo',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ads-tasks', variables.task_type] });
      toast.success('Tarefa criada!');
    },
    onError: () => {
      toast.error('Erro ao criar tarefa');
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  const { requireJustification } = useActionJustification();

  return useMutation({
    mutationFn: async ({ id, status, task_type, taskTitle }: { id: string; status: string; task_type: string; taskTitle?: string }) => {
      // J11: Require justification when marking ads task as done
      if (status === 'done') {
        await requireJustification({
          title: 'Justificativa: Tarefa Concluída',
          subtitle: 'Registro obrigatório',
          message: 'Descreva o resultado desta tarefa e o que foi realizado.',
          taskId: id,
          taskTable: 'ads_task_done',
          taskTitle: taskTitle || 'Tarefa de Ads concluída',
        });
      }

      const { error } = await supabase
        .from('ads_tasks')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      return { id, status, task_type };
    },
    // Optimistic update - update UI immediately before server response
    onMutate: async ({ id, status, task_type }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['ads-tasks', task_type] });
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<AdsTask[]>(['ads-tasks', task_type]);
      
      // Optimistically update to the new value
      if (previousTasks) {
        queryClient.setQueryData<AdsTask[]>(['ads-tasks', task_type], 
          previousTasks.map(task => 
            task.id === id ? { ...task, status: status as AdsTask['status'] } : task
          )
        );
      }
      
      return { previousTasks, task_type };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['ads-tasks', context.task_type], context.previousTasks);
      }
      toast.error('Erro ao mover tarefa');
    },
    onSettled: (_, __, variables) => {
      // Sync with server after mutation settles
      queryClient.invalidateQueries({ queryKey: ['ads-tasks', variables.task_type] });
    },
  });
}

export function useUpdateTask() {
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
        .from('ads_tasks')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-tasks'] });
      toast.success('Tarefa atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar tarefa');
    },
  });
}

// Task Comments
export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('ads_task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as AdsTaskComment[];
    },
    enabled: !!taskId,
  });
}

export function useAddTaskComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      const { data, error } = await supabase
        .from('ads_task_comments')
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
      queryClient.invalidateQueries({ queryKey: ['task-comments', variables.taskId] });
    },
    onError: () => {
      toast.error('Erro ao adicionar comentário');
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, description, title }: { id: string; description?: string; title?: string }) => {
      const updateData: Record<string, string> = {};
      if (description !== undefined) updateData.description = description;
      if (title !== undefined) updateData.title = title;
      
      const { error } = await supabase
        .from('ads_meetings')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-meetings'] });
      toast.success('Reunião atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar reunião');
    },
  });
}

export function useUpdateDocumentation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actions_done }: { id: string; actions_done?: string }) => {
      const { error } = await supabase
        .from('ads_daily_documentation')
        .update({ actions_done })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-documentation'] });
      toast.success('Documentação atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar documentação');
    },
  });
}

export function useMoveClientDay() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async ({ clientId, newDay }: { clientId: string; newDay: string }) => {
      if (!effectiveUserId) {
        console.error('[useMoveClientDay] No effectiveUserId found. targetUserId:', targetUserId, 'user?.id:', user?.id);
        throw new Error('Usuário não autenticado');
      }
      
      
      // First check if tracking exists for this client
      const { data: existing } = await supabase
        .from('client_daily_tracking')
        .select('id, ads_manager_id')
        .eq('client_id', clientId)
        .maybeSingle();

      if (existing) {
        // Update existing record - IMPORTANT: Also update ads_manager_id to ensure proper ownership
        const { error } = await supabase
          .from('client_daily_tracking')
          .update({
            current_day: newDay,
            last_moved_at: new Date().toISOString(),
            is_delayed: false,
            ads_manager_id: effectiveUserId,
          })
          .eq('client_id', clientId);
        
        if (error) {
          console.error('[useMoveClientDay] Error updating:', error);
          throw error;
        }
      } else {
        // Insert new record
        const { error } = await supabase
          .from('client_daily_tracking')
          .insert({
            client_id: clientId,
            ads_manager_id: effectiveUserId,
            current_day: newDay,
            last_moved_at: new Date().toISOString(),
            is_delayed: false,
          });
        
        if (error) {
          console.error('[useMoveClientDay] Error inserting:', error);
          throw error;
        }
      }
      
    },
    onSuccess: () => {
      // Invalidate with specific effectiveUserId
      queryClient.invalidateQueries({ queryKey: ['client-tracking', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['client-tracking'] });
    },
  });
}

export function useUpdateProTool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, content, link }: { id: string; content?: string; link?: string }) => {
      const { error } = await supabase
        .from('pro_tools')
        .update({ content, link })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pro-tools'] });
      toast.success('Ferramenta atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar');
    },
  });
}

export function useUpdateCompanyContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from('company_content')
        .update({ content })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-content'] });
      toast.success('Conteúdo atualizado!');
    },
  });
}

export function useCreateJustification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async ({ clientId, reason, type }: { clientId: string; reason: string; type: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('ads_justifications')
        .insert({
          client_id: clientId,
          ads_manager_id: effectiveUserId,
          reason,
          justification_type: type,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['justifications'] });
      toast.success('Justificativa enviada!');
    },
  });
}

export function useResolveJustification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ads_justifications')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['justifications'] });
    },
  });
}

export function useCreateDocumentation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async (doc: { clientId?: string; metrics: string; actions_done: string; client_budget: string }) => {
      if (!effectiveUserId) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('ads_daily_documentation')
        .insert({
          ads_manager_id: effectiveUserId,
          client_id: doc.clientId,
          metrics: doc.metrics,
          actions_done: doc.actions_done,
          client_budget: doc.client_budget,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-documentation'] });
      toast.success('Documentação salva!');
    },
  });
}

// Upsert documentation for a specific client (one card per client per day)
export function useUpsertClientDocumentation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async (doc: { 
      clientId: string; 
      metrics: string; 
      actions_done: string; 
      client_budget: string;
    }) => {
      if (!effectiveUserId) {
        console.error('[useUpsertClientDocumentation] No effectiveUserId found. targetUserId:', targetUserId, 'user?.id:', user?.id);
        throw new Error('Usuário não autenticado');
      }
      
      
      const today = getDateKeyInBrazilTZ();
      
      // Check if documentation exists for this client today (for THIS specific manager)
      const { data: existing } = await supabase
        .from('ads_daily_documentation')
        .select('id, metrics, actions_done, client_budget')
        .eq('client_id', doc.clientId)
        .eq('ads_manager_id', effectiveUserId)
        .eq('documentation_date', today)
        .maybeSingle();

      if (existing) {
        // Append to existing documentation
        const updatedMetrics = existing.metrics 
          ? `${existing.metrics}\n---\n${doc.metrics}` 
          : doc.metrics;
        const updatedActions = existing.actions_done 
          ? `${existing.actions_done}\n---\n${doc.actions_done}` 
          : doc.actions_done;
        const updatedBudget = doc.client_budget || existing.client_budget;

        const { error } = await supabase
          .from('ads_daily_documentation')
          .update({
            metrics: updatedMetrics,
            actions_done: updatedActions,
            client_budget: updatedBudget,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) {
          console.error('[useUpsertClientDocumentation] Error updating:', error);
          throw error;
        }
      } else {
        // Create new documentation
        const { error } = await supabase
          .from('ads_daily_documentation')
          .insert({
            ads_manager_id: effectiveUserId,
            client_id: doc.clientId,
            metrics: doc.metrics,
            actions_done: doc.actions_done,
            client_budget: doc.client_budget,
          });
        
        if (error) {
          console.error('[useUpsertClientDocumentation] Error inserting:', error);
          throw error;
        }
      }
      
    },
    onSuccess: () => {
      // Invalidate with specific effectiveUserId for proper cache update
      queryClient.invalidateQueries({ queryKey: ['daily-documentation', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['client-documentation', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['daily-documentation'] });
      queryClient.invalidateQueries({ queryKey: ['client-documentation'] });
    },
  });
}

// Fetch documentation grouped by client
export function useClientDocumentation() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const effectiveUserId = targetUserId || user?.id;
  
  return useQuery({
    queryKey: ['client-documentation', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      const { data, error } = await supabase
        .from('ads_daily_documentation')
        .select('*, clients(name)')
        .eq('ads_manager_id', effectiveUserId)
        .order('documentation_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });
}

// Create task from combinado
export function useCreateCombinadoTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const effectiveUserId = targetUserId || user?.id;

  return useMutation({
    mutationFn: async (task: { 
      title: string; 
      dueDate: string;
      clientId: string;
      clientName: string;
    }) => {
      if (!effectiveUserId) {
        console.error('[useCreateCombinadoTask] No effectiveUserId found. targetUserId:', targetUserId, 'user?.id:', user?.id);
        throw new Error('Usuário não autenticado');
      }
      
      
      const { data, error } = await supabase
        .from('ads_tasks')
        .insert({
          ads_manager_id: effectiveUserId,
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
      
      if (error) {
        console.error('[useCreateCombinadoTask] Error:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: (data) => {
      // Invalidate all ads-tasks queries to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['ads-tasks', 'daily', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['ads-tasks', 'daily'] });
      queryClient.invalidateQueries({ queryKey: ['ads-tasks'] });
      toast.success('Tarefa de combinado criada!');
    },
    onError: (error) => {
      console.error('[useCreateCombinadoTask] Mutation error:', error);
      toast.error('Erro ao criar tarefa de combinado');
    },
  });
}

// Archive a task
export function useArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, task_type }: { id: string; task_type: string }) => {
      const { error } = await supabase
        .from('ads_tasks')
        .update({ 
          archived: true, 
          archived_at: new Date().toISOString() 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ads-tasks', variables.task_type] });
      toast.success('Tarefa arquivada!');
    },
    onError: () => {
      toast.error('Erro ao arquivar tarefa');
    },
  });
}

// Delete a task permanently
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, task_type }: { id: string; task_type: string }) => {
      const { error } = await supabase
        .from('ads_tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ads-tasks', variables.task_type] });
      toast.success('Tarefa excluída!');
    },
    onError: () => {
      toast.error('Erro ao excluir tarefa');
    },
  });
}
