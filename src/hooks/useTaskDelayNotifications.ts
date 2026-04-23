import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isPast, isToday } from 'date-fns';

export interface TaskDelayNotification {
  id: string;
  task_id: string;
  task_table: string;
  task_owner_id: string;
  task_owner_name: string;
  task_owner_role: string;
  task_title: string;
  task_due_date: string;
  created_at: string;
  // Campos extras para onboarding (preenchidos no frontend)
  is_onboarding_delay?: boolean;
  client_name?: string;
}

export interface TaskDelayJustification {
  id: string;
  notification_id: string;
  user_id: string;
  user_role: string;
  justification: string;
  created_at: string;
  archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  notification?: TaskDelayNotification;
  profile?: { name: string };
}

// Regra de quem recebe notificação:
// - gestor_ads atrasou -> gestor_ads + sucesso_cliente + gestor_projetos recebem
// - qualquer outro cargo atrasou -> dono da tarefa + gestor_projetos recebem
const ADS_DELAY_NOTIFICATION_ROLES = ['gestor_ads', 'sucesso_cliente', 'gestor_projetos', 'ceo'];
const OTHER_DELAY_NOTIFICATION_ROLES = ['gestor_projetos', 'ceo'];

// Hook para verificar e criar notificações de tarefas atrasadas
export function useCheckOverdueTasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['check-overdue-tasks', user?.id, user?.role],
    queryFn: async () => {
      if (!user?.id || !user?.role) return [];

      const createdNotifications: string[] = [];

      // 1. Verificar ads_tasks (apenas se for cargo relevante)
      if (ADS_DELAY_NOTIFICATION_ROLES.includes(user.role)) {
        const { data: adsTasks } = await supabase
          .from('ads_tasks')
          .select('*')
          .or('archived.is.null,archived.eq.false')
          .neq('status', 'done')
          .not('due_date', 'is', null);

        const overdueAdsTasks = (adsTasks || []).filter(task => {
          if (!task.due_date) return false;
          const dueDate = new Date(task.due_date);
          return isPast(dueDate) && !isToday(dueDate);
        });

        for (const task of overdueAdsTasks) {
          await createNotificationIfNotExists({
            task_id: task.id,
            task_table: 'ads_tasks',
            task_owner_id: task.ads_manager_id,
            task_title: task.title,
            task_due_date: task.due_date,
            owner_role: 'gestor_ads',
          });
          createdNotifications.push(task.id);
        }
      }

      // 2. Verificar department_tasks
      const { data: deptTasks } = await supabase
        .from('department_tasks')
        .select('*')
        .eq('archived', false)
        .neq('status', 'done')
        .not('due_date', 'is', null);

      const overdueDeptTasks = (deptTasks || []).filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return isPast(dueDate) && !isToday(dueDate);
      });

      for (const task of overdueDeptTasks) {
        // Buscar o role do dono da tarefa
        const { data: ownerRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', task.user_id)
          .maybeSingle();

        await createNotificationIfNotExists({
          task_id: task.id,
          task_table: 'department_tasks',
          task_owner_id: task.user_id,
          task_title: task.title,
          task_due_date: task.due_date,
          owner_role: ownerRole?.role || task.department,
        });
        createdNotifications.push(task.id);
      }

      // 3. Verificar onboarding_tasks
      const { data: onboardingTasks } = await supabase
        .from('onboarding_tasks')
        .select('*')
        .or('archived.is.null,archived.eq.false')
        .neq('status', 'done')
        .not('due_date', 'is', null);

      const overdueOnboardingTasks = (onboardingTasks || []).filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return isPast(dueDate) && !isToday(dueDate);
      });

      for (const task of overdueOnboardingTasks) {
        // Buscar o role do dono da tarefa
        const { data: ownerRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', task.assigned_to)
          .maybeSingle();

        await createNotificationIfNotExists({
          task_id: task.id,
          task_table: 'onboarding_tasks',
          task_owner_id: task.assigned_to,
          task_title: task.title,
          task_due_date: task.due_date,
          owner_role: ownerRole?.role || 'gestor_ads',
        });
        createdNotifications.push(task.id);
      }

      // 4. Verificar comercial_tasks
      const { data: comercialTasks } = await supabase
        .from('comercial_tasks')
        .select('id, title, due_date, user_id, status, archived')
        .or('archived.is.null,archived.eq.false')
        .neq('status', 'done')
        .not('due_date', 'is', null);

      const overdueComercialTasks = (comercialTasks || []).filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return isPast(dueDate) && !isToday(dueDate);
      });

      for (const task of overdueComercialTasks) {
        if (!task.due_date) continue;

        const { data: ownerRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', task.user_id)
          .maybeSingle();

        await createNotificationIfNotExists({
          task_id: task.id,
          task_table: 'comercial_tasks',
          task_owner_id: task.user_id,
          task_title: task.title,
          task_due_date: task.due_date,
          owner_role: ownerRole?.role || 'consultor_comercial',
        });
        createdNotifications.push(task.id);
      }

      // 5. Verificar kanban_cards com due_date
      const { data: kanbanCards } = await supabase
        .from('kanban_cards')
        .select('*')
        .eq('archived', false)
        .neq('status', 'done')
        .not('due_date', 'is', null)
        .not('assigned_to', 'is', null);

      const overdueCards = (kanbanCards || []).filter(card => {
        if (!card.due_date) return false;
        const dueDate = new Date(card.due_date);
        return isPast(dueDate) && !isToday(dueDate);
      });

      for (const card of overdueCards) {
        if (!card.assigned_to) continue;

        // Buscar o role do dono do card
        const { data: ownerRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', card.assigned_to)
          .maybeSingle();

        await createNotificationIfNotExists({
          task_id: card.id,
          task_table: 'kanban_cards',
          task_owner_id: card.assigned_to,
          task_title: card.title,
          task_due_date: card.due_date,
          owner_role: ownerRole?.role || 'unknown',
        });
        createdNotifications.push(card.id);
      }

      if (createdNotifications.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['task-delay-notifications'] });
      }

      return createdNotifications;
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

