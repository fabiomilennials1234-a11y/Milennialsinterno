import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook que escuta notificações de treinamento em tempo real
 * e exibe toasts na tela automaticamente (push visual).
 */
export function useTrainingReminderToasts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const shownNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('training-reminder-toasts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as any;

          // Apenas notificações de treinamento
          if (
            notification.notification_type !== 'training_reminder' &&
            notification.notification_type !== 'new_training'
          ) {
            return;
          }

          // Evitar duplicata no mesmo render
          if (shownNotifications.current.has(notification.id)) return;
          shownNotifications.current.add(notification.id);

          // Invalidar cache para atualizar o sino também
          queryClient.invalidateQueries({ queryKey: ['system-notifications'] });

          const isUrgent = notification.priority === 'high';
          const minutesBefore = notification.metadata?.minutes_before;

          // Toast com duração maior para avisos urgentes
          const duration = isUrgent ? 30000 : 15000;

          toast(notification.title || '🎓 Treinamento', {
            description: notification.message,
            duration,
            important: true,
            action: {
              label: 'Ver Treinamento',
              onClick: () => {
                window.location.href = '/treinamentos';
              },
            },
            style: isUrgent
              ? { border: '2px solid #F97316', background: '#FFF7ED' }
              : undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
