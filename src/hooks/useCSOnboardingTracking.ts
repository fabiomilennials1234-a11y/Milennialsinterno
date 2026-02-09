import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Types for onboarding and tracking data
export interface CSOnboardingTask {
  id: string;
  client_id: string;
  assigned_to: string;
  task_type: string;
  title: string;
  description: string | null;
  status: 'pending' | 'doing' | 'done';
  due_date: string | null;
  completed_at: string | null;
  milestone: number;
  created_at: string;
  updated_at: string;
  archived?: boolean | null;
}

export interface CSClientTracking {
  id: string;
  client_id: string;
  ads_manager_id: string;
  current_day: 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta';
  last_moved_at: string;
  is_delayed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CSComercialTracking {
  id: string;
  comercial_user_id: string;
  client_id: string;
  manager_id: string;
  manager_name: string;
  current_day: 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta';
  last_moved_at: string;
  is_delayed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CSClientWithTracking {
  id: string;
  name: string;
  comercial_status: string | null;
  onboarding_started_at: string | null;
  campaign_published_at: string | null;
  assigned_ads_manager: string | null;
  assigned_comercial: string | null;
  comercial_entered_at: string | null;
  comercial_onboarding_started_at: string | null;
  // Onboarding data
  onboardingTasks?: CSOnboardingTask[];
  currentOnboardingStep?: string;
  onboardingProgress?: number;
  // Ads tracking data
  adsTracking?: CSClientTracking | null;
  // Comercial tracking data
  comercialTracking?: CSComercialTracking | null;
}

// Fetch all onboarding tasks for clients of a specific manager
export function useCSOnboardingTasks(managerId?: string) {
  return useQuery({
    queryKey: ['cs-onboarding-tasks', managerId],
    queryFn: async (): Promise<CSOnboardingTask[]> => {
      if (!managerId) return [];
      
      const { data, error } = await supabase
        .from('onboarding_tasks')
        .select('*')
        .eq('assigned_to', managerId)
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CSOnboardingTask[];
    },
    enabled: !!managerId,
  });
}

// Fetch daily tracking for clients of a specific ads manager
export function useCSClientTracking(managerId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cs-client-tracking', managerId],
    queryFn: async (): Promise<CSClientTracking[]> => {
      if (!managerId) return [];
      
      const { data, error } = await supabase
        .from('client_daily_tracking')
        .select('*')
        .eq('ads_manager_id', managerId);

      if (error) throw error;
      return (data || []) as CSClientTracking[];
    },
    enabled: !!managerId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!managerId) return;

    const channel = supabase
      .channel(`cs-client-tracking-${managerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_daily_tracking',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cs-client-tracking', managerId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [managerId, queryClient]);

  return query;
}

// Fetch all comercial consultants
export function useComercialConsultants() {
  return useQuery({
    queryKey: ['comercial-consultants'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'consultor_comercial');

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds)
        .order('name');

      if (profilesError) throw profilesError;
      
      return (profiles || []).map(p => ({
        user_id: p.user_id,
        name: p.name,
      }));
    },
  });
}

// Fetch clients by comercial with status info
export function useCSComercialClients() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cs-comercial-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('archived', false)
        .not('assigned_comercial', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('cs-comercial-clients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cs-comercial-clients'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// Fetch comercial tracking for all comercial users
export function useCSComercialTracking() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cs-comercial-tracking'],
    queryFn: async (): Promise<CSComercialTracking[]> => {
      const { data, error } = await supabase
        .from('comercial_tracking')
        .select('*')
        .order('manager_name', { ascending: true });

      if (error) throw error;
      return (data || []) as CSComercialTracking[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('cs-comercial-tracking-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comercial_tracking',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['cs-comercial-tracking'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// Fetch comercial tasks for all clients to show pending task type
export function useCSComercialTasks() {
  return useQuery({
    queryKey: ['cs-comercial-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comercial_tasks')
        .select('id, related_client_id, auto_task_type, status, title')
        .eq('is_auto_generated', true)
        .or('archived.is.null,archived.eq.false')
        .neq('status', 'done')
        .in('auto_task_type', ['marcar_consultoria', 'realizar_consultoria'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Group by client_id to get the pending task for each client
      const tasksByClient = new Map<string, { taskType: string; title: string }>();
      (data || []).forEach(task => {
        if (task.related_client_id && !tasksByClient.has(task.related_client_id)) {
          tasksByClient.set(task.related_client_id, {
            taskType: task.auto_task_type || '',
            title: task.title,
          });
        }
      });
      
      return tasksByClient;
    },
  });
}

// Onboarding step labels
export const ONBOARDING_STEP_LABELS: Record<string, string> = {
  'marcar_call_1': 'Marcar Call 1',
  'realizar_call_1': 'Realizar Call 1',
  'criar_estrategia': 'Criar Estratégia',
  'apresentar_estrategia': 'Apresentar Estratégia',
  'brifar_criativos': 'Brifar Criativos',
  'aguardar_criativos': 'Aguardar Criativos',
  'publicar_campanha': 'Publicar Campanha',
};

// Comercial status labels
export const COMERCIAL_STATUS_LABELS: Record<string, string> = {
  'novo': 'Novo Cliente',
  'consultoria_marcada': 'Consultoria Marcada',
  'consultoria_realizada': 'Consultoria Realizada',
  'em_acompanhamento': 'Em Acompanhamento',
  'churn': 'Churn',
};

// Day labels
export const DAY_LABELS: Record<string, string> = {
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
};

// Calculate onboarding progress percentage
export function calculateOnboardingProgress(tasks: CSOnboardingTask[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter(t => t.status === 'done').length;
  return Math.round((completed / tasks.length) * 100);
}

// Get current onboarding step
export function getCurrentOnboardingStep(tasks: CSOnboardingTask[]): string | null {
  const pendingTask = tasks.find(t => t.status === 'pending' || t.status === 'doing');
  return pendingTask?.task_type || null;
}

// Check if tracking is delayed (not moved today)
export function isTrackingDelayed(lastMovedAt: string | null): boolean {
  if (!lastMovedAt) return true;
  
  const lastMoved = new Date(lastMovedAt);
  const now = new Date();
  
  // Reset to start of day for comparison
  lastMoved.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  return lastMoved.getTime() < now.getTime();
}
