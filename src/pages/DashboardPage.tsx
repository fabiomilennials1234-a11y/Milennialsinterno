import { Link } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types/auth';
import { useDashboardStats, RecentActivity } from '@/hooks/useDashboard';
import { useUsers } from '@/hooks/useUsers';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import {
  TrendingUp, Users, CheckCircle2, Clock, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Loader2, Activity, BarChart3,
  Zap, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const actionLabels: Record<string, string> = {
  created: 'criou',
  updated: 'atualizou',
  moved: 'moveu',
  deleted: 'removeu'
};

// Status labels for Design Kanban
const statusLabels: Record<string, string> = {
  em_producao: 'EM PRODUÇÃO',
  arrumar: 'ARRUMAR',
  enviar_aprovacao: 'ENVIAR / APROVAÇÃO',
  aprovados: 'APROVADOS'
};

const getStatusLabel = (status: string): string => {
  return statusLabels[status] || status;
};

const metricAccents = ['info', 'success', 'primary', 'danger'] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: users = [], isLoading: usersLoading } = useUsers();

  if (statsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const metrics = [
    {
      title: 'Total de Tarefas',
      value: stats?.totalCards || 0,
      icon: BarChart3,
      color: 'text-info',
      bgColor: 'bg-info/10',
      accent: 'info' as const,
    },
    {
      title: 'Concluídas',
      value: stats?.completedCards || 0,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      accent: 'success' as const,
    },
    {
      title: 'Em Andamento',
      value: stats?.inProgressCards || 0,
      icon: Clock,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      accent: 'primary' as const,
    },
    {
      title: 'Atrasadas',
      value: stats?.overdueCards || 0,
      icon: AlertTriangle,
      color: 'text-danger',
      bgColor: 'bg-danger/10',
      accent: 'danger' as const,
    },
  ];

  // Calculate completion percentage per board
  const boardProgress = stats?.boardStats.map(board => ({
    name: board.boardName,
    slug: board.boardSlug,
    progress: board.total > 0 ? Math.round((board.completed / board.total) * 100) : 0,
    tasks: board.total,
    completed: board.completed,
    inProgress: board.inProgress,
    overdue: board.overdue,
  })) || [];

  // Priority distribution for visualization
  const priorityData = stats?.priorityDistribution || { low: 0, medium: 0, high: 0, urgent: 0 };
  const totalPriority = priorityData.low + priorityData.medium + priorityData.high + priorityData.urgent;

  // Calculate completion rate for hero
  const completionRate = stats?.totalCards && stats.totalCards > 0
    ? Math.round((stats.completedCards / stats.totalCards) * 100)
    : 0;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Hero Card */}
        <div className="dashboard-hero dash-card-animate">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-white/10">
                  <Zap size={20} className="text-primary" />
                </div>
                <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
                  DASH MASTER
                </h1>
              </div>
              <p className="text-white/60 text-sm">
                Visão consolidada em tempo real • {new Date().toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Taxa de Conclusão</p>
                <p className="dashboard-metric text-primary">
                  <AnimatedCounter value={completionRate} suffix="%" />
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/20 text-success text-sm font-medium border border-success/20">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Ao vivo
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <div
              key={metric.title}
              className="dashboard-card dash-card-animate"
              data-accent={metric.accent}
              style={{ animationDelay: `${(index + 1) * 80}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className={cn('icon-circle', metric.bgColor)}>
                  <metric.icon size={22} className={metric.color} />
                </div>
              </div>
              <div className="mt-4">
                <p className="dashboard-metric text-foreground">
                  <AnimatedCounter value={metric.value} />
                </p>
                <p className="text-sm text-muted-foreground mt-1 font-medium">{metric.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Priority Distribution */}
        {totalPriority > 0 && (
          <div className="dashboard-card dash-card-animate" style={{ animationDelay: '400ms' }}>
            <div className="dashboard-section-header">
              <div className="section-icon bg-purple/10">
                <Target size={18} className="text-purple" />
              </div>
              <h3>Distribuição por Prioridade</h3>
              <span className="ml-auto text-xs text-muted-foreground font-normal normal-case tracking-normal">
                {totalPriority} tarefas
              </span>
            </div>
            <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-muted/50">
              {priorityData.urgent > 0 && (
                <div
                  className="h-full bg-danger rounded-full transition-all duration-700"
                  style={{ width: `${(priorityData.urgent / totalPriority) * 100}%` }}
                />
              )}
              {priorityData.high > 0 && (
                <div
                  className="h-full bg-warning rounded-full transition-all duration-700"
                  style={{ width: `${(priorityData.high / totalPriority) * 100}%` }}
                />
              )}
              {priorityData.medium > 0 && (
                <div
                  className="h-full bg-info rounded-full transition-all duration-700"
                  style={{ width: `${(priorityData.medium / totalPriority) * 100}%` }}
                />
              )}
              {priorityData.low > 0 && (
                <div
                  className="h-full bg-success rounded-full transition-all duration-700"
                  style={{ width: `${(priorityData.low / totalPriority) * 100}%` }}
                />
              )}
            </div>
            <div className="flex items-center gap-6 mt-4 flex-wrap">
              {[
                { label: 'Urgente', count: priorityData.urgent, color: 'bg-danger' },
                { label: 'Alta', count: priorityData.high, color: 'bg-warning' },
                { label: 'Média', count: priorityData.medium, color: 'bg-info' },
                { label: 'Baixa', count: priorityData.low, color: 'bg-success' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={cn('w-2.5 h-2.5 rounded-full', item.color)} />
                  <span className="text-sm text-muted-foreground">
                    {item.label}
                    <span className="font-semibold text-foreground ml-1">{item.count}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 dashboard-card dash-card-animate" style={{ animationDelay: '500ms' }}>
            <div className="dashboard-section-header">
              <div className="section-icon bg-primary/10">
                <Activity size={18} className="text-primary" />
              </div>
              <h3>Atividade Recente</h3>
              <span className="ml-auto text-xs text-muted-foreground font-normal normal-case tracking-normal flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Tempo real
              </span>
            </div>

            <div className="space-y-1">
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity, i) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-all duration-200"
                  >
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold text-sm flex-shrink-0">
                      {activity.userName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium text-foreground">{activity.userName}</span>
                        <span className="text-muted-foreground"> {actionLabels[activity.action] || activity.action} </span>
                        <span className="font-medium text-foreground">{activity.cardTitle}</span>
                      </p>
                      {/* Show De → Para for moved cards */}
                      {activity.action === 'moved' && (
                        <div className="text-xs mt-1 space-y-1">
                          {activity.details?.from_column && activity.details?.to_column && (
                            <p className="inline-flex items-center gap-1.5">
                              <span className="text-muted-foreground">Designer:</span>
                              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                                {activity.details.from_column}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                                {activity.details.to_column}
                              </span>
                            </p>
                          )}
                          {activity.details?.from_status && activity.details?.to_status && (
                            <p className="inline-flex items-center gap-1.5">
                              <span className="text-muted-foreground">Status:</span>
                              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                                {getStatusLabel(activity.details.from_status)}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                                {getStatusLabel(activity.details.to_status)}
                              </span>
                            </p>
                          )}
                          {activity.details?.from && activity.details?.to && !activity.details?.from_column && (
                            <p className="inline-flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                                {activity.details.from}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                                {activity.details.to}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                      {activity.action === 'created' && activity.details?.to && (
                        <p className="text-xs mt-1">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-muted-foreground">em</span>
                            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                              {activity.details.to}
                            </span>
                          </span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(activity.createdAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <Activity size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade recente</p>
                  <p className="text-xs text-muted-foreground mt-1">As atividades aparecerão aqui em tempo real</p>
                </div>
              )}
            </div>
          </div>

          {/* Team Overview */}
          <div className="dashboard-card dash-card-animate" style={{ animationDelay: '600ms' }}>
            <div className="dashboard-section-header">
              <div className="section-icon bg-info/10">
                <Users size={18} className="text-info" />
              </div>
              <h3>Equipe</h3>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {users.length}
              </span>
            </div>

            <div className="space-y-1">
              {usersLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : users.length > 0 ? (
                users.slice(0, 6).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-all duration-200"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-sm font-semibold overflow-hidden">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          member.name.charAt(0)
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-card" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{ROLE_LABELS[member.role]}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <Users size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado</p>
                </div>
              )}
            </div>

            <Link
              to="/admin/usuarios"
              className="w-full mt-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 rounded-xl transition-colors block text-center"
            >
              Ver todos ({users.length}) →
            </Link>
          </div>
        </div>

        {/* Progress by Board */}
        <div className="dashboard-card dash-card-animate" style={{ animationDelay: '700ms' }}>
          <div className="dashboard-section-header">
            <div className="section-icon bg-success/10">
              <TrendingUp size={18} className="text-success" />
            </div>
            <h3>Progresso por Área</h3>
          </div>

          {boardProgress.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {boardProgress.filter((b) => b.tasks > 0).map((board, i) => (
                <div
                  key={board.slug}
                  className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/20 transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-foreground">{board.name}</span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                      {board.tasks}
                    </span>
                  </div>
                  <div className="progress-elegant">
                    <div
                      className="progress-elegant-fill"
                      style={{ width: `${board.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs font-semibold text-primary">
                      <AnimatedCounter value={board.progress} suffix="%" duration={800} />
                    </span>
                    {board.overdue > 0 && (
                      <span className="text-xs text-danger font-medium flex items-center gap-1">
                        <AlertTriangle size={10} />
                        {board.overdue} atrasadas
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <BarChart3 size={36} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhuma tarefa cadastrada ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Crie tarefas nos quadros para ver o progresso aqui</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
