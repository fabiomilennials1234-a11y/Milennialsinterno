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
      // Usar string ISO 'YYYY-MM-DD' para evitar problemas de timezone
      const todayStr = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD' no fuso local

      const overdueTasks = (tasks || []).filter(task => {
        if (!task.due_date) return false;
        // due_date vem como 'YYYY-MM-DD' do banco — comparar direto como string
        const dueDateStr = typeof task.due_date === 'string'
          ? task.due_date.split('T')[0]
          : new Date(task.due_date).toLocaleDateString('en-CA');
        // Tarefa está atrasada se a data de vencimento é estritamente anterior a hoje
        return dueDateStr < todayStr;
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
    refetchInterval: 300_000,
    staleTime: 60_000,
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

      const justifiedNotificationIds = new Set((justifications || []).map((j: any) => j.notification_id));

      // Mapear task_ids já justificados para cobrir notificações duplicatas
      const justifiedTaskIds = new Set<string>();
      (notifications || []).forEach((n: any) => {
        if (justifiedNotificationIds.has(n.id)) {
          justifiedTaskIds.add(n.ads_task_id);
        }
      });

      // Filtrar: excluir se já justificou essa task (por qualquer notification_id)
      let pendingNotifications = (notifications || []).filter((n: any) => {
        return !justifiedNotificationIds.has(n.id) && !justifiedTaskIds.has(n.ads_task_id);
      });

      // Para gestor_ads, filtrar apenas suas próprias tarefas
      if (user.role === 'gestor_ads') {
        pendingNotifications = pendingNotifications.filter((n: any) => n.ads_manager_id === user.id);
      }

      return pendingNotifications as AdsTaskDelayNotification[];
    },
    enabled: !!user?.id && DELAY_NOTIFICATION_ROLES.includes(user.role || ''),
    refetchOnWindowFocus: true,
    refetchInterval: 300_000,
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

      // Também salvar na tabela geral (task_delay_justifications) para aparecer na coluna Justificativa
      // Buscar a notificação ads para obter o task_id
      const { data: adsNotif } = await (supabase as any)
        .from('ads_task_delay_notifications')
        .select('ads_task_id, ads_manager_id, ads_manager_name, task_title, task_due_date')
        .eq('id', notificationId)
        .maybeSingle();

      if (adsNotif) {
        // Verificar se existe notificação correspondente na tabela geral
        const { data: generalNotif } = await supabase
          .from('task_delay_notifications')
          .select('id')
          .eq('task_id', adsNotif.ads_task_id)
          .eq('task_table', 'ads_tasks')
          .maybeSingle();

        let generalNotifId = generalNotif?.id;

        // Se não existe, criar a notificação na tabela geral
        if (!generalNotifId) {
          const { data: newNotif } = await supabase
            .from('task_delay_notifications')
            .insert({
              task_id: adsNotif.ads_task_id,
              task_table: 'ads_tasks',
              task_owner_id: adsNotif.ads_manager_id,
              task_owner_name: adsNotif.ads_manager_name,
              task_owner_role: 'gestor_ads',
              task_title: adsNotif.task_title,
              task_due_date: adsNotif.task_due_date,
            })
            .select('id')
            .maybeSingle();

          generalNotifId = newNotif?.id;
        }

        // Criar justificativa na tabela geral se temos o notification_id
        if (generalNotifId) {
          const { data: existingGeneral } = await supabase
            .from('task_delay_justifications')
            .select('id')
            .eq('notification_id', generalNotifId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (existingGeneral) {
            await supabase
              .from('task_delay_justifications')
              .update({ justification })
              .eq('id', existingGeneral.id);
          } else {
            await supabase
              .from('task_delay_justifications')
              .insert({
                notification_id: generalNotifId,
                user_id: user.id,
                user_role: user.role,
                justification,
              });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-task-delay-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['task-delay-justifications-by-role'] });
      queryClient.invalidateQueries({ queryKey: ['all-task-delay-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['task-delay-notifications'] });
      // RPC canônica (substitui my-delay-justifications)
      queryClient.invalidateQueries({ queryKey: ['justif-pending-mine'] });
      queryClient.invalidateQueries({ queryKey: ['justif-done-mine'] });
      queryClient.invalidateQueries({ queryKey: ['justif-team'] });
      toast.success('Justificativa salva com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar justificativa', { description: error.message });
    },
  });
}

// useMyDelayJustifications removido — substituído por useJustificativasPendentes
// + useJustificativasDoneMine em src/hooks/useJustificativas.ts (cobre todos
// os departamentos, não só Ads). Único consumidor era MyDelayJustificationsSection.

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
    enabled: !!user?.id && (user.role === 'ceo' || user.role === 'cto'),
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
      queryClient.invalidateQueries({ queryKey: ['justif-pending-mine'] });
      queryClient.invalidateQueries({ queryKey: ['justif-done-mine'] });
      queryClient.invalidateQueries({ queryKey: ['justif-team'] });
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
