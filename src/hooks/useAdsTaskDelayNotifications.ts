import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AdsTaskDelayNotification {
  id: string;
  ads_task_id: string;
  ads_manager_id: string;
  ads_manager_name: string;
  task_title: string;
  task_due_date: string;
  created_at: string;
}

export interface AdsTaskDelayJustification {
  id: string;
  notification_id: string;
  user_id: string;
  user_role: string;
  justification: string;
  created_at: string;
  archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
}

// Roles que recebem notificações de atraso
const DELAY_NOTIFICATION_ROLES = ['gestor_ads', 'sucesso_cliente', 'gestor_projetos', 'ceo'];

// Hook para verificar e criar notificações de tarefas atrasadas de TODOS os gestores de ads
// Pode ser executado por qualquer cargo que recebe notificações
export function useCheckOverdueAdsTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['check-overdue-ads-tasks', user?.id, user?.role],
    queryFn: async () => {
      if (!user?.id || !user?.role) return [];
      
      // Só criar notificações se for um dos cargos relevantes
      if (!DELAY_NOTIFICATION_ROLES.includes(user.role)) return [];

      // Buscar TODAS as tarefas atrasadas de TODOS os gestores de ads
      const { data: tasks, error } = await supabase
        .from('ads_tasks')
        .select('*')
        .or('archived.is.null,archived.eq.false')
        .neq('status', 'done')
        .not('due_date', 'is', null);

      if (error) {
        console.error('Error fetching overdue tasks:', error);
        return [];
      }

      // Filtrar apenas tarefas atrasadas (data de vencimento é anterior a hoje)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Início do dia de hoje
      
      const overdueTasks = (tasks || []).filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0); // Normaliza para comparar apenas datas
        // Tarefa está atrasada se a data de vencimento é anterior a hoje
        return dueDate < today;
      });

      if (overdueTasks.length === 0) return [];

      // Verificar quais tarefas já têm notificação
      const taskIds = overdueTasks.map(t => t.id);

      const { data: existingNotifications } = await (supabase as any)
        .from('ads_task_delay_notifications')
        .select('ads_task_id')
        .in('ads_task_id', taskIds);

      const existingTaskIds = new Set((existingNotifications || []).map((n: any) => n.ads_task_id));

      // Criar notificações para tarefas que ainda não têm
      const newTasks = overdueTasks.filter(t => !existingTaskIds.has(t.id));
      
      for (const task of newTasks) {
        // Buscar nome do gestor separadamente
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', task.ads_manager_id)
          .maybeSingle();
        
        const managerName = profile?.name || 'Gestor de Ads';
        const managerId = task.ads_manager_id;
        
        await (supabase as any)
          .from('ads_task_delay_notifications')
          .insert({
            ads_task_id: task.id,
            ads_manager_id: managerId,
            ads_manager_name: managerName,
            task_title: task.title,
            task_due_date: task.due_date,
          });
      }

      if (newTasks.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['ads-task-delay-notifications'] });
      }

      return overdueTasks;
    },
    enabled: !!user?.id && DELAY_NOTIFICATION_ROLES.includes(user.role || ''),
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Verificar a cada minuto
    staleTime: 30000, // Considerar stale após 30 segundos
  });
}

