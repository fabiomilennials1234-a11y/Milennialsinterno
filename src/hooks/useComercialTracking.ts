import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

export type WeekDay = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta';

export interface ComercialTracking {
  id: string;
  comercial_user_id: string;
  client_id: string;
  manager_id: string;
  manager_name: string;
  current_day: WeekDay;
  last_moved_at: string;
  is_delayed: boolean;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    comercial_status?: string;
    client_label?: 'otimo' | 'bom' | 'medio' | 'ruim' | null;
  };
}

export interface ManagerGroup {
  manager_id: string;
  manager_name: string;
  tracking: ComercialTracking[];
}

// Fetch all tracking for the current comercial user
export function useComercialTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['comercial-tracking', user?.id],
    queryFn: async (): Promise<ComercialTracking[]> => {
      const { data, error } = await supabase
        .from('comercial_tracking')
        .select('*, client:clients(id, name, comercial_status, client_label)')
        .eq('comercial_user_id', user?.id)
        .order('manager_name', { ascending: true });

      if (error) throw error;
      return (data || []) as ComercialTracking[];
    },
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('comercial-tracking-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comercial_tracking',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['comercial-tracking'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

// Get tracking grouped by manager
export function useComercialTrackingByManager() {
  const { data: tracking = [], ...rest } = useComercialTracking();

  const groupedByManager: ManagerGroup[] = tracking.reduce((acc: ManagerGroup[], item) => {
    const existingGroup = acc.find(g => g.manager_id === item.manager_id);
    if (existingGroup) {
      existingGroup.tracking.push(item);
    } else {
      acc.push({
        manager_id: item.manager_id,
        manager_name: item.manager_name,
        tracking: [item],
      });
    }
    return acc;
  }, []);

  return { data: groupedByManager, tracking, ...rest };
}

// Get tracking for a specific day within a manager
export function getTrackingByDay(tracking: ComercialTracking[], day: WeekDay): ComercialTracking[] {
  return tracking.filter(t => t.current_day === day);
}

// Move client to a different day
export function useMoveClientToDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      trackingId, 
      newDay,
      silent = false,
    }: { 
      trackingId: string; 
      newDay: WeekDay;
      silent?: boolean;
    }) => {
      const { error } = await supabase
        .from('comercial_tracking')
        .update({ 
          current_day: newDay,
          last_moved_at: new Date().toISOString(),
          is_delayed: false,
        })
        .eq('id', trackingId);

      if (error) throw error;
      return { silent };
    },
    onSuccess: (result) => {
      if (!result?.silent) {
        toast.success('Cliente movido!');
      }
      queryClient.invalidateQueries({ queryKey: ['comercial-tracking'] });
    },
    onError: () => {
      toast.error('Erro ao mover cliente');
    },
  });
}

// Add client to tracking (when moving to acompanhamento)
export function useAddClientToTracking() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      managerId,
      managerName,
    }: { 
      clientId: string; 
      managerId: string;
      managerName: string;
    }) => {
      // Check if already exists
      const { data: existing } = await supabase
        .from('comercial_tracking')
        .select('id')
        .eq('client_id', clientId)
        .eq('comercial_user_id', user?.id)
        .maybeSingle();

      if (existing) {
        return existing;
      }

      const { data, error } = await supabase
        .from('comercial_tracking')
        .insert({
          comercial_user_id: user?.id,
          client_id: clientId,
          manager_id: managerId,
          manager_name: managerName,
          current_day: 'segunda',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial-tracking'] });
    },
    onError: () => {
      toast.error('Erro ao adicionar cliente ao acompanhamento');
    },
  });
}

// Remove client from tracking
export function useRemoveClientFromTracking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trackingId: string) => {
      const { error } = await supabase
        .from('comercial_tracking')
        .delete()
        .eq('id', trackingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cliente removido do acompanhamento');
      queryClient.invalidateQueries({ queryKey: ['comercial-tracking'] });
    },
    onError: () => {
      toast.error('Erro ao remover cliente');
    },
  });
}

// Check if any tracking is delayed (not moved today)
export function isTrackingDelayed(tracking: ComercialTracking): boolean {
  if (!tracking.last_moved_at) return true;
  
  const lastMoved = new Date(tracking.last_moved_at);
  const now = new Date();
  
  // Reset to start of day for comparison
  lastMoved.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  return lastMoved.getTime() < now.getTime();
}

// Get all unique managers from tracking
export function useUniqueManagers() {
  const { data: tracking = [] } = useComercialTracking();
  
  const managers = tracking.reduce((acc: { id: string; name: string }[], item) => {
    if (!acc.find(m => m.id === item.manager_id)) {
      acc.push({ id: item.manager_id, name: item.manager_name });
    }
    return acc;
  }, []);

  return managers;
}

// Day labels for display
export const DAY_LABELS: Record<WeekDay, string> = {
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
};

export const WEEK_DAYS: WeekDay[] = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
