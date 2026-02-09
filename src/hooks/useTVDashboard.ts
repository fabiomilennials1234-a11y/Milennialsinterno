import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProfessionalStats {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  pendingTasks: number;
  completedToday: number;
  delayedTasks: number;
  // Client counts for gestor_ads
  clientCounts?: {
    otimo: number;
    bom: number;
    medio: number;
    ruim: number;
    onboarding: number;
    total: number;
  };
}

// Include all relevant roles for the TV Dashboard
const PROFESSIONAL_ROLES = [
  'designer', 
  'editor_video', 
  'consultor_comercial', 
  'desenvolvedor',
  'gestor_ads',
  'gestor_projetos',
  'sucesso_cliente',
  'financeiro',
  'rh',
  'produtora',
  'atriz',
];

export function useTVDashboardStats() {
  return useQuery({
    queryKey: ['tv-dashboard-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayStart = `${today}T00:00:00`;
      
      // Fetch ALL profiles
      const profilesResult = await supabase
        .from('profiles')
        .select('user_id, name, avatar, avatar_url')
        .limit(500);
      const profiles = (profilesResult.data || []) as { 
        user_id: string; 
        name: string | null; 
        avatar: string | null;
        avatar_url: string | null;
      }[];
      
      // Fetch ALL user roles
      const rolesResult = await supabase
        .from('user_roles')
        .select('user_id, role')
        .limit(500);
      const roles = (rolesResult.data || []) as { user_id: string; role: string }[];
      
      // Map roles to profiles - include ALL professionals
      const professionalsWithRoles = profiles
        .map(p => {
          const userRole = roles.find(r => r.user_id === p.user_id);
          return {
            ...p,
            role: userRole?.role || null
          };
        })
        .filter(p => p.role && PROFESSIONAL_ROLES.includes(p.role));
      
      // Fetch kanban cards stats
      const kanbanResult = await supabase
        .from('kanban_cards')
        .select('id, assigned_to, column_id, due_date, archived, created_at, updated_at')
        .eq('archived', false)
        .limit(5000);
      const kanbanCards = kanbanResult.data || [];
      
      // Fetch columns to check which ones are "done" columns
      const columnsResult = await supabase
        .from('kanban_columns')
        .select('id, title')
        .limit(1000);
      const columns = columnsResult.data || [];
      const doneColumnIds = new Set(
        columns
          .filter((c: any) => 
            c.title?.toLowerCase().includes('conclu') || 
            c.title?.toLowerCase().includes('done') ||
            c.title?.toLowerCase().includes('entregue') ||
            c.title?.toLowerCase().includes('finalizado')
          )
          .map((c: any) => c.id)
      );
      
      // Fetch comercial tasks
      const comercialResult = await supabase
        .from('comercial_tasks')
        .select('id, user_id, status, due_date, created_at, updated_at')
        .eq('archived', false)
        .limit(2000);
      const comercialTasks = comercialResult.data || [];
      
      // Fetch ads tasks (for gestor_ads)
      const adsTasksResult = await supabase
        .from('ads_tasks')
        .select('id, ads_manager_id, status, due_date, created_at, updated_at')
        .eq('archived', false)
        .limit(2000);
      const adsTasks = adsTasksResult.data || [];
      
      // Fetch clients with labels and status for gestor_ads metrics
      const clientsResult = await supabase
        .from('clients')
        .select('id, assigned_ads_manager, client_label, status, archived')
        .eq('archived', false)
        .limit(2000);
      const clients = clientsResult.data || [];
      
      // Fetch client onboarding data
      const onboardingResult = await supabase
        .from('client_onboarding')
        .select('client_id, current_milestone, completed_at')
        .limit(2000);
      const onboardingData = onboardingResult.data || [];
      
      const stats: ProfessionalStats[] = professionalsWithRoles.map(p => {
        let pendingTasks = 0;
        let completedToday = 0;
        let delayedTasks = 0;
        let clientCounts: ProfessionalStats['clientCounts'] = undefined;
        
        if (p.role === 'designer' || p.role === 'editor_video' || p.role === 'desenvolvedor' || 
            p.role === 'produtora' || p.role === 'atriz') {
          // Kanban-based roles
          const userCards = kanbanCards.filter((c: any) => c.assigned_to === p.user_id);
          
          pendingTasks = userCards.filter((c: any) => !doneColumnIds.has(c.column_id)).length;
          completedToday = userCards.filter((c: any) => 
            doneColumnIds.has(c.column_id) && 
            c.updated_at >= todayStart
          ).length;
          delayedTasks = userCards.filter((c: any) => 
            c.due_date && 
            new Date(c.due_date) < new Date() && 
            !doneColumnIds.has(c.column_id)
          ).length;
        } else if (p.role === 'consultor_comercial') {
          const userTasks = comercialTasks.filter((c: any) => c.user_id === p.user_id);
          
          pendingTasks = userTasks.filter((c: any) => c.status !== 'done').length;
          completedToday = userTasks.filter((c: any) => 
            c.status === 'done' && 
            c.updated_at >= todayStart
          ).length;
          delayedTasks = userTasks.filter((c: any) => 
            c.due_date && 
            new Date(c.due_date) < new Date() && 
            c.status !== 'done'
          ).length;
        } else if (p.role === 'gestor_ads') {
          // Tasks from ads_tasks
          const userTasks = adsTasks.filter((c: any) => c.ads_manager_id === p.user_id);
          
          pendingTasks = userTasks.filter((c: any) => c.status !== 'done').length;
          completedToday = userTasks.filter((c: any) => 
            c.status === 'done' && 
            c.updated_at >= todayStart
          ).length;
          delayedTasks = userTasks.filter((c: any) => 
            c.due_date && 
            new Date(c.due_date) < new Date() && 
            c.status !== 'done'
          ).length;
          
          // Client counts by label for this gestor
          const managerClients = clients.filter((c: any) => c.assigned_ads_manager === p.user_id);
          
          // Check which clients are in onboarding (not completed)
          const onboardingClientIds = new Set(
            onboardingData
              .filter((o: any) => !o.completed_at)
              .map((o: any) => o.client_id)
          );
          
          clientCounts = {
            otimo: managerClients.filter((c: any) => c.client_label === 'otimo').length,
            bom: managerClients.filter((c: any) => c.client_label === 'bom').length,
            medio: managerClients.filter((c: any) => c.client_label === 'medio').length,
            ruim: managerClients.filter((c: any) => c.client_label === 'ruim').length,
            onboarding: managerClients.filter((c: any) => onboardingClientIds.has(c.id)).length,
            total: managerClients.length,
          };
        } else {
          // For other roles (gestor_projetos, sucesso_cliente, financeiro, rh)
          const userCards = kanbanCards.filter((c: any) => c.assigned_to === p.user_id);
          
          pendingTasks = userCards.filter((c: any) => !doneColumnIds.has(c.column_id)).length;
          completedToday = userCards.filter((c: any) => 
            doneColumnIds.has(c.column_id) && 
            c.updated_at >= todayStart
          ).length;
          delayedTasks = userCards.filter((c: any) => 
            c.due_date && 
            new Date(c.due_date) < new Date() && 
            !doneColumnIds.has(c.column_id)
          ).length;
        }
        
        return {
          id: p.user_id,
          name: p.name || 'Sem nome',
          avatar: p.avatar_url || p.avatar,
          role: p.role!,
          pendingTasks,
          completedToday,
          delayedTasks,
          clientCounts,
        };
      });
      
      return {
        designers: stats.filter(s => s.role === 'designer'),
        editors: stats.filter(s => s.role === 'editor_video'),
        comercial: stats.filter(s => s.role === 'consultor_comercial'),
        devs: stats.filter(s => s.role === 'desenvolvedor'),
        gestoresAds: stats.filter(s => s.role === 'gestor_ads'),
        all: stats,
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