// Hook para buscar notificações pendentes para o usuário atual
export function useAdsTaskDelayNotifications() {
  const { user } = useAuth();

  // Primeiro executamos o check para criar notificações
  const { isSuccess: checkDone } = useCheckOverdueAdsTasks();

  return useQuery({
    queryKey: ['ads-task-delay-notifications', user?.id, user?.role],
    queryFn: async () => {
      if (!user?.id || !user?.role) return [];

      // Buscar todas as notificações
      const { data: notifications, error } = await (supabase as any)
        .from('ads_task_delay_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      // Buscar justificativas do usuário atual
      const { data: justifications } = await (supabase as any)
        .from('ads_task_delay_justifications')
        .select('notification_id')
        .eq('user_id', user.id);

      const justifiedIds = new Set((justifications || []).map((j: any) => j.notification_id));

      // Filtrar notificações que ainda não foram justificadas pelo usuário
      let pendingNotifications = (notifications || []).filter((n: any) => !justifiedIds.has(n.id));

      // Para gestor_ads, filtrar apenas suas próprias tarefas
      if (user.role === 'gestor_ads') {
        pendingNotifications = pendingNotifications.filter((n: any) => n.ads_manager_id === user.id);
      }

      return pendingNotifications as AdsTaskDelayNotification[];
    },
    enabled: !!user?.id && DELAY_NOTIFICATION_ROLES.includes(user.role || ''),
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
}

// Hook para salvar justificativa
export function useSaveDelayJustification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, justification }: { notificationId: string; justification: string }) => {
      if (!user?.id || !user?.role) throw new Error('User not authenticated');

      // Verificar se já existe justificativa
      const { data: existing } = await (supabase as any)
        .from('ads_task_delay_justifications')
        .select('id')
        .eq('notification_id', notificationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Atualizar justificativa existente
        const { error } = await (supabase as any)
          .from('ads_task_delay_justifications')
          .update({ justification })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Criar nova justificativa
        const { error } = await (supabase as any)
          .from('ads_task_delay_justifications')
          .insert({
            notification_id: notificationId,
            user_id: user.id,
            user_role: user.role,
            justification,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-task-delay-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-delay-justifications'] });
      toast.success('Justificativa salva com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar justificativa', { description: error.message });
    },
  });
}

// Hook para buscar minhas justificativas (para exibir na seção de justificativas)
export function useMyDelayJustifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-delay-justifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await (supabase as any)
        .from('ads_task_delay_justifications')
        .select(`
          *,
          notification:ads_task_delay_notifications(*)
        `)
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

// Hook para buscar justificativas por CARGO (não por usuário logado)
// Usado quando você quer ver as justificativas de um cargo específico na página daquele cargo
export function useDelayJustificationsByRole(targetRole: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['delay-justifications-by-role', targetRole, user?.id],
    queryFn: async () => {
      if (!user?.id) return { active: [], archived: [] };

      // Buscar justificativas onde user_role = targetRole
      const { data, error } = await (supabase as any)
        .from('ads_task_delay_justifications')
        .select(`
          *,
          notification:ads_task_delay_notifications(*)
        `)
        .eq('user_role', targetRole)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Buscar nomes dos usuários separadamente
      const userIds = [...new Set((data || []).map((j: any) => j.user_id))] as string[];
      let profileMap = new Map<string, string>();
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);
        
        profileMap = new Map((profiles || []).map(p => [p.user_id, p.name]));
      }
      
      const enrichedData = (data || []).map((j: any) => ({
        ...j,
        profile: { name: profileMap.get(j.user_id) || 'Usuário' }
      }));
      
      const active = enrichedData.filter((j: any) => !j.archived);
      const archived = enrichedData.filter((j: any) => j.archived);
      
      return { active, archived };
    },
    enabled: !!user?.id && !!targetRole,
  });
}

// Hook para CEO buscar TODAS as justificativas (incluindo arquivadas)
export function useAllDelayJustifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-delay-justifications', user?.id],
    queryFn: async () => {
      if (!user?.id || user.role !== 'ceo') return { active: [], archived: [] };

      const { data, error } = await (supabase as any)
        .from('ads_task_delay_justifications')
        .select(`
          *,
          notification:ads_task_delay_notifications(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Buscar nomes dos usuários separadamente
      const userIds = [...new Set((data || []).map((j: any) => j.user_id))] as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.name]));
      
      const enrichedData = (data || []).map((j: any) => ({
        ...j,
        profile: { name: profileMap.get(j.user_id) || 'Usuário' }
      }));
      
      const active = enrichedData.filter((j: any) => !j.archived);
      const archived = enrichedData.filter((j: any) => j.archived);
      
      return { active, archived };
    },
    enabled: !!user?.id && user.role === 'ceo',
  });
}

// Hook para CEO arquivar/desarquivar justificativas
export function useArchiveJustification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ justificationId, archive }: { justificationId: string; archive: boolean }) => {
      if (!user?.id || user.role !== 'ceo') {
        throw new Error('Apenas o CEO pode arquivar justificativas');
      }

      const { error } = await (supabase as any)
        .from('ads_task_delay_justifications')
        .update({
          archived: archive,
          archived_at: archive ? new Date().toISOString() : null,
          archived_by: archive ? user.id : null,
        })
        .eq('id', justificationId);

      if (error) throw error;
    },
    onSuccess: (_, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ['all-delay-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-delay-justifications'] });
      toast.success(archive ? 'Justificativa arquivada!' : 'Justificativa restaurada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar justificativa', { description: error.message });
    },
  });
}

export function useShouldShowDelayNotification() {
  const { user } = useAuth();
  return user?.role && DELAY_NOTIFICATION_ROLES.includes(user.role);
}
