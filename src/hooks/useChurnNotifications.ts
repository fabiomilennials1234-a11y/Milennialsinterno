import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ChurnNotification {
  id: string;
  client_id: string;
  client_name: string;
  created_at: string;
  notification_date: string;
}

// Roles that should receive churn notifications
const CHURN_NOTIFICATION_ROLES = ['ceo', 'gestor_ads', 'gestor_projetos', 'sucesso_cliente', 'financeiro', 'consultor_comercial'];

// Roles that should create churn analysis tasks
const CHURN_TASK_ROLES = ['gestor_ads', 'gestor_projetos', 'sucesso_cliente'];

export function useChurnNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['churn-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get all notifications
      const { data: notifications, error: notifError } = await supabase
        .from('churn_notifications')
        .select('*')
        .order('notification_date', { ascending: false });

      if (notifError) throw notifError;

      // Get user's dismissals
      const { data: dismissals, error: dismissError } = await supabase
        .from('churn_notification_dismissals')
        .select('notification_id')
        .eq('user_id', user.id);

      if (dismissError) throw dismissError;

      const dismissedIds = new Set(dismissals?.map(d => d.notification_id) || []);

      // Return only non-dismissed notifications
      return (notifications || []).filter(n => !dismissedIds.has(n.id)) as ChurnNotification[];
    },
    enabled: !!user?.id && CHURN_NOTIFICATION_ROLES.includes(user.role || ''),
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Check every 30 seconds
  });
}

export function useDismissChurnNotification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notificationId, mathAnswer }: { notificationId: string; mathAnswer: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Check if already dismissed to prevent duplicate key error
      const { data: existingDismissal } = await supabase
        .from('churn_notification_dismissals')
        .select('id')
        .eq('notification_id', notificationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingDismissal) {
        // Already dismissed, just return success
        return;
      }

      const { error } = await supabase
        .from('churn_notification_dismissals')
        .insert({
          notification_id: notificationId,
          user_id: user.id,
          math_answer: mathAnswer,
        } as any);

      if (error) throw error;

      // Create churn analysis task for specific roles
      if (user.role && CHURN_TASK_ROLES.includes(user.role)) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1); // Due in 1 day

        // Get the notification to get client info
        const { data: notification } = await supabase
          .from('churn_notifications')
          .select('client_id, client_name')
          .eq('id', notificationId)
          .single();

        if (notification) {
          await supabase
            .from('department_tasks')
            .insert({
              user_id: user.id,
              title: `Marcar reunião de análise do churn - ${notification.client_name}`,
              description: `Agendar e realizar reunião para analisar o churn do cliente ${notification.client_name}.`,
              task_type: 'daily',
              status: 'todo',
              priority: 'high',
              due_date: dueDate.toISOString(),
              department: user.role,
              related_client_id: notification.client_id,
            } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churn-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Notificação confirmada');
    },
    onError: (error: any) => {
      toast.error('Erro ao confirmar notificação', { description: error.message });
    },
  });
}

export function useCreateChurnNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, clientName }: { clientId: string; clientName: string }) => {
      const { error } = await supabase
        .from('churn_notifications')
        .insert({
          client_id: clientId,
          client_name: clientName,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churn-notifications'] });
    },
  });
}

export function useShouldShowChurnNotification() {
  const { user } = useAuth();
  return user?.role && CHURN_NOTIFICATION_ROLES.includes(user.role);
}
