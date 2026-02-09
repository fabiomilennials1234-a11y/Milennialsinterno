import { Navigate, Link } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types/auth';
import { useDashboardStats, RecentActivity } from '@/hooks/useDashboard';
import { useUsers } from '@/hooks/useUsers';
import { TrendingUp, Users, CheckCircle2, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, Loader2, Activity, BarChart3 } from 'lucide-react';
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
export default function DashboardPage() {
  const {
    user,
    isAdminUser
  } = useAuth();
  const {
    data: stats,
    isLoading: statsLoading
  } = useDashboardStats();
  const {
    data: users = [],
    isLoading: usersLoading
  } = useUsers();

  // Dash Master é exclusivo para CEO e Gestor de Projetos
  if (!isAdminUser) {
    return <Navigate to="/" replace />;
  }
  if (statsLoading) {
    return <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>;
  }
  const metrics = [{
    title: 'Total de Tarefas',
    value: stats?.totalCards.toString() || '0',
    icon: BarChart3,
    color: 'text-info',
    bgColor: 'bg-info/10'
  }, {
    title: 'Concluídas',
    value: stats?.completedCards.toString() || '0',
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10'
  }, {
    title: 'Em Andamento',
    value: stats?.inProgressCards.toString() || '0',
    icon: Clock,
    color: 'text-primary',
    bgColor: 'bg-primary/10'
  }, {
    title: 'Atrasadas',
    value: stats?.overdueCards.toString() || '0',
    icon: AlertTriangle,
    color: 'text-danger',
    bgColor: 'bg-danger/10'
  }];

  // Calculate completion percentage per board
  const boardProgress = stats?.boardStats.map(board => ({
    name: board.boardName,
    slug: board.boardSlug,
    progress: board.total > 0 ? Math.round(board.completed / board.total * 100) : 0,
    tasks: board.total,
    completed: board.completed,
    inProgress: board.inProgress,
    overdue: board.overdue
  })) || [];

  // Priority distribution for visualization
  const priorityData = stats?.priorityDistribution || {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0
  };
  const totalPriority = priorityData.low + priorityData.medium + priorityData.high + priorityData.urgent;
  return <MainLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">DASH MASTER</h1>
            <p className="text-muted-foreground mt-1">
              Visão consolidada em tempo real • {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Ao vivo
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => <div key={metric.title} className="card-apple p-5 animate-slide-up" style={{
          animationDelay: `${index * 50}ms`
        }}>
              <div className="flex items-start justify-between">
                <div className={cn("p-2.5 rounded-xl", metric.bgColor)}>
                  <metric.icon size={20} className={metric.color} />
                </div>
              </div>
              <div className="mt-4">
                <p className="dashboard-metric text-foreground">{metric.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{metric.title}</p>
              </div>
            </div>)}
        </div>

        {/* Priority Distribution */}
        {totalPriority > 0 && <div className="card-apple p-6">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground mb-4">
              Distribuição por Prioridade
            </h3>
            <div className="flex items-center gap-2 h-4 rounded-full overflow-hidden bg-muted">
              {priorityData.urgent > 0 && <div className="h-full bg-danger transition-all duration-500" style={{
            width: `${priorityData.urgent / totalPriority * 100}%`
          }} />}
              {priorityData.high > 0 && <div className="h-full bg-warning transition-all duration-500" style={{
            width: `${priorityData.high / totalPriority * 100}%`
          }} />}
              {priorityData.medium > 0 && <div className="h-full bg-info transition-all duration-500" style={{
            width: `${priorityData.medium / totalPriority * 100}%`
          }} />}
              {priorityData.low > 0 && <div className="h-full bg-success transition-all duration-500" style={{
            width: `${priorityData.low / totalPriority * 100}%`
          }} />}
            </div>
            <div className="flex items-center gap-6 mt-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-danger" />
                <span className="text-sm text-muted-foreground">Urgente ({priorityData.urgent})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-sm text-muted-foreground">Alta ({priorityData.high})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-info" />
                <span className="text-sm text-muted-foreground">Média ({priorityData.medium})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-sm text-muted-foreground">Baixa ({priorityData.low})</span>
              </div>
            </div>
          </div>}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 card-apple p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-primary" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                  Atividade Recente
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">Atualização em tempo real</span>
            </div>
            
            <div className="space-y-4">
              {stats?.recentActivity && stats.recentActivity.length > 0 ? stats.recentActivity.map(activity => <div key={activity.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold">
                      {activity.userName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium text-foreground">{activity.userName}</span>
                        <span className="text-muted-foreground"> {actionLabels[activity.action] || activity.action} </span>
                        <span className="font-medium text-foreground">{activity.cardTitle}</span>
                      </p>
                      {/* Show De → Para for moved cards */}
                      {activity.action === 'moved' && <div className="text-xs mt-1 space-y-1">
                          {/* Column change (designer change) */}
                          {activity.details?.from_column && activity.details?.to_column && <p className="inline-flex items-center gap-1.5">
                              <span className="text-muted-foreground">Designer:</span>
                              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                {activity.details.from_column}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                {activity.details.to_column}
                              </span>
                            </p>}
                          {/* Status change within Design Kanban */}
                          {activity.details?.from_status && activity.details?.to_status && <p className="inline-flex items-center gap-1.5">
                              <span className="text-muted-foreground">Status:</span>
                              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                {getStatusLabel(activity.details.from_status)}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                {getStatusLabel(activity.details.to_status)}
                              </span>
                            </p>}
                          {/* Legacy format (from/to) for non-design boards */}
                          {activity.details?.from && activity.details?.to && !activity.details?.from_column && <p className="inline-flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                {activity.details.from}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                {activity.details.to}
                              </span>
                            </p>}
                        </div>}
                      {/* Show Para for newly created cards */}
                      {activity.action === 'created' && activity.details?.to && <p className="text-xs mt-1">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-muted-foreground">em</span>
                            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                              {activity.details.to}
                            </span>
                          </span>
                        </p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(activity.createdAt), {
                    addSuffix: true,
                    locale: ptBR
                  })}
                      </p>
                    </div>
                  </div>) : <div className="text-center py-8">
                  <Activity size={32} className="mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
                  <p className="text-xs text-muted-foreground mt-1">As atividades aparecerão aqui em tempo real</p>
                </div>}
            </div>
          </div>

          {/* Team Overview */}
          <div className="card-apple p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-info" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
                  Equipe
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {users.length} membros
              </span>
            </div>

            <div className="space-y-3">
              {usersLoading ? <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div> : users.length > 0 ? users.slice(0, 6).map(member => <div key={member.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-sm font-semibold">
                        {member.avatar ? <img src={member.avatar} alt={member.name} className="w-9 h-9 rounded-full object-cover" /> : member.name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-card"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{ROLE_LABELS[member.role]}</p>
                    </div>
                  </div>) : <div className="text-center py-8">
                  <Users size={32} className="mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado</p>
                </div>}
            </div>

            <Link to="/admin/usuarios" className="w-full mt-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-xl transition-colors block text-center">
              Ver todos ({users.length}) →
            </Link>
          </div>
        </div>

        {/* Progress by Board */}
        <div className="card-apple p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
              Progresso por Área
            </h3>
          </div>

          {boardProgress.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {boardProgress.filter(b => b.tasks > 0).map(board => <div key={board.slug} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{board.name}</span>
                    <span className="text-xs text-muted-foreground">{board.tasks} tarefas</span>
                  </div>
                  <div className="progress-elegant">
                    <div className="progress-elegant-fill transition-all duration-700" style={{
                width: `${board.progress}%`
              }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-primary">{board.progress}% concluído</span>
                    {board.overdue > 0 && <span className="text-xs text-danger">{board.overdue} atrasadas</span>}
                  </div>
                </div>)}
            </div> : <div className="text-center py-8">
              <BarChart3 size={32} className="mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Crie tarefas nos quadros para ver o progresso aqui</p>
            </div>}
        </div>
      </div>
    </MainLayout>;
}