async function createNotificationIfNotExists(params: {
  task_id: string;
  task_table: string;
  task_owner_id: string;
  task_title: string;
  task_due_date: string;
  owner_role: string;
}) {
  // Verificar se já existe
  const { data: existing } = await supabase
    .from('task_delay_notifications')
    .select('id')
    .eq('task_id', params.task_id)
    .eq('task_table', params.task_table)
    .maybeSingle();

  if (existing) return;

  // Fecha race: re-valida que task ainda está overdue (não arquivada nem concluída).
  // Sem isso, uma task arquivada/concluída entre o fetch inicial e aqui gera notification órfã.
  const { data: stillValid } = await supabase
    .from(params.task_table as any)
    .select('id, archived, status')
    .eq('id', params.task_id)
    .maybeSingle();

  if (!stillValid || (stillValid as any).archived === true || (stillValid as any).status === 'done') {
    return;
  }

  // Buscar nome do dono
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('user_id', params.task_owner_id)
    .maybeSingle();

  await supabase
    .from('task_delay_notifications')
    .insert({
      task_id: params.task_id,
      task_table: params.task_table,
      task_owner_id: params.task_owner_id,
      task_owner_name: profile?.name || 'Usuário',
      task_owner_role: params.owner_role,
      task_title: params.task_title,
      task_due_date: params.task_due_date,
    });
}

