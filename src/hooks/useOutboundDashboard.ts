import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOutboundManagerBoards, type OutboundManagerBoard } from './useOutboundManagerBoards';
import { differenceInDays } from 'date-fns';

// Helper: Brazil-TZ date key
function getDateKeyBR(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export interface OutboundDashboardData {
  // KPIs
  totalActive: number;
  totalOnboarding: number;
  totalChurns: number;
  mrrOutbound: number;
  avgOnboardingDays: number;
  totalTasksDoneToday: number;
  totalMeetingsThisMonth: number;
  totalDocsToday: number;

  // Funnel: clients per milestone
  funnelData: { milestone: string; count: number; color: string }[];

  // Client status distribution
  statusData: { name: string; value: number; color: string }[];

  // Performance per manager
  managerPerformance: {
    name: string;
    activeClients: number;
    onboardingClients: number;
    tasksDone: number;
    docsToday: number;
  }[];

  // Monthly evolution (by entry_date, last 6 months)
  monthlyEvolution: { mes: string; entradas: number; churns: number; ativos: number }[];

  // Managers list
  managers: OutboundManagerBoard[];
}

export function useOutboundDashboard(selectedManagerId: string | null) {
  const { data: managers = [] } = useOutboundManagerBoards();

  return useQuery({
    queryKey: ['outbound-dashboard', selectedManagerId, managers.map(m => m.owner_user_id).join(',')],
    queryFn: async (): Promise<OutboundDashboardData> => {
      const today = getDateKeyBR();

      // Parallel fetch all data
      const [
        { data: allClients },
        { data: onboardingRows },
        { data: trackingRows },
        { data: churns },
        { data: tasks },
        { data: meetings },
        { data: docs },
      ] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, status, assigned_outbound_manager, onboarding_started_at, entry_date, monthly_value, archived, client_label, contracted_products')
          .eq('archived', false)
          .not('assigned_outbound_manager', 'is', null),
        supabase
          .from('client_onboarding')
          .select('client_id, current_milestone, current_step, completed_at, created_at'),
        supabase
          .from('client_daily_tracking')
          .select('client_id, ads_manager_id, current_day, is_delayed'),
        supabase
          .from('client_product_churns')
          .select('client_id, product_slug, monthly_value, distrato_entered_at, archived')
          .eq('archived', false)
          .ilike('product_slug', '%outbound%'),
        supabase
          .from('outbound_tasks')
          .select('id, outbound_manager_id, status, task_type, due_date, tags, archived')
          .eq('archived', false),
        supabase
          .from('outbound_meetings')
          .select('id, outbound_manager_id, meeting_date'),
        supabase
          .from('outbound_daily_documentation')
          .select('id, outbound_manager_id, documentation_date')
          .eq('documentation_date', today),
      ]);

      const clients = allClients || [];
      const onboarding = onboardingRows || [];
      const tracking = trackingRows || [];
      const churnList = churns || [];
      const taskList = tasks || [];
      const meetingList = meetings || [];
      const docList = docs || [];

      // Filter by selected manager if any
      const filteredClients = selectedManagerId
        ? clients.filter(c => c.assigned_outbound_manager === selectedManagerId)
        : clients;

      const managerIds = selectedManagerId
        ? [selectedManagerId]
        : managers.map(m => m.owner_user_id);

      const filteredTasks = selectedManagerId
        ? taskList.filter(t => t.outbound_manager_id === selectedManagerId)
        : taskList;

      const filteredMeetings = selectedManagerId
        ? meetingList.filter(m => m.outbound_manager_id === selectedManagerId)
        : meetingList;

      const filteredDocs = selectedManagerId
        ? docList.filter(d => d.outbound_manager_id === selectedManagerId)
        : docList;

      // --- KPIs ---
      const activeClients = filteredClients.filter(c => c.status === 'active');
      const onboardingClients = filteredClients.filter(c => c.status === 'onboarding' || c.status === 'new_client');
      const totalActive = activeClients.length;
      const totalOnboarding = onboardingClients.length;

      // Churns from client_product_churns (outbound product)
      const churnClientIds = new Set(churnList.map(c => c.client_id));
      const relevantChurns = selectedManagerId
        ? churnList.filter(ch => {
            const client = clients.find(c => c.id === ch.client_id);
            return client?.assigned_outbound_manager === selectedManagerId;
          })
        : churnList;
      const totalChurns = relevantChurns.length;

      // MRR
      const mrrOutbound = activeClients.reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0);

      // Avg onboarding days (only completed)
      const completedOnboardings = onboarding.filter(o => o.completed_at);
      const avgOnboardingDays = completedOnboardings.length > 0
        ? Math.round(
            completedOnboardings.reduce((sum, o) => {
              const start = o.created_at;
              const end = o.completed_at!;
              return sum + differenceInDays(new Date(end), new Date(start));
            }, 0) / completedOnboardings.length
          )
        : 0;

      // Tasks done today
      const totalTasksDoneToday = filteredTasks.filter(t => t.status === 'done' && t.due_date === today).length;

      // Meetings this month
      const currentMonth = today.slice(0, 7); // YYYY-MM
      const totalMeetingsThisMonth = filteredMeetings.filter(m =>
        m.meeting_date && m.meeting_date.startsWith(currentMonth)
      ).length;

      // Docs today
      const totalDocsToday = filteredDocs.length;

      // --- Funnel Data ---
      const milestoneLabels = ['Marco 1', 'Marco 2', 'Marco 3', 'Marco 4', 'Marco 5'];
      const milestoneColors = [
        'hsl(217 91% 60%)',  // info/blue
        'hsl(258 90% 66%)',  // purple
        'hsl(160 84% 39%)',  // success/green
        'hsl(38 92% 50%)',   // warning/orange
        'hsl(217 91% 50%)',  // primary/blue
      ];

      const onboardingClientIds = new Set(onboardingClients.map(c => c.id));
      const funnelData = milestoneLabels.map((label, i) => {
        const milestoneNum = i + 1;
        const count = onboarding.filter(o =>
          onboardingClientIds.has(o.client_id) &&
          (o.current_milestone === milestoneNum) &&
          !o.completed_at
        ).length;
        return { milestone: label, count, color: milestoneColors[i] };
      });

      // --- Status Distribution ---
      const statusMap: Record<string, { name: string; color: string }> = {
        new_client: { name: 'Novo Cliente', color: 'hsl(217 91% 60%)' },
        onboarding: { name: 'Onboarding', color: 'hsl(258 90% 66%)' },
        active: { name: 'Ativo', color: 'hsl(160 84% 39%)' },
        churned: { name: 'Churn', color: 'hsl(0 84% 60%)' },
      };

      const statusCounts: Record<string, number> = {};
      filteredClients.forEach(c => {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      });

      // Add churns from client_product_churns that might still be "active" in clients table
      if (!statusCounts['churned']) statusCounts['churned'] = 0;
      const churnedFromProducts = relevantChurns.filter(ch => {
        const client = filteredClients.find(c => c.id === ch.client_id);
        return client && client.status !== 'churned';
      }).length;
      statusCounts['churned'] += churnedFromProducts;

      const statusData = Object.entries(statusMap)
        .map(([key, { name, color }]) => ({
          name,
          value: statusCounts[key] || 0,
          color,
        }))
        .filter(s => s.value > 0);

      // --- Manager Performance ---
      const managerPerformance = managers.map(manager => {
        const mClients = clients.filter(c => c.assigned_outbound_manager === manager.owner_user_id);
        const mActive = mClients.filter(c => c.status === 'active').length;
        const mOnboarding = mClients.filter(c => c.status === 'onboarding' || c.status === 'new_client').length;
        const mTasksDone = taskList.filter(t =>
          t.outbound_manager_id === manager.owner_user_id && t.status === 'done' && t.due_date === today
        ).length;
        const mDocsToday = docList.filter(d => d.outbound_manager_id === manager.owner_user_id).length;

        return {
          name: manager.owner_name.split(' ')[0], // First name only
          activeClients: mActive,
          onboardingClients: mOnboarding,
          tasksDone: mTasksDone,
          docsToday: mDocsToday,
        };
      });

      // --- Monthly Evolution (last 6 months by entry_date) ---
      const months: string[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(
          new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(d)
        );
      }

      const monthKeys: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      const monthlyEvolution = months.map((mes, idx) => {
        const key = monthKeys[idx];
        const entradas = filteredClients.filter(c => c.entry_date?.startsWith(key)).length;
        const churnsInMonth = relevantChurns.filter(ch =>
          ch.distrato_entered_at?.startsWith(key)
        ).length;
        // Active at end of month: clients with entry_date <= end of month and status active
        const ativos = filteredClients.filter(c => {
          if (c.status !== 'active') return false;
          if (!c.entry_date) return false;
          return c.entry_date <= `${key}-31`;
        }).length;

        return { mes, entradas, churns: churnsInMonth, ativos };
      });

      return {
        totalActive,
        totalOnboarding,
        totalChurns,
        mrrOutbound,
        avgOnboardingDays,
        totalTasksDoneToday,
        totalMeetingsThisMonth,
        totalDocsToday,
        funnelData,
        statusData,
        managerPerformance,
        monthlyEvolution,
        managers,
      };
    },
    enabled: managers.length > 0 || !selectedManagerId,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
