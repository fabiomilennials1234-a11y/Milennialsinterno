import { Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useCEOAdvancedStats } from '@/hooks/useCEOAdvancedStats';
import { ProductMetricsSection } from '@/components/dash-gestores/ProductMetricsSection';
import { 
  Crown,
  Users,
  Building2,
  Briefcase,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Target,
  Loader2,
  ArrowRight,
  DollarSign,
  Timer,
  Video,
  Palette,
  UserX,
  Heart,
  Activity,
  PieChart,
  AlertCircle,
  Calendar,
  FileText,
  MessageSquare,
  Rocket,
  ShieldAlert,
  Zap,
  ListTodo,
  XCircle,
  Star,
  ChevronRight,
  CircleDot,
  Flame,
  TrendingDown as TrendDown,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const LABEL_CONFIG = {
  otimo: { label: 'Ótimo', color: 'bg-success', textColor: 'text-success' },
  bom: { label: 'Bom', color: 'bg-info', textColor: 'text-info' },
  medio: { label: 'Médio', color: 'bg-warning', textColor: 'text-warning' },
  ruim: { label: 'Ruim', color: 'bg-destructive', textColor: 'text-destructive' },
  semLabel: { label: 'Sem Label', color: 'bg-muted-foreground', textColor: 'text-muted-foreground' },
};

const MILESTONE_NAMES = [
  'Call 1',
  'Estratégia',
  'Criativos',
  'Otimizações',
  'Publicação'
];

export default function MillennialsGrowthDashPage() {
  const { isCEO, isAdminUser } = useAuth();
  const { data: stats, isLoading } = useCEOAdvancedStats();

  // Acesso para CEO e Gestor de Projetos
  if (!isCEO && !isAdminUser) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading || !stats) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <Crown size={24} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
                DASH Millennials Growth
              </h1>
              <p className="text-muted-foreground text-sm">
                Visão estratégica consolidada • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Dados em tempo real
          </div>
        </div>

        {/* Product Metrics Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProductMetricsSection 
            productSlug="millennials-growth"
            productName="Millennials Growth"
            productColor="#6366f1"
            showCosts={true}
          />
          <ProductMetricsSection 
            productSlug="millennials-outbound"
            productName="Millennials Outbound"
            productColor="#10b981"
            showCosts={false}
          />
        </div>

        {/* Bottleneck Alerts */}
        {stats.bottlenecks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.bottlenecks.slice(0, 4).map((bottleneck, index) => (
              <div 
                key={index}
                className={cn(
                  "p-4 rounded-xl border-l-4 flex items-center gap-3",
                  bottleneck.severity === 'critical' 
                    ? "border-l-destructive bg-destructive/5" 
                    : "border-l-warning bg-warning/5"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg",
                  bottleneck.severity === 'critical' ? "bg-destructive/10" : "bg-warning/10"
                )}>
                  <ShieldAlert size={18} className={cn(
                    bottleneck.severity === 'critical' ? "text-destructive" : "text-warning"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{bottleneck.area}</p>
                  <p className="text-xs text-muted-foreground truncate">{bottleneck.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="card-apple p-4 animate-slide-up">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-info" />
              <span className="text-xs text-muted-foreground">Clientes Ativos</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.summary.totalActiveClients}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-success">
              <UserPlus size={12} />
              <span>+{stats.summary.newClientsThisMonth} este mês</span>
            </div>
          </div>

          <div className="card-apple p-4 animate-slide-up" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} className={cn(
                stats.summary.healthScore >= 70 ? "text-success" : 
                stats.summary.healthScore >= 50 ? "text-warning" : "text-destructive"
              )} />
              <span className="text-xs text-muted-foreground">Health Score</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.summary.healthScore}%</p>
            <Progress value={stats.summary.healthScore} className="h-1.5 mt-2" />
          </div>

          <div className="card-apple p-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className={cn(
                stats.summary.operationalScore >= 70 ? "text-success" : 
                stats.summary.operationalScore >= 50 ? "text-warning" : "text-destructive"
              )} />
              <span className="text-xs text-muted-foreground">Operacional</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.summary.operationalScore}%</p>
            <Progress value={stats.summary.operationalScore} className="h-1.5 mt-2" />
          </div>

          <div className="card-apple p-4 animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-2 mb-3">
              <Rocket size={16} className="text-primary" />
              <span className="text-xs text-muted-foreground">Em Onboarding</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.onboarding.activeOnboardings}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.onboarding.totalCompleted} concluídos</p>
          </div>

          <div className="card-apple p-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-2 mb-3">
              <XCircle size={16} className="text-destructive" />
              <span className="text-xs text-muted-foreground">Em Distrato</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.churn.distratoInProgress}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.churn.totalChurned} churns total</p>
          </div>

          <div className="card-apple p-4 animate-slide-up" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={16} className="text-warning" />
              <span className="text-xs text-muted-foreground">Tarefas Atrasadas</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.tasks.totalOverdue}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.tasks.overdueByArea.length} áreas afetadas</p>
          </div>
        </div>

        {/* Financial Quick View */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="card-apple p-5 border-l-4 border-l-success">
            <div className="flex items-center gap-2 text-success mb-2">
              <TrendingUp size={16} />
              <span className="text-sm font-medium">Faturamento</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats.financial.totalReceivable)}</p>
          </div>

          <div className="card-apple p-5 border-l-4 border-l-destructive">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <TrendingDown size={16} />
              <span className="text-sm font-medium">Custos</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats.financial.totalPayable)}</p>
          </div>

          <div className="card-apple p-5 border-l-4 border-l-primary">
            <div className="flex items-center gap-2 text-primary mb-2">
              <BarChart3 size={16} />
              <span className="text-sm font-medium">Resultado</span>
            </div>
            <p className={cn("text-2xl font-bold", stats.financial.result >= 0 ? "text-success" : "text-destructive")}>
              {formatCurrency(stats.financial.result)}
            </p>
          </div>

          <div className="card-apple p-5 border-l-4 border-l-warning">
            <div className="flex items-center gap-2 text-warning mb-2">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">Inadimplência</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats.financial.overdueReceivable)}</p>
          </div>
        </div>

        {/* Tabs for detailed sections */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="gap-2">
              <Activity size={14} />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="gap-2">
              <Rocket size={14} />
              <span className="hidden sm:inline">Onboarding</span>
            </TabsTrigger>
            <TabsTrigger value="operations" className="gap-2">
              <ListTodo size={14} />
              <span className="hidden sm:inline">Operações</span>
            </TabsTrigger>
            <TabsTrigger value="managers" className="gap-2">
              <Users size={14} />
              <span className="hidden sm:inline">Gestores</span>
            </TabsTrigger>
            <TabsTrigger value="cs" className="gap-2">
              <MessageSquare size={14} />
              <span className="hidden sm:inline">CS</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign size={14} />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Labels Distribution */}
              <div className="card-apple p-6">
                <div className="flex items-center gap-2 mb-5">
                  <PieChart size={18} className="text-info" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Distribuição de Labels
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {Object.entries(LABEL_CONFIG).map(([key, config]) => {
                    const count = stats.clientLabels[key as keyof typeof stats.clientLabels] as number;
                    const percentage = stats.clientLabels.total > 0 
                      ? Math.round((count / stats.clientLabels.total) * 100) 
                      : 0;
                    
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", config.color)} />
                            <span className="font-medium">{config.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{count}</span>
                            <Badge variant="secondary" className="text-xs">{percentage}%</Badge>
                          </div>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Time Metrics */}
              <div className="card-apple p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Clock size={18} className="text-primary" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Métricas de Tempo
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-primary/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer size={16} className="text-primary" />
                      <span className="text-xs text-muted-foreground">Onboarding</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.onboarding.avgDaysToComplete}</p>
                    <p className="text-xs text-muted-foreground">dias em média</p>
                  </div>

                  <div className="p-4 rounded-xl bg-info/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Palette size={16} className="text-info" />
                      <span className="text-xs text-muted-foreground">Design</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.production.design.avgDays}</p>
                    <p className="text-xs text-muted-foreground">dias em média</p>
                  </div>

                  <div className="p-4 rounded-xl bg-warning/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Video size={16} className="text-warning" />
                      <span className="text-xs text-muted-foreground">Vídeo</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.production.video.avgDays}</p>
                    <p className="text-xs text-muted-foreground">dias em média</p>
                  </div>

                  <div className="p-4 rounded-xl bg-success/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar size={16} className="text-success" />
                      <span className="text-xs text-muted-foreground">Vida Média</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.summary.avgClientLifetime}</p>
                    <p className="text-xs text-muted-foreground">meses por cliente</p>
                  </div>
                </div>
              </div>

              {/* Churn Alerts */}
              {stats.churn.distratoInProgress > 0 && (
                <div className="card-apple p-6 border-l-4 border-l-destructive lg:col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                    <Flame size={18} className="text-destructive" />
                    <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                      Clientes em Processo de Saída ({stats.churn.distratoInProgress})
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {stats.churn.distratoClients.slice(0, 6).map(client => (
                      <div key={client.id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate">{client.name}</span>
                          <Badge variant="destructive" className="text-[10px]">{client.step}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Gestor: {client.managerName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Groups Overview */}
              <div className="card-apple p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-5">
                  <Building2 size={18} className="text-primary" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Grupos e Squads
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.groupSquadStats.map(group => (
                    <div key={group.groupId} className="p-4 rounded-xl bg-muted/30 border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold">{group.groupName}</span>
                        <Badge variant="secondary">{group.totalClients} clientes</Badge>
                      </div>
                      <p className="text-sm text-success font-medium">
                        {formatCurrency(group.totalMonthlyValue)}/mês
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {group.squads.length} squads
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Onboarding Tab */}
          <TabsContent value="onboarding" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Onboarding Summary */}
              <div className="card-apple p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Rocket size={18} className="text-primary" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Resumo do Onboarding
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                    <span className="text-sm">Em Andamento</span>
                    <span className="font-bold text-primary">{stats.onboarding.activeOnboardings}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                    <span className="text-sm">Concluídos</span>
                    <span className="font-bold text-success">{stats.onboarding.totalCompleted}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Tempo Médio</span>
                    <span className="font-bold">{stats.onboarding.avgDaysToComplete} dias</span>
                  </div>
                </div>
              </div>

              {/* Milestone Distribution */}
              <div className="card-apple p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-5">
                  <Target size={18} className="text-info" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Clientes por Milestone
                  </h3>
                </div>
                
                <div className="grid grid-cols-5 gap-3">
                  {stats.onboarding.activeByMilestone.map((milestone) => (
                    <div key={milestone.milestone} className="text-center">
                      <div className={cn(
                        "mx-auto w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mb-2",
                        milestone.count > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {milestone.count}
                      </div>
                      <p className="text-xs font-medium">{MILESTONE_NAMES[milestone.milestone - 1]}</p>
                    </div>
                  ))}
                </div>

                {/* Clients in each milestone */}
                <div className="mt-6 space-y-3">
                  {stats.onboarding.activeByMilestone.filter(m => m.count > 0).map(milestone => (
                    <div key={milestone.milestone} className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <CircleDot size={14} className="text-primary" />
                        <span className="text-sm font-medium">Milestone {milestone.milestone}: {MILESTONE_NAMES[milestone.milestone - 1]}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {milestone.clients.map(client => (
                          <Badge key={client.id} variant="outline" className="text-xs">
                            {client.name} 
                            {client.daysInMilestone > 5 && (
                              <span className="ml-1 text-warning">({client.daysInMilestone}d)</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Onboarding by Manager */}
              <div className="card-apple p-6 lg:col-span-3">
                <div className="flex items-center gap-2 mb-5">
                  <Users size={18} className="text-primary" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Performance por Gestor
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-muted-foreground border-b border-border">
                        <th className="pb-3 font-medium">Gestor</th>
                        <th className="pb-3 font-medium text-center">Concluídos</th>
                        <th className="pb-3 font-medium text-center">Tempo Médio</th>
                        <th className="pb-3 font-medium text-center">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {stats.onboarding.byManager.map((manager) => (
                        <tr key={manager.managerId} className="hover:bg-muted/30">
                          <td className="py-3 font-medium">{manager.managerName}</td>
                          <td className="py-3 text-center">
                            <Badge variant="secondary">{manager.completed}</Badge>
                          </td>
                          <td className="py-3 text-center">
                            <span className={cn(
                              "font-medium",
                              manager.avgDays <= stats.onboarding.avgDaysToComplete ? "text-success" : "text-warning"
                            )}>
                              {manager.avgDays} dias
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            {manager.avgDays <= stats.onboarding.avgDaysToComplete ? (
                              <Badge className="bg-success/10 text-success border-success/20">Acima da média</Badge>
                            ) : (
                              <Badge className="bg-warning/10 text-warning border-warning/20">Abaixo da média</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Task Overview */}
              <div className="card-apple p-6">
                <div className="flex items-center gap-2 mb-5">
                  <ListTodo size={18} className="text-primary" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Tarefas por Status
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Pendentes</span>
                    <Badge variant="secondary">{stats.tasks.tasksByStatus.pending}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-info/10">
                    <span className="text-sm">Em Andamento</span>
                    <Badge className="bg-info/20 text-info">{stats.tasks.tasksByStatus.inProgress}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                    <span className="text-sm">Concluídas</span>
                    <Badge className="bg-success/20 text-success">{stats.tasks.tasksByStatus.done}</Badge>
                  </div>
                </div>
              </div>

              {/* Overdue by Area */}
              <div className="card-apple p-6">
                <div className="flex items-center gap-2 mb-5">
                  <AlertTriangle size={18} className="text-destructive" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Atrasos por Área
                  </h3>
                </div>
                
                {stats.tasks.overdueByArea.length > 0 ? (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {stats.tasks.overdueByArea.map((area) => (
                        <div key={area.areaSlug} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5">
                          <div>
                            <span className="font-medium text-sm">{area.area}</span>
                            {area.oldestDays > 7 && (
                              <p className="text-xs text-destructive">
                                Mais antigo: {area.oldestDays} dias
                              </p>
                            )}
                          </div>
                          <Badge variant="destructive">{area.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 className="mx-auto mb-2 text-success" size={32} />
                    <p className="text-muted-foreground">Nenhum atraso em Kanbans!</p>
                  </div>
                )}
              </div>

              {/* Production Stats */}
              <div className="card-apple p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-5">
                  <Zap size={18} className="text-warning" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Produção
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-info/10 border border-info/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Palette size={18} className="text-info" />
                      <span className="font-medium">Design</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Pendentes</p>
                        <p className="font-bold">{stats.production.design.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Tempo</p>
                        <p className="font-bold">{stats.production.design.avgDays}d</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Video size={18} className="text-warning" />
                      <span className="font-medium">Vídeo</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Pendentes</p>
                        <p className="font-bold">{stats.production.video.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Tempo</p>
                        <p className="font-bold">{stats.production.video.avgDays}d</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={18} className="text-primary" />
                      <span className="font-medium">Produtora</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Pendentes</p>
                        <p className="font-bold">{stats.production.produtora.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Tempo</p>
                        <p className="font-bold">{stats.production.produtora.avgDays}d</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Star size={18} className="text-success" />
                      <span className="font-medium">Atrizes</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Pendentes</p>
                        <p className="font-bold">{stats.production.atrizes.pending}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Tempo</p>
                        <p className="font-bold">{stats.production.atrizes.avgDays}d</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Tasks */}
              <div className="card-apple p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-5">
                  <Briefcase size={18} className="text-primary" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Tarefas por Departamento
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">Ads Managers</span>
                      <Badge variant="secondary">{stats.tasks.adsTasks.total}</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pendentes</span>
                        <span>{stats.tasks.adsTasks.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-destructive">Atrasadas</span>
                        <span className="font-bold text-destructive">{stats.tasks.adsTasks.overdue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">Comercial</span>
                      <Badge variant="secondary">{stats.tasks.comercialTasks.total}</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pendentes</span>
                        <span>{stats.tasks.comercialTasks.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-destructive">Atrasadas</span>
                        <span className="font-bold text-destructive">{stats.tasks.comercialTasks.overdue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">RH</span>
                      <Badge variant="secondary">{stats.tasks.rhTasks.total}</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pendentes</span>
                        <span>{stats.tasks.rhTasks.pending}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-destructive">Atrasadas</span>
                        <span className="font-bold text-destructive">{stats.tasks.rhTasks.overdue}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Managers Tab */}
          <TabsContent value="managers" className="space-y-4">
            {/* Clients by Manager Table */}
            <div className="card-apple p-6">
              <div className="flex items-center gap-2 mb-5">
                <Users size={18} className="text-primary" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                  Clientes por Gestor
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground border-b border-border">
                      <th className="pb-3 font-medium">Gestor</th>
                      <th className="pb-3 font-medium text-center">Total</th>
                      <th className="pb-3 font-medium text-center">
                        <span className="inline-flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-success" /> Ótimo
                        </span>
                      </th>
                      <th className="pb-3 font-medium text-center">
                        <span className="inline-flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-info" /> Bom
                        </span>
                      </th>
                      <th className="pb-3 font-medium text-center">
                        <span className="inline-flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-warning" /> Médio
                        </span>
                      </th>
                      <th className="pb-3 font-medium text-center">
                        <span className="inline-flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-destructive" /> Ruim
                        </span>
                      </th>
                      <th className="pb-3 font-medium text-center">Sem Label</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.clientLabels.byManager.map((manager) => (
                      <tr key={manager.managerId} className="hover:bg-muted/30">
                        <td className="py-3 font-medium">{manager.managerName}</td>
                        <td className="py-3 text-center">
                          <Badge variant="secondary">{manager.total}</Badge>
                        </td>
                        <td className="py-3 text-center">
                          <span className={cn(manager.otimo > 0 && "font-semibold text-success")}>
                            {manager.otimo}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className={cn(manager.bom > 0 && "font-semibold text-info")}>
                            {manager.bom}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className={cn(manager.medio > 0 && "font-semibold text-warning")}>
                            {manager.medio}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className={cn(manager.ruim > 0 && "font-bold text-destructive")}>
                            {manager.ruim}
                          </span>
                        </td>
                        <td className="py-3 text-center text-muted-foreground">
                          {manager.semLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Churn by Manager */}
            <div className="card-apple p-6">
              <div className="flex items-center gap-2 mb-5">
                <UserX size={18} className="text-destructive" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                  Churns por Gestor
                </h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.churn.byManager.map((manager, index) => (
                  <div 
                    key={manager.managerId}
                    className={cn(
                      "p-4 rounded-xl border-2",
                      index === 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/20"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{manager.managerName}</span>
                      {index === 0 && <Badge variant="destructive" className="text-[10px]">Maior</Badge>}
                    </div>
                    <p className={cn(
                      "text-2xl font-bold",
                      index === 0 ? "text-destructive" : "text-foreground"
                    )}>
                      {manager.churnCount}
                    </p>
                    <p className="text-xs text-muted-foreground">churns</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* CS Tab */}
          <TabsContent value="cs" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CS Overview */}
              <div className="card-apple p-6">
                <div className="flex items-center gap-2 mb-5">
                  <MessageSquare size={18} className="text-primary" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Resumo CS
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10">
                    <span className="text-sm">Precisam Contato</span>
                    <Badge className="bg-warning/20 text-warning">{stats.cs.clientsNeedingContact}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                    <span className="text-sm">Planos Ativos</span>
                    <Badge variant="secondary">{stats.cs.activeActionPlans}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                    <span className="text-sm">Planos Vencidos</span>
                    <Badge variant="destructive">{stats.cs.expiredActionPlans}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                    <span className="text-sm">Planos Concluídos</span>
                    <Badge className="bg-success/20 text-success">{stats.cs.completedActionPlans}</Badge>
                  </div>
                </div>
              </div>

              {/* Classification Distribution */}
              <div className="card-apple p-6 lg:col-span-2">
                <div className="flex items-center gap-2 mb-5">
                  <Target size={18} className="text-info" />
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                    Classificação de Clientes
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-xl bg-success/10">
                    <p className="text-3xl font-bold text-success">{stats.cs.byClassification.sucesso}</p>
                    <p className="text-sm text-muted-foreground mt-1">Sucesso</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-info/10">
                    <p className="text-3xl font-bold text-info">{stats.cs.byClassification.monitoramento}</p>
                    <p className="text-sm text-muted-foreground mt-1">Monitoramento</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-warning/10">
                    <p className="text-3xl font-bold text-warning">{stats.cs.byClassification.risco}</p>
                    <p className="text-sm text-muted-foreground mt-1">Risco</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-destructive/10">
                    <p className="text-3xl font-bold text-destructive">{stats.cs.byClassification.critico}</p>
                    <p className="text-sm text-muted-foreground mt-1">Crítico</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-4">
            {/* Result Card */}
            <div className="card-apple p-6 bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Faturamento Mensal</p>
                  <p className="text-3xl font-bold text-success">{formatCurrency(stats.financial.totalReceivable)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Resultado do Mês</p>
                  <p className={cn(
                    "text-4xl font-bold",
                    stats.financial.result >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(stats.financial.result)}
                  </p>
                  <Badge className="mt-2" variant={stats.financial.marginPercent >= 0 ? "default" : "destructive"}>
                    {stats.financial.marginPercent.toFixed(1)}% margem
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Custos Totais</p>
                  <p className="text-3xl font-bold text-destructive">{formatCurrency(stats.financial.totalPayable)}</p>
                </div>
              </div>
            </div>

            {/* Revenue by Product */}
            <div className="card-apple p-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart3 size={18} className="text-primary" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                  Faturamento por Produto
                </h3>
              </div>

              {stats.financial.byProduct.length > 0 ? (
                <div className="space-y-4">
                  {stats.financial.byProduct.map((product) => {
                    const maxRevenue = Math.max(...stats.financial.byProduct.map(p => p.revenue));
                    const percentage = maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;

                    return (
                      <div key={product.productId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: product.color }}
                            />
                            <span className="font-medium text-sm">{product.productName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {product.clientCount} clientes
                            </Badge>
                          </div>
                          <span className="font-bold text-sm">{formatCurrency(product.revenue)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: product.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="mx-auto mb-2 text-muted-foreground" size={32} />
                  <p className="text-muted-foreground">Nenhum produto com receita configurada</p>
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card-apple p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-success" />
                  <h4 className="font-semibold text-sm">Contas a Receber</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                    <span className="text-sm">Total Previsto</span>
                    <span className="font-bold text-success">{formatCurrency(stats.financial.totalReceivable)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm">Recebido</span>
                    <span className="font-medium">{formatCurrency(stats.financial.totalReceived)}</span>
                  </div>
                  {stats.financial.overdueReceivable > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                      <span className="text-sm text-destructive">Inadimplente</span>
                      <span className="font-bold text-destructive">{formatCurrency(stats.financial.overdueReceivable)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-apple p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendDown size={16} className="text-destructive" />
                  <h4 className="font-semibold text-sm">Contas a Pagar</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                    <span className="text-sm">Total do Mês</span>
                    <span className="font-bold text-destructive">{formatCurrency(stats.financial.totalPayable)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                    <span className="text-sm">Pago</span>
                    <span className="font-medium text-success">{formatCurrency(stats.financial.totalPaid)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10">
                    <span className="text-sm">Pendente</span>
                    <span className="font-bold text-warning">{formatCurrency(stats.financial.pendingPayable)}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link 
            to="/sucesso-cliente"
            className="card-apple p-5 hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <MessageSquare size={20} />
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">Sucesso do Cliente</p>
                <p className="text-xs text-muted-foreground">Dashboard CS</p>
              </div>
            </div>
          </Link>
          <Link 
            to="/admin/usuarios"
            className="card-apple p-5 hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-info/10 text-info">
                <Users size={20} />
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">Usuários</p>
                <p className="text-xs text-muted-foreground">Gestão de equipe</p>
              </div>
            </div>
          </Link>
          <Link 
            to="/clientes"
            className="card-apple p-5 hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-success/10 text-success">
                <Briefcase size={20} />
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">Clientes</p>
                <p className="text-xs text-muted-foreground">Lista completa</p>
              </div>
            </div>
          </Link>
          <Link 
            to="/financeiro"
            className="card-apple p-5 hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-warning/10 text-warning">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">Financeiro</p>
                <p className="text-xs text-muted-foreground">Gestão financeira</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
