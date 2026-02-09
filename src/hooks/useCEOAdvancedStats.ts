import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface OnboardingStats {
  avgDaysToComplete: number;
  totalCompleted: number;
  activeOnboardings: number;
  byManager: {
    managerId: string;
    managerName: string;
    avgDays: number;
    completed: number;
  }[];
  activeByMilestone: {
    milestone: number;
    count: number;
    clients: { id: string; name: string; daysInMilestone: number }[];
  }[];
}

export interface ProductionStats {
  design: {
    avgDays: number;
    totalCompleted: number;
    pending: number;
  };
  video: {
    avgDays: number;
    totalCompleted: number;
    pending: number;
  };
  produtora: {
    avgDays: number;
    totalCompleted: number;
    pending: number;
  };
  atrizes: {
    avgDays: number;
    totalCompleted: number;
    pending: number;
  };
}

export interface ChurnStats {
  totalChurned: number;
  churnedThisMonth: number;
  churnedLastMonth: number;
  distratoInProgress: number;
  byManager: {
    managerId: string;
    managerName: string;
    churnCount: number;
  }[];
  topChurnManager: {
    managerId: string;
    managerName: string;
    churnCount: number;
  } | null;
  distratoClients: {
    id: string;
    name: string;
    step: string;
    enteredAt: string;
    managerName: string;
  }[];
}

export interface ClientLabelStats {
  total: number;
  otimo: number;
  bom: number;
  medio: number;
  ruim: number;
  semLabel: number;
  byManager: {
    managerId: string;
    managerName: string;
    otimo: number;
    bom: number;
    medio: number;
    ruim: number;
    semLabel: number;
    total: number;
  }[];
  topRuimManager: {
    managerId: string;
    managerName: string;
    ruimCount: number;
  } | null;
}

export interface GroupSquadStats {
  groupId: string;
  groupName: string;
  squads: {
    squadId: string;
    squadName: string;
    clientCount: number;
    labels: {
      otimo: number;
      bom: number;
      medio: number;
      ruim: number;
      semLabel: number;
    };
    totalMonthlyValue: number;
  }[];
  totalClients: number;
  totalMonthlyValue: number;
}

export interface FinancialStats {
  totalReceivable: number;
  totalReceived: number;
  totalPayable: number;
  totalPaid: number;
  pendingPayable: number;
  overdueReceivable: number;
  result: number;
  marginPercent: number;
  byProduct: {
    productId: string;
    productName: string;
    productSlug: string;
    color: string;
    clientCount: number;
    revenue: number;
    margin?: number;
  }[];
  monthlyTrend: {
    month: string;
    receivable: number;
    payable: number;
    result: number;
  }[];
}

export interface TaskStats {
  totalOverdue: number;
  overdueByArea: {
    area: string;
    areaSlug: string;
    count: number;
    oldestDays: number;
  }[];
  tasksByStatus: {
    pending: number;
    inProgress: number;
    done: number;
  };
  adsTasks: {
    total: number;
    overdue: number;
    pending: number;
  };
  comercialTasks: {
    total: number;
    overdue: number;
    pending: number;
  };
  rhTasks: {
    total: number;
    overdue: number;
    pending: number;
  };
}

export interface CSStats {
  totalActionPlans: number;
  activeActionPlans: number;
  completedActionPlans: number;
  expiredActionPlans: number;
  avgNPS: number;
  npsResponses: number;
  clientsNeedingContact: number;
  byClassification: {
    monitoramento: number;
    sucesso: number;
    risco: number;
    critico: number;
  };
}