// Hook para buscar notificações pendentes para o usuário atual
export function useTaskDelayNotifications() {
  const { user } = useAuth();

  // Primeiro executamos o check para criar notificações
  useCheckOverdueTasks();

  return useQuery({
    queryKey: ['task-delay-notifications', user?.id, user?.role],
    queryFn: async () => {
      if (!user?.id || !user?.role) return [];

      // Buscar todas as notificações
      const { data: notifications, error } = await supabase
        .from('task_delay_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      // Defensivo: filtra notifications órfãs (task arquivada/concluída após notification criada).
      // Agrupa por task_table, consulta estado atual, mantém só tasks ainda overdue.
      const notifsByTable = new Map<string, any[]>();
      (notifications || []).forEach((n: any) => {
        const list = notifsByTable.get(n.task_table) || [];
        list.push(n);
        notifsByTable.set(n.task_table, list);
      });

      const validTaskKeys = new Set<string>();
      for (const [table, notifs] of notifsByTable.entries()) {
        const taskIds = [...new Set(notifs.map(n => n.task_id))];
        if (taskIds.length === 0) continue;

        const { data: tasks } = await supabase
          .from(table as any)
          .select('id, archived, status')
          .in('id', taskIds);

        (tasks || []).forEach((t: any) => {
          if (t.archived !== true && t.status !== 'done') {
            validTaskKeys.add(`${table}:${t.id}`);
          }
        });
      }

      const liveNotifications = (notifications || []).filter((n: any) =>
        validTaskKeys.has(`${n.task_table}:${n.task_id}`)
      );

      // Buscar justificativas do usuário atual
      const { data: justifications } = await supabase
        .from('task_delay_justifications')
        .select('notification_id')
        .eq('user_id', user.id);

      const justifiedNotificationIds = new Set((justifications || []).map((j: any) => j.notification_id));

      // Mapear notification_id justificado → task_id, para cobrir duplicatas
      const justifiedTaskIds = new Set<string>();
      liveNotifications.forEach((n: any) => {
        if (justifiedNotificationIds.has(n.id)) {
          justifiedTaskIds.add(`${n.task_id}:${n.task_table}`);
        }
      });

      // Filtrar notificações: excluir se o usuário já justificou essa task (por qualquer notification_id)
      let pendingNotifications = liveNotifications.filter((n: any) => {
        return !justifiedNotificationIds.has(n.id) && !justifiedTaskIds.has(`${n.task_id}:${n.task_table}`);
      });

      // Aplicar regras de quem recebe notificação
      pendingNotifications = pendingNotifications.filter((n: TaskDelayNotification) => {
        const taskOwnerRole = n.task_owner_role;
        
        // Se a tarefa é de um gestor_ads
        if (taskOwnerRole === 'gestor_ads') {
          // gestor_ads, sucesso_cliente, gestor_projetos e ceo recebem
          if (ADS_DELAY_NOTIFICATION_ROLES.includes(user.role)) {
            // Se for gestor_ads, só vê suas próprias tarefas
            if (user.role === 'gestor_ads') {
              return n.task_owner_id === user.id;
            }
            return true;
          }
          return false;
        }

        // Para qualquer outro cargo
        // O dono da tarefa recebe
        if (n.task_owner_id === user.id) {
          return true;
        }
        
        // gestor_projetos e ceo também recebem
        if (OTHER_DELAY_NOTIFICATION_ROLES.includes(user.role)) {
          return true;
        }

        return false;
      });

      return pendingNotifications as TaskDelayNotification[];
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
}

// Hook para salvar justificativa
export function useSaveTaskDelayJustification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, justification }: { notificationId: string; justification: string }) => {
      if (!user?.id || !user?.role) throw new Error('User not authenticated');

      // Verificar se já existe justificativa
      const { data: existing } = await supabase
        .from('task_delay_justifications')
        .select('id')
        .eq('notification_id', notificationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Atualizar justificativa existente
        const { error } = await supabase
          .from('task_delay_justifications')
          .update({ justification })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Criar nova justificativa
        const { error } = await supabase
          .from('task_delay_justifications')
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
      queryClient.invalidateQueries({ queryKey: ['task-delay-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['task-delay-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['task-delay-justifications-by-role'] });
      queryClient.invalidateQueries({ queryKey: ['all-task-delay-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['my-task-delay-justifications'] });
      toast.success('Justificativa salva com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar justificativa', { description: error.message });
    },
  });
}

// Hook para buscar justificativas por CARGO DO DONO DA TAREFA (task_owner_role)
// Isso exibe justificativas de tarefas que pertenciam ao targetRole, independente de quem justificou
export function useTaskDelayJustificationsByRole(targetRole: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['task-delay-justifications-by-role', targetRole, user?.id],
    queryFn: async () => {
      if (!user?.id) return { active: [], archived: [] };

      // Buscar justificativas com join na notification
      const { data, error } = await supabase
        .from('task_delay_justifications')
        .select(`
          *,
          notification:task_delay_notifications(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filtrar pelo task_owner_role da notificação (dono da tarefa atrasada)
      const filteredData = (data || []).filter((j: any) => {
        return j.notification?.task_owner_role === targetRole;
      });
      
      // Buscar nomes dos usuários
      const userIds = [...new Set(filteredData.map((j: any) => j.user_id))] as string[];
      let profileMap = new Map<string, string>();
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);
        
        profileMap = new Map((profiles || []).map(p => [p.user_id, p.name]));
      }
      
      const enrichedData = filteredData.map((j: any) => ({
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

// Hook para CEO buscar TODAS as justificativas
export function useAllTaskDelayJustifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-task-delay-justifications', user?.id],
    queryFn: async () => {
      if (!user?.id || user.role !== 'ceo') return { active: [], archived: [] };

      const { data, error } = await supabase
        .from('task_delay_justifications')
        .select(`
          *,
          notification:task_delay_notifications(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
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

// Hook para arquivar/desarquivar justificativas (CEO)
export function useArchiveTaskDelayJustification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ justificationId, archive }: { justificationId: string; archive: boolean }) => {
      if (!user?.id || user.role !== 'ceo') {
        throw new Error('Apenas o CEO pode arquivar justificativas');
      }

      const { error } = await supabase
        .from('task_delay_justifications')
        .update({
          archived: archive,
          archived_at: archive ? new Date().toISOString() : null,
          archived_by: archive ? user.id : null,
        })
        .eq('id', justificationId);

      if (error) throw error;
    },
    onSuccess: (_, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ['all-task-delay-justifications'] });
      queryClient.invalidateQueries({ queryKey: ['task-delay-justifications-by-role'] });
      queryClient.invalidateQueries({ queryKey: ['my-task-delay-justifications'] });
      toast.success(archive ? 'Justificativa arquivada!' : 'Justificativa restaurada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar justificativa', { description: error.message });
    },
  });
}

// Map de cargo para nome legível
export const ROLE_LABELS: Record<string, string> = {
  'ceo': 'CEO',
  'gestor_projetos': 'Gestor de Projetos',
  'gestor_ads': 'Gestor de Ads',
  'sucesso_cliente': 'Sucesso do Cliente',
  'design': 'Design',
  'editor_video': 'Editor de Vídeo',
  'devs': 'Desenvolvedor',
  'financeiro': 'Financeiro',
  'consultor_comercial': 'Treinador Comercial',
  'gestor_crm': 'Gestor de CRM',
  'produtora': 'Produtora',
  'atrizes_gravacao': 'Atrizes/Gravação',
  'rh': 'RH',
};
