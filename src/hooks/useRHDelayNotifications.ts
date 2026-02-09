import { useEffect, useState, useCallback } from 'react';
import { RHVaga, RHVagaBriefing, useRHVagas, useRHVagaBriefings, useRHJustificativas, isVagaOverdue } from '@/hooks/useRH';
import { useAuth } from '@/contexts/AuthContext';

interface OverdueVagaNotification {
  vaga: RHVaga;
  briefing: RHVagaBriefing;
}

export function useRHDelayNotifications() {
  const { user } = useAuth();
  const { data: vagas = [] } = useRHVagas();
  const { data: briefings = [] } = useRHVagaBriefings();
  const { data: justificativas = [] } = useRHJustificativas();
  
  const [pendingNotifications, setPendingNotifications] = useState<OverdueVagaNotification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<OverdueVagaNotification | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Check if user can see delay notifications (CEO, Gestor Projetos, or RH roles)
  const canSeeNotifications = user?.role === 'ceo' || 
                              user?.role === 'gestor_projetos' || 
                              user?.role === 'rh';

  // Find overdue vagas that haven't been justified yet
  useEffect(() => {
    if (!canSeeNotifications) {
      setPendingNotifications([]);
      return;
    }

    const briefingsMap = new Map<string, RHVagaBriefing>();
    briefings.forEach(b => briefingsMap.set(b.vaga_id, b));

    // Get vagas that are overdue and NOT in justificativa status yet
    const overdueVagas = vagas.filter(vaga => {
      const briefing = briefingsMap.get(vaga.id);
      if (!briefing) return false;
      
      // Skip if already in justificativa or archived status
      if (vaga.status === 'justificativa' || vaga.status === 'arquivados') return false;
      
      // Skip if already dismissed in this session
      if (dismissedIds.has(vaga.id)) return false;
      
      // Check if overdue
      if (!isVagaOverdue(vaga, briefing)) return false;
      
      // Check if there's a recent justification (within last 24 hours)
      const recentJustification = justificativas.find(j => {
        if (j.vaga_id !== vaga.id) return false;
        const justDate = new Date(j.created_at);
        const now = new Date();
        const diffHours = (now.getTime() - justDate.getTime()) / (1000 * 60 * 60);
        return diffHours < 24; // Justified in last 24 hours
      });
      
      if (recentJustification) return false;
      
      return true;
    });

    const notifications = overdueVagas
      .map(vaga => ({
        vaga,
        briefing: briefingsMap.get(vaga.id)!
      }))
      .filter(n => n.briefing);

    setPendingNotifications(notifications);
    
    // Show first notification if none is showing
    if (notifications.length > 0 && !currentNotification) {
      setCurrentNotification(notifications[0]);
    }
  }, [vagas, briefings, justificativas, dismissedIds, canSeeNotifications, currentNotification]);

  const dismissCurrent = useCallback(() => {
    if (currentNotification) {
      setDismissedIds(prev => new Set([...prev, currentNotification.vaga.id]));
      setCurrentNotification(null);
      
      // Show next notification if available
      setTimeout(() => {
        const remaining = pendingNotifications.filter(
          n => n.vaga.id !== currentNotification.vaga.id && !dismissedIds.has(n.vaga.id)
        );
        if (remaining.length > 0) {
          setCurrentNotification(remaining[0]);
        }
      }, 500);
    }
  }, [currentNotification, pendingNotifications, dismissedIds]);

  const markAsJustified = useCallback((vagaId: string) => {
    setDismissedIds(prev => new Set([...prev, vagaId]));
    if (currentNotification?.vaga.id === vagaId) {
      setCurrentNotification(null);
      
      // Show next notification if available
      setTimeout(() => {
        const remaining = pendingNotifications.filter(
          n => n.vaga.id !== vagaId && !dismissedIds.has(n.vaga.id)
        );
        if (remaining.length > 0) {
          setCurrentNotification(remaining[0]);
        }
      }, 500);
    }
  }, [currentNotification, pendingNotifications, dismissedIds]);

  return {
    currentNotification,
    pendingCount: pendingNotifications.length,
    dismissCurrent,
    markAsJustified,
    canSeeNotifications,
  };
}
