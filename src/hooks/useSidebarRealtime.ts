import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Subscribes to Supabase Realtime changes on profiles, organization_groups, squads,
 * and kanban_boards. Invalidates React Query cache and refreshes AuthContext when
 * the current user's profile changes, so the sidebar updates in real time without
 * page reload. Any board create/edit/delete propagates to all connected users.
 */
export function useSidebarRealtime() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('sidebar-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          queryClient.invalidateQueries({ queryKey: ['ads-manager-boards'] });
          queryClient.invalidateQueries({ queryKey: ['groups-with-occupancy'] });
          // Profile changes (group/squad/category/role) can alter which boards are visible via RLS
          queryClient.invalidateQueries({ queryKey: ['all-boards'] });

          const affectedUserId =
            (payload.new as { user_id?: string })?.user_id ??
            (payload.old as { user_id?: string })?.user_id;

          if (affectedUserId === currentUserId && payload.eventType !== 'DELETE') {
            refreshUser();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organization_groups',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['organization-groups'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'squads',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['organization-groups'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kanban_boards',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['all-boards'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, queryClient, refreshUser]);
}