export interface BottleneckStats {
  area: string;
  count: number;
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface CEOAdvancedStats {
  onboarding: OnboardingStats;
  production: ProductionStats;
  churn: ChurnStats;
  clientLabels: ClientLabelStats;
  groupSquadStats: GroupSquadStats[];
  financial: FinancialStats;
  tasks: TaskStats;
  cs: CSStats;
  bottlenecks: BottleneckStats[];
  summary: {
    totalActiveClients: number;
    totalTeamMembers: number;
    totalGroups: number;
    totalSquads: number;
    healthScore: number;
    operationalScore: number;
    newClientsThisMonth: number;
    avgClientLifetime: number;
  };
}

export function useCEOAdvancedStats() {
  return useQuery({
    queryKey: ['ceo-advanced-stats'],
    queryFn: async (): Promise<CEOAdvancedStats> => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Fetch all data in parallel
      const [
        { data: clients },
        { data: profiles },
        { data: groups },
        { data: squads },
        { data: onboardingData },
        { data: kanbanCards },
        { data: kanbanColumns },
        { data: kanbanBoards },
        { data: contasPagar },
        { data: contasReceber },
        { data: activeClients },
        { data: produtos },
        { data: productValues },
        { data: adsTasks },
        { data: comercialTasks },
        { data: rhTasks },
        { data: actionPlans },
        { data: npsSurveys },
        { data: npsResponses },
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('organization_groups').select('*'),
        supabase.from('squads').select('*'),
        supabase.from('client_onboarding').select('*, clients(name, assigned_ads_manager, onboarding_started_at)'),
        supabase.from('kanban_cards').select('*').eq('archived', false),
        supabase.from('kanban_columns').select('*, kanban_boards!inner(slug, name)'),
        supabase.from('kanban_boards').select('*'),
        supabase.from('financeiro_contas_pagar').select('*').eq('mes_referencia', currentMonth),
        supabase.from('financeiro_contas_receber').select('*').eq('mes_referencia', currentMonth),
        supabase.from('financeiro_active_clients').select('*'),
        supabase.from('financeiro_produtos').select('*').eq('ativo', true),
        supabase.from('client_product_values').select('*'),
        supabase.from('ads_tasks').select('*').eq('archived', false),
        supabase.from('comercial_tasks').select('*').eq('archived', false),
        supabase.from('rh_tarefas').select('*'),
        supabase.from('cs_action_plans').select('*'),
        supabase.from('nps_surveys').select('*'),
        supabase.from('nps_responses').select('*'),
      ]);

      // Filter active clients (not archived, not churned)
      const activeClientsList = clients?.filter(c => 
        !c.archived && c.status !== 'churned' && !c.distrato_step
      ) || [];

      const churnedClientsList = clients?.filter(c => 
        c.archived || c.status === 'churned'
      ) || [];

      const distratoClientsList = clients?.filter(c => 
        c.distrato_step && !c.archived
      ) || [];

      const newClientsThisMonth = clients?.filter(c => 
        c.created_at && new Date(c.created_at) >= startOfMonth
      ).length || 0;

      // ===== ONBOARDING STATS =====
      const completedOnboardings = onboardingData?.filter(o => o.completed_at) || [];
      const activeOnboardings = onboardingData?.filter(o => !o.completed_at) || [];
      
      const onboardingByManager = new Map<string, { days: number[], name: string }>();

      completedOnboardings.forEach(o => {
        const client = o.clients as any;
        if (!client?.assigned_ads_manager || !client?.onboarding_started_at) return;
        
        const startDate = new Date(client.onboarding_started_at);
        const endDate = new Date(o.completed_at);
        const days = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        const managerId = client.assigned_ads_manager;
        const manager = profiles?.find(p => p.user_id === managerId);
        
        if (!onboardingByManager.has(managerId)) {
          onboardingByManager.set(managerId, { days: [], name: manager?.name || 'Desconhecido' });
        }
        onboardingByManager.get(managerId)!.days.push(days);
      });

      const allOnboardingDays = completedOnboardings.map(o => {
        const client = o.clients as any;
        if (!client?.onboarding_started_at) return 0;
        const startDate = new Date(client.onboarding_started_at);
        const endDate = new Date(o.completed_at);
        return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      }).filter(d => d > 0);

      // Group active onboardings by milestone
      const activeByMilestone: OnboardingStats['activeByMilestone'] = [];
      for (let m = 1; m <= 5; m++) {
        const inMilestone = activeOnboardings.filter(o => o.current_milestone === m);
        activeByMilestone.push({
          milestone: m,
          count: inMilestone.length,
          clients: inMilestone.map(o => {
            const client = o.clients as any;
            const milestoneStart = (o as any)[`milestone_${m}_started_at`] || o.created_at;
            const daysInMilestone = Math.round((now.getTime() - new Date(milestoneStart).getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: o.client_id,
              name: client?.name || 'Cliente',
              daysInMilestone,
            };
          }),
        });
      }

      const onboardingStats: OnboardingStats = {
        avgDaysToComplete: allOnboardingDays.length > 0 
          ? Math.round(allOnboardingDays.reduce((a, b) => a + b, 0) / allOnboardingDays.length)
          : 0,
        totalCompleted: completedOnboardings.length,
        activeOnboardings: activeOnboardings.length,
        byManager: Array.from(onboardingByManager.entries()).map(([managerId, data]) => ({
          managerId,
          managerName: data.name,
          avgDays: Math.round(data.days.reduce((a, b) => a + b, 0) / data.days.length),
          completed: data.days.length,
        })),
        activeByMilestone,
      };

      // ===== PRODUCTION STATS =====
      const getProductionStats = (boardSlug: string) => {
        const boardCols = kanbanColumns?.filter(c => 
          (c.kanban_boards as any)?.slug === boardSlug
        ) || [];
        
        const approvedCols = boardCols.filter(c => 
          c.title.toLowerCase().includes('aprovado') || 
          c.title.toLowerCase().includes('concluído') ||
          c.title.toLowerCase().includes('finalizado')
        ).map(c => c.id);
        
        const allColIds = boardCols.map(c => c.id);
        const boardCards = kanbanCards?.filter(c => allColIds.includes(c.column_id)) || [];
        const completedCards = boardCards.filter(c => approvedCols.includes(c.column_id));
        const pendingCards = boardCards.filter(c => !approvedCols.includes(c.column_id));

        const avgDays = completedCards.length > 0 
          ? Math.round(completedCards.reduce((sum, c) => {
              const created = new Date(c.created_at).getTime();
              const updated = new Date(c.updated_at).getTime();
              return sum + Math.max(0, (updated - created) / (1000 * 60 * 60 * 24));
            }, 0) / completedCards.length)
          : 0;

        return {
          avgDays,
          totalCompleted: completedCards.length,
          pending: pendingCards.length,
        };
      };

      const productionStats: ProductionStats = {
        design: getProductionStats('design'),
        video: getProductionStats('video'),
        produtora: getProductionStats('produtora'),
        atrizes: getProductionStats('atrizes-gravacao'),
      };

      // ===== CHURN STATS =====
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const churnedThisMonth = churnedClientsList.filter(c => 
        c.archived_at && new Date(c.archived_at) >= startOfMonth
      ).length;
      const churnedLastMonth = churnedClientsList.filter(c => 
        c.archived_at && new Date(c.archived_at) >= lastMonth && new Date(c.archived_at) < startOfMonth
      ).length;

      const churnByManager = new Map<string, { name: string; count: number }>();
      churnedClientsList.forEach(c => {
        if (!c.assigned_ads_manager) return;
        const manager = profiles?.find(p => p.user_id === c.assigned_ads_manager);
        
        if (!churnByManager.has(c.assigned_ads_manager)) {
          churnByManager.set(c.assigned_ads_manager, { name: manager?.name || 'Desconhecido', count: 0 });
        }
        churnByManager.get(c.assigned_ads_manager)!.count++;
      });

      const churnManagerArray = Array.from(churnByManager.entries())
        .map(([managerId, data]) => ({
          managerId,
          managerName: data.name,
          churnCount: data.count,
        }))
        .sort((a, b) => b.churnCount - a.churnCount);

      const distratoClients = distratoClientsList.map(c => {
        const manager = profiles?.find(p => p.user_id === c.assigned_ads_manager);
        return {
          id: c.id,
          name: c.name,
          step: c.distrato_step || 'unknown',
          enteredAt: c.distrato_entered_at || c.updated_at,
          managerName: manager?.name || 'Sem gestor',
        };
      });

      const churnStats: ChurnStats = {
        totalChurned: churnedClientsList.length,
        churnedThisMonth,
        churnedLastMonth,
        distratoInProgress: distratoClientsList.length,
        byManager: churnManagerArray,
        topChurnManager: churnManagerArray.length > 0 ? churnManagerArray[0] : null,
        distratoClients,
      };

      // ===== CLIENT LABELS STATS =====
      const labelCounts = { otimo: 0, bom: 0, medio: 0, ruim: 0, semLabel: 0 };
      const labelsByManager = new Map<string, { name: string; otimo: number; bom: number; medio: number; ruim: number; semLabel: number }>();

      activeClientsList.forEach(c => {
        const label = c.client_label || 'sem_label';
        
        if (label === 'otimo') labelCounts.otimo++;
        else if (label === 'bom') labelCounts.bom++;
        else if (label === 'medio') labelCounts.medio++;
        else if (label === 'ruim') labelCounts.ruim++;
        else labelCounts.semLabel++;

        if (c.assigned_ads_manager) {
          const manager = profiles?.find(p => p.user_id === c.assigned_ads_manager);
          
          if (!labelsByManager.has(c.assigned_ads_manager)) {
            labelsByManager.set(c.assigned_ads_manager, {
              name: manager?.name || 'Desconhecido',
              otimo: 0, bom: 0, medio: 0, ruim: 0, semLabel: 0,
            });
          }
          
          const managerStats = labelsByManager.get(c.assigned_ads_manager)!;
          if (label === 'otimo') managerStats.otimo++;
          else if (label === 'bom') managerStats.bom++;
          else if (label === 'medio') managerStats.medio++;
          else if (label === 'ruim') managerStats.ruim++;
          else managerStats.semLabel++;
        }
      });

      const labelsManagerArray = Array.from(labelsByManager.entries())
        .map(([managerId, data]) => ({
          managerId,
          managerName: data.name,
          ...data,
          total: data.otimo + data.bom + data.medio + data.ruim + data.semLabel,
        }))
        .sort((a, b) => b.ruim - a.ruim);

      const clientLabelStats: ClientLabelStats = {
        total: activeClientsList.length,
        ...labelCounts,
        byManager: labelsManagerArray,
        topRuimManager: labelsManagerArray.length > 0 && labelsManagerArray[0].ruim > 0 
          ? { managerId: labelsManagerArray[0].managerId, managerName: labelsManagerArray[0].managerName, ruimCount: labelsManagerArray[0].ruim }
          : null,
      };

      // ===== GROUP/SQUAD STATS =====
      const groupSquadStats: GroupSquadStats[] = (groups || []).map(group => {
        const groupSquads = squads?.filter(s => s.group_id === group.id) || [];
        
        const squadStats = groupSquads.map(squad => {
          const squadClients = activeClientsList.filter(c => c.squad_id === squad.id);
          const labels = { otimo: 0, bom: 0, medio: 0, ruim: 0, semLabel: 0 };
          let totalValue = 0;

          squadClients.forEach(c => {
            totalValue += c.monthly_value || 0;
            const label = c.client_label || 'sem_label';
            if (label === 'otimo') labels.otimo++;
            else if (label === 'bom') labels.bom++;
            else if (label === 'medio') labels.medio++;
            else if (label === 'ruim') labels.ruim++;
            else labels.semLabel++;
          });

          return {
            squadId: squad.id,
            squadName: squad.name,
            clientCount: squadClients.length,
            labels,
            totalMonthlyValue: totalValue,
          };
        });

        const groupDirectClients = activeClientsList.filter(c => c.group_id === group.id && !c.squad_id);
        
        return {
          groupId: group.id,
          groupName: group.name,
          squads: squadStats,
          totalClients: squadStats.reduce((sum, s) => sum + s.clientCount, 0) + groupDirectClients.length,
          totalMonthlyValue: squadStats.reduce((sum, s) => sum + s.totalMonthlyValue, 0) + 
            groupDirectClients.reduce((sum, c) => sum + (c.monthly_value || 0), 0),
        };
      }).filter(g => g.totalClients > 0);

      // ===== FINANCIAL STATS =====
      const totalPayable = contasPagar?.reduce((sum, c) => sum + c.valor, 0) || 0;
      const totalPaid = contasPagar?.filter(c => c.status === 'pago').reduce((sum, c) => sum + c.valor, 0) || 0;
      const pendingPayable = contasPagar?.filter(c => c.status === 'pendente').reduce((sum, c) => sum + c.valor, 0) || 0;

      const totalReceivable = activeClients?.reduce((sum, c) => sum + (c.monthly_value || 0), 0) || 0;
      const totalReceived = contasReceber?.filter(c => c.status === 'pago').reduce((sum, c) => sum + c.valor, 0) || 0;
      const overdueReceivable = contasReceber?.filter(c => c.status === 'atrasado').reduce((sum, c) => sum + c.valor, 0) || 0;

      const result = totalReceivable - totalPayable;
      const marginPercent = totalReceivable > 0 ? (result / totalReceivable) * 100 : 0;

      // Revenue by product
      const productRevenueMap = new Map<string, { clientCount: number; revenue: number }>();
      productValues?.forEach(pv => {
        const client = activeClientsList.find(c => c.id === pv.client_id);
        if (!client) return;
        
        if (!productRevenueMap.has(pv.product_slug)) {
          productRevenueMap.set(pv.product_slug, { clientCount: 0, revenue: 0 });
        }
        const data = productRevenueMap.get(pv.product_slug)!;
        data.clientCount++;
        data.revenue += pv.monthly_value || 0;
      });

      const byProduct = (produtos || []).map(p => {
        const data = productRevenueMap.get(p.slug) || { clientCount: 0, revenue: 0 };
        return {
          productId: p.id,
          productName: p.nome,
          productSlug: p.slug,
          color: p.cor || '#6366f1',
          clientCount: data.clientCount,
          revenue: data.revenue,
        };
      }).filter(p => p.clientCount > 0 || p.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue);

      const financialStats: FinancialStats = {
        totalReceivable,
        totalReceived,
        totalPayable,
        totalPaid,
        pendingPayable,
        overdueReceivable,
        result,
        marginPercent,
        byProduct,
        monthlyTrend: [],
      };

      // ===== TASK STATS =====
      const today = now.toISOString().split('T')[0];
      
      const overdueAdsTasks = adsTasks?.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length || 0;
      const overdueComercialTasks = comercialTasks?.filter(t => t.due_date && t.due_date < today && t.status !== 'concluída').length || 0;
      const overdueRhTasks = rhTasks?.filter(t => t.data_limite && t.data_limite < today && t.status !== 'done').length || 0;

      // Overdue by Kanban area
      const overdueByArea = kanbanBoards?.map(board => {
        const boardCols = kanbanColumns?.filter(c => (c.kanban_boards as any)?.slug === board.slug) || [];
        const approvedCols = boardCols.filter(c => 
          c.title.toLowerCase().includes('aprovado') || 
          c.title.toLowerCase().includes('concluído')
        ).map(c => c.id);
        const allColIds = boardCols.map(c => c.id);
        
        const boardCards = kanbanCards?.filter(c => 
          allColIds.includes(c.column_id) && 
          !approvedCols.includes(c.column_id) &&
          c.due_date && 
          c.due_date < today
        ) || [];

        let oldestDays = 0;
        if (boardCards.length > 0) {
          const oldest = boardCards.reduce((min, c) => c.due_date && c.due_date < min ? c.due_date : min, today);
          oldestDays = Math.round((now.getTime() - new Date(oldest).getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          area: board.name,
          areaSlug: board.slug,
          count: boardCards.length,
          oldestDays,
        };
      }).filter(a => a.count > 0).sort((a, b) => b.count - a.count) || [];

      const taskStats: TaskStats = {
        totalOverdue: overdueAdsTasks + overdueComercialTasks + overdueRhTasks + overdueByArea.reduce((s, a) => s + a.count, 0),
        overdueByArea,
        tasksByStatus: {
          pending: (adsTasks?.filter(t => t.status === 'pending').length || 0) + 
                   (comercialTasks?.filter(t => t.status === 'pendente').length || 0),
          inProgress: (adsTasks?.filter(t => t.status === 'in_progress').length || 0) + 
                      (comercialTasks?.filter(t => t.status === 'em_andamento').length || 0),
          done: (adsTasks?.filter(t => t.status === 'done').length || 0) + 
                (comercialTasks?.filter(t => t.status === 'concluída').length || 0),
        },
        adsTasks: {
          total: adsTasks?.length || 0,
          overdue: overdueAdsTasks,
          pending: adsTasks?.filter(t => t.status !== 'done').length || 0,
        },
        comercialTasks: {
          total: comercialTasks?.length || 0,
          overdue: overdueComercialTasks,
          pending: comercialTasks?.filter(t => t.status !== 'concluída').length || 0,
        },
        rhTasks: {
          total: rhTasks?.length || 0,
          overdue: overdueRhTasks,
          pending: rhTasks?.filter(t => t.status !== 'done').length || 0,
        },
      };

      // ===== CS STATS =====
      const activeActionPlans = actionPlans?.filter(p => p.status === 'active' || p.status === 'in_progress').length || 0;
      const completedActionPlans = actionPlans?.filter(p => p.status === 'completed').length || 0;
      const expiredActionPlans = actionPlans?.filter(p => 
        p.due_date && new Date(p.due_date) < now && p.status !== 'completed'
      ).length || 0;

      // NPS calculation - use npsSurveys since nps_responses may have different structure
      const avgNPS = npsSurveys?.length || 0;
      const npsResponseCount = npsResponses?.length || 0;

      // Classification counts
      const byClassification = {
        monitoramento: activeClientsList.filter(c => c.cs_classification === 'monitoramento').length,
        sucesso: activeClientsList.filter(c => c.cs_classification === 'sucesso').length,
        risco: activeClientsList.filter(c => c.cs_classification === 'risco').length,
        critico: activeClientsList.filter(c => c.cs_classification === 'critico').length,
      };

      // Clients needing contact (no contact in 30+ days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const clientsNeedingContact = activeClientsList.filter(c => 
        !c.last_cs_contact_at || new Date(c.last_cs_contact_at) < thirtyDaysAgo
      ).length;

      const csStats: CSStats = {
        totalActionPlans: actionPlans?.length || 0,
        activeActionPlans,
        completedActionPlans,
        expiredActionPlans,
        avgNPS,
        npsResponses: npsResponseCount,
        clientsNeedingContact,
        byClassification,
      };

      // ===== BOTTLENECKS =====
      const bottlenecks: BottleneckStats[] = [];

      if (taskStats.totalOverdue > 10) {
        bottlenecks.push({
          area: 'Tarefas Atrasadas',
          count: taskStats.totalOverdue,
          severity: taskStats.totalOverdue > 20 ? 'critical' : 'warning',
          description: `${taskStats.totalOverdue} tarefas com prazo vencido`,
        });
      }

      if (churnStats.distratoInProgress > 0) {
        bottlenecks.push({
          area: 'Clientes em Distrato',
          count: churnStats.distratoInProgress,
          severity: churnStats.distratoInProgress > 3 ? 'critical' : 'warning',
          description: `${churnStats.distratoInProgress} clientes em processo de saída`,
        });
      }

      if (clientLabelStats.ruim > 5) {
        bottlenecks.push({
          area: 'Clientes Insatisfeitos',
          count: clientLabelStats.ruim,
          severity: clientLabelStats.ruim > 10 ? 'critical' : 'warning',
          description: `${clientLabelStats.ruim} clientes com label "Ruim"`,
        });
      }

      if (financialStats.overdueReceivable > 0) {
        bottlenecks.push({
          area: 'Inadimplência',
          count: Math.round(financialStats.overdueReceivable),
          severity: financialStats.overdueReceivable > 10000 ? 'critical' : 'warning',
          description: `R$ ${financialStats.overdueReceivable.toLocaleString('pt-BR')} em atraso`,
        });
      }

      if (csStats.expiredActionPlans > 0) {
        bottlenecks.push({
          area: 'Planos de Ação Vencidos',
          count: csStats.expiredActionPlans,
          severity: 'warning',
          description: `${csStats.expiredActionPlans} planos com prazo expirado`,
        });
      }

      // ===== SUMMARY & SCORES =====
      const totalWithWeight = activeClientsList.length;
      const weightedSum = 
        labelCounts.otimo * 100 +
        labelCounts.bom * 75 +
        labelCounts.medio * 50 +
        labelCounts.ruim * 25 +
        labelCounts.semLabel * 50;
      
      const healthScore = totalWithWeight > 0 ? Math.round(weightedSum / totalWithWeight) : 0;

      // Operational score based on bottlenecks
      const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length;
      const warningBottlenecks = bottlenecks.filter(b => b.severity === 'warning').length;
      const operationalScore = Math.max(0, 100 - (criticalBottlenecks * 20) - (warningBottlenecks * 10));

      // Avg client lifetime
      const clientsWithDates = activeClientsList.filter(c => c.entry_date || c.created_at);
      const avgClientLifetime = clientsWithDates.length > 0
        ? Math.round(clientsWithDates.reduce((sum, c) => {
            const start = new Date(c.entry_date || c.created_at).getTime();
            return sum + (now.getTime() - start) / (1000 * 60 * 60 * 24 * 30);
          }, 0) / clientsWithDates.length)
        : 0;

      return {
        onboarding: onboardingStats,
        production: productionStats,
        churn: churnStats,
        clientLabels: clientLabelStats,
        groupSquadStats,
        financial: financialStats,
        tasks: taskStats,
        cs: csStats,
        bottlenecks: bottlenecks.sort((a, b) => 
          a.severity === 'critical' ? -1 : b.severity === 'critical' ? 1 : 0
        ),
        summary: {
          totalActiveClients: activeClientsList.length,
          totalTeamMembers: profiles?.length || 0,
          totalGroups: groups?.length || 0,
          totalSquads: squads?.length || 0,
          healthScore,
          operationalScore,
          newClientsThisMonth,
          avgClientLifetime,
        },
      };
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
