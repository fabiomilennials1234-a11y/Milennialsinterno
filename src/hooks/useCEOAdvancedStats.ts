import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  design: { avgDays: number; totalCompleted: number; pending: number };
  video: { avgDays: number; totalCompleted: number; pending: number };
  produtora: { avgDays: number; totalCompleted: number; pending: number };
  atrizes: { avgDays: number; totalCompleted: number; pending: number };
}

export interface ChurnStats {
  totalChurned: number;
  churnedThisMonth: number;
  churnedLastMonth: number;
  distratoInProgress: number;
  byManager: { managerId: string; managerName: string; churnCount: number }[];
  topChurnManager: { managerId: string; managerName: string; churnCount: number } | null;
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
  topRuimManager: { managerId: string; managerName: string; ruimCount: number } | null;
}

export interface GroupSquadStats {
  groupId: string;
  groupName: string;
  squads: {
    squadId: string;
    squadName: string;
    clientCount: number;
    labels: { otimo: number; bom: number; medio: number; ruim: number; semLabel: number };
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
  monthlyTrend: { month: string; receivable: number; payable: number; result: number }[];
}

export interface TaskStats {
  totalOverdue: number;
  overdueByArea: { area: string; areaSlug: string; count: number; oldestDays: number }[];
  tasksByStatus: { pending: number; inProgress: number; done: number };
  adsTasks: { total: number; overdue: number; pending: number };
  comercialTasks: { total: number; overdue: number; pending: number };
  rhTasks: { total: number; overdue: number; pending: number };
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

type RpcError = { message: string };
type RpcClient = {
  rpc: <T>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

const emptyStats: CEOAdvancedStats = {
  onboarding: { avgDaysToComplete: 0, totalCompleted: 0, activeOnboardings: 0, byManager: [], activeByMilestone: [] },
  production: {
    design: { avgDays: 0, totalCompleted: 0, pending: 0 },
    video: { avgDays: 0, totalCompleted: 0, pending: 0 },
    produtora: { avgDays: 0, totalCompleted: 0, pending: 0 },
    atrizes: { avgDays: 0, totalCompleted: 0, pending: 0 },
  },
  churn: {
    totalChurned: 0,
    churnedThisMonth: 0,
    churnedLastMonth: 0,
    distratoInProgress: 0,
    byManager: [],
    topChurnManager: null,
    distratoClients: [],
  },
  clientLabels: {
    total: 0,
    otimo: 0,
    bom: 0,
    medio: 0,
    ruim: 0,
    semLabel: 0,
    byManager: [],
    topRuimManager: null,
  },
  groupSquadStats: [],
  financial: {
    totalReceivable: 0,
    totalReceived: 0,
    totalPayable: 0,
    totalPaid: 0,
    pendingPayable: 0,
    overdueReceivable: 0,
    result: 0,
    marginPercent: 0,
    byProduct: [],
    monthlyTrend: [],
  },
  tasks: {
    totalOverdue: 0,
    overdueByArea: [],
    tasksByStatus: { pending: 0, inProgress: 0, done: 0 },
    adsTasks: { total: 0, overdue: 0, pending: 0 },
    comercialTasks: { total: 0, overdue: 0, pending: 0 },
    rhTasks: { total: 0, overdue: 0, pending: 0 },
  },
  cs: {
    totalActionPlans: 0,
    activeActionPlans: 0,
    completedActionPlans: 0,
    expiredActionPlans: 0,
    avgNPS: 0,
    npsResponses: 0,
    clientsNeedingContact: 0,
    byClassification: { monitoramento: 0, sucesso: 0, risco: 0, critico: 0 },
  },
  bottlenecks: [],
  summary: {
    totalActiveClients: 0,
    totalTeamMembers: 0,
    totalGroups: 0,
    totalSquads: 0,
    healthScore: 0,
    operationalScore: 0,
    newClientsThisMonth: 0,
    avgClientLifetime: 0,
  },
};

const toNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

function normalizeStats(raw: Partial<CEOAdvancedStats> | null | undefined): CEOAdvancedStats {
  const stats = raw ?? {};
  const onboarding = stats.onboarding ?? emptyStats.onboarding;
  const production = stats.production ?? emptyStats.production;
  const churn = stats.churn ?? emptyStats.churn;
  const clientLabels = stats.clientLabels ?? emptyStats.clientLabels;
  const financial = stats.financial ?? emptyStats.financial;
  const tasks = stats.tasks ?? emptyStats.tasks;
  const cs = stats.cs ?? emptyStats.cs;
  const summary = stats.summary ?? emptyStats.summary;

  return {
    onboarding: {
      avgDaysToComplete: toNumber(onboarding.avgDaysToComplete),
      totalCompleted: toNumber(onboarding.totalCompleted),
      activeOnboardings: toNumber(onboarding.activeOnboardings),
      byManager: Array.isArray(onboarding.byManager) ? onboarding.byManager : [],
      activeByMilestone: Array.isArray(onboarding.activeByMilestone) ? onboarding.activeByMilestone : [],
    },
    production: {
      design: { ...emptyStats.production.design, ...production.design },
      video: { ...emptyStats.production.video, ...production.video },
      produtora: { ...emptyStats.production.produtora, ...production.produtora },
      atrizes: { ...emptyStats.production.atrizes, ...production.atrizes },
    },
    churn: {
      totalChurned: toNumber(churn.totalChurned),
      churnedThisMonth: toNumber(churn.churnedThisMonth),
      churnedLastMonth: toNumber(churn.churnedLastMonth),
      distratoInProgress: toNumber(churn.distratoInProgress),
      byManager: Array.isArray(churn.byManager) ? churn.byManager : [],
      topChurnManager: churn.topChurnManager ?? null,
      distratoClients: Array.isArray(churn.distratoClients) ? churn.distratoClients : [],
    },
    clientLabels: {
      total: toNumber(clientLabels.total),
      otimo: toNumber(clientLabels.otimo),
      bom: toNumber(clientLabels.bom),
      medio: toNumber(clientLabels.medio),
      ruim: toNumber(clientLabels.ruim),
      semLabel: toNumber(clientLabels.semLabel),
      byManager: Array.isArray(clientLabels.byManager) ? clientLabels.byManager : [],
      topRuimManager: clientLabels.topRuimManager ?? null,
    },
    groupSquadStats: Array.isArray(stats.groupSquadStats) ? stats.groupSquadStats : [],
    financial: {
      totalReceivable: toNumber(financial.totalReceivable),
      totalReceived: toNumber(financial.totalReceived),
      totalPayable: toNumber(financial.totalPayable),
      totalPaid: toNumber(financial.totalPaid),
      pendingPayable: toNumber(financial.pendingPayable),
      overdueReceivable: toNumber(financial.overdueReceivable),
      result: toNumber(financial.result),
      marginPercent: toNumber(financial.marginPercent),
      byProduct: Array.isArray(financial.byProduct) ? financial.byProduct : [],
      monthlyTrend: Array.isArray(financial.monthlyTrend) ? financial.monthlyTrend : [],
    },
    tasks: {
      totalOverdue: toNumber(tasks.totalOverdue),
      overdueByArea: Array.isArray(tasks.overdueByArea) ? tasks.overdueByArea : [],
      tasksByStatus: { ...emptyStats.tasks.tasksByStatus, ...tasks.tasksByStatus },
      adsTasks: { ...emptyStats.tasks.adsTasks, ...tasks.adsTasks },
      comercialTasks: { ...emptyStats.tasks.comercialTasks, ...tasks.comercialTasks },
      rhTasks: { ...emptyStats.tasks.rhTasks, ...tasks.rhTasks },
    },
    cs: {
      totalActionPlans: toNumber(cs.totalActionPlans),
      activeActionPlans: toNumber(cs.activeActionPlans),
      completedActionPlans: toNumber(cs.completedActionPlans),
      expiredActionPlans: toNumber(cs.expiredActionPlans),
      avgNPS: toNumber(cs.avgNPS),
      npsResponses: toNumber(cs.npsResponses),
      clientsNeedingContact: toNumber(cs.clientsNeedingContact),
      byClassification: { ...emptyStats.cs.byClassification, ...cs.byClassification },
    },
    bottlenecks: Array.isArray(stats.bottlenecks) ? stats.bottlenecks : [],
    summary: {
      totalActiveClients: toNumber(summary.totalActiveClients),
      totalTeamMembers: toNumber(summary.totalTeamMembers),
      totalGroups: toNumber(summary.totalGroups),
      totalSquads: toNumber(summary.totalSquads),
      healthScore: toNumber(summary.healthScore),
      operationalScore: toNumber(summary.operationalScore),
      newClientsThisMonth: toNumber(summary.newClientsThisMonth),
      avgClientLifetime: toNumber(summary.avgClientLifetime),
    },
  };
}

export function useCEOAdvancedStats() {
  return useQuery({
    queryKey: ['ceo-advanced-stats'],
    queryFn: async (): Promise<CEOAdvancedStats> => {
      const { data, error } = await rpcClient.rpc<Partial<CEOAdvancedStats>>('get_ceo_advanced_stats');
      if (error) throw error;
      return normalizeStats(data);
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
