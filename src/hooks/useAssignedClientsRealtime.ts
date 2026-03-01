import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTargetAdsManager } from '@/contexts/AdsManagerContext';

/**
 * Subscription Realtime na tabela clients para gestores de ads.
 * Quando um novo cliente é inserido/atualizado com assigned_ads_manager = gestor,
 * invalida as queries para que a lista e tarefas atualizem imediatamente.
 *
 * Usa duas camadas:
 * 1. Subscription filtrada por assigned_ads_manager (para updates específicos)
 * 2. Subscription global em INSERT (para capturar novos clientes imediatamente,
 *    mesmo antes do filtro de realtime propagar o assigned_ads_manager)
 */
export function useAssignedClientsRealtime() {
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const queryClient = useQueryClient();
  const effectiveUserId = targetUserId || user?.id;

  useEffect(() => {
    if (!effectiveUserId) return;

    const handleClientsChange = () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['ads-tasks'] });
    };

    // Channel 1: Filtered subscription for this specific manager
    const filteredChannel = supabase
      .channel(`assigned-clients-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clients',
          filter: `assigned_ads_manager=eq.${effectiveUserId}`,
        },
        handleClientsChange
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clients',
          filter: `assigned_ads_manager=eq.${effectiveUserId}`,
        },
        handleClientsChange
      )
      .subscribe();

    // Channel 2: Global INSERT subscription as fallback
    // Supabase realtime filters on INSERT may not always match if the
    // assigned_ads_manager column is set in the same INSERT statement.
    // This broader listener ensures we always catch new clients.
    const globalChannel = supabase
      .channel(`clients-global-insert-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clients',
        },
        handleClientsChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(filteredChannel);
      supabase.removeChannel(globalChannel);
    };
  }, [effectiveUserId, queryClient]);
}
