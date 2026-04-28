import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Users,
  UserPlus,
  UserMinus,
  DollarSign,
  Clock,
  CheckSquare,
  Calendar,
  FileText,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  BarChart3,
  Filter,
} from 'lucide-react';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { useOutboundDashboard } from '@/hooks/useOutboundDashboard';
import { getRolesAllowedForPath } from '@/types/auth';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatCurrencyCompact = (value: number) => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
  return formatCurrency(value);
};

const ACCENT_MAP: Record<string, string> = {
  default: 'primary',
  success: 'success',
  warning: 'warning',
  destructive: 'danger',
  info: 'info',
};

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
  padding: '8px 12px',
};

// --- Reusable Components ---

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  trendValue,
  variant = 'default',
  isCurrency = false,
  animDelay = 0,
}: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  isCurrency?: boolean;
  animDelay?: number;
}) {
  const variantStyles = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info',
  };

  const iconBgStyles = {
    default: 'bg-primary/10',
    success: 'bg-success/10',
    warning: 'bg-warning/10',
    destructive: 'bg-destructive/10',
    info: 'bg-info/10',
  };

  return (
    <div
      className="dashboard-card dash-card-animate p-5"
      data-accent={ACCENT_MAP[variant]}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn('p-2 rounded-xl', iconBgStyles[variant])}>
          <Icon size={16} className={variantStyles[variant]} />
        </div>
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
      </div>
      {typeof value === 'number' ? (
        <AnimatedCounter
          value={value}
          prefix={isCurrency ? 'R$ ' : ''}
          className={cn('dashboard-metric-sm font-bold block', variantStyles[variant])}
        />
      ) : (
        <p className={cn('font-bold text-2xl animate-count-up', variantStyles[variant])}>
          {value}
        </p>
      )}
      {(subValue || trendValue) && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend === 'up' && (
            <span className="trend-badge-up">
              <ArrowUpRight size={12} />
              {trendValue || subValue}
            </span>
          )}
          {trend === 'down' && (
            <span className="trend-badge-down">
              <ArrowDownRight size={12} />
              {trendValue || subValue}
            </span>
          )}
          {!trend && subValue && (
            <span className="text-xs text-muted-foreground">{subValue}</span>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, color = 'primary' }: { title: string; icon: any; color?: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="dashboard-section-header">
      <div className={cn('icon-circle', colorMap[color] || colorMap.primary)}>
        <Icon size={20} />
      </div>
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h2>
    </div>
  );
}

// --- Main Page ---

export default function OutboundDashboardPage() {
  const { user, isCEO, isAdminUser } = useAuth();
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);

  const allowedRoles = getRolesAllowedForPath('/millennials-outbound');
  const canAccess = user?.role && allowedRoles.includes(user.role);

  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  const { data, isLoading } = useOutboundDashboard(selectedManagerId);

  if (isLoading || !data) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const selectedManagerName = selectedManagerId
    ? data.managers.find(m => m.owner_user_id === selectedManagerId)?.owner_name || 'Manager'
    : 'Consolidado';

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-display text-foreground flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                Dashboard Outbound
              </h1>
              <p className="text-caption text-muted-foreground mt-1">
                {selectedManagerId ? `Visão individual: ${selectedManagerName}` : 'Visão consolidada de todos os managers'}
              </p>
            </div>

            {/* Manager Selector */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted-foreground" />
              <select
                value={selectedManagerId || ''}
                onChange={e => setSelectedManagerId(e.target.value || null)}
                className="text-sm border border-subtle rounded-xl px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Consolidado (Todos)</option>
                {data.managers.map(m => (
                  <option key={m.owner_user_id} value={m.owner_user_id}>
                    {m.owner_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard
              icon={Users}
              label="Clientes Ativos"
              value={data.totalActive}
              variant="success"
              animDelay={0}
            />
            <MetricCard
              icon={UserPlus}
              label="Em Onboarding"
              value={data.totalOnboarding}
              variant="info"
              animDelay={50}
            />
            <MetricCard
              icon={UserMinus}
              label="Churns"
              value={data.totalChurns}
              variant="destructive"
              animDelay={100}
            />
            <MetricCard
              icon={DollarSign}
              label="MRR Outbound"
              value={data.mrrOutbound}
              isCurrency
              variant="success"
              animDelay={150}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard
              icon={Clock}
              label="Tempo Médio Onboarding"
              value={data.avgOnboardingDays > 0 ? `${data.avgOnboardingDays} dias` : '—'}
              variant="warning"
              animDelay={200}
            />
            <MetricCard
              icon={CheckSquare}
              label="Tarefas Feitas Hoje"
              value={data.totalTasksDoneToday}
              variant="default"
              animDelay={250}
            />
            <MetricCard
              icon={Calendar}
              label="Reuniões no Mês"
              value={data.totalMeetingsThisMonth}
              variant="info"
              animDelay={300}
            />
            <MetricCard
              icon={FileText}
              label="Documentações Hoje"
              value={data.totalDocsToday}
              variant="default"
              animDelay={350}
            />
          </div>

          {/* Charts Grid - 2 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

            {/* Funnel de Onboarding */}
            <div className="dashboard-card p-6 dash-card-animate" data-accent="info" style={{ animationDelay: '400ms' }}>
              <SectionHeader title="Funil de Onboarding" icon={BarChart3} color="info" />
              {data.funnelData.every(f => f.count === 0) ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  Nenhum cliente em onboarding
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.funnelData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="milestone" type="category" width={70} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="count" name="Clientes" radius={[0, 6, 6, 0]}>
                      {data.funnelData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status dos Clientes */}
            <div className="dashboard-card p-6 dash-card-animate" data-accent="success" style={{ animationDelay: '450ms' }}>
              <SectionHeader title="Status dos Clientes" icon={Users} color="success" />
              {data.statusData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  Nenhum cliente cadastrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {data.statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number, name: string) => [`${value} clientes`, name]}
                    />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Full-width charts */}
          <div className="grid grid-cols-1 gap-6 mb-8">

            {/* Performance por Manager */}
            {data.managerPerformance.length > 0 && !selectedManagerId && (
              <div className="dashboard-card p-6 dash-card-animate" data-accent="primary" style={{ animationDelay: '500ms' }}>
                <SectionHeader title="Performance por Manager" icon={Target} color="primary" />
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.managerPerformance} margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="activeClients" name="Ativos" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="onboardingClients" name="Onboarding" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tasksDone" name="Tarefas Feitas" fill="hsl(258 90% 66%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="docsToday" name="Docs Hoje" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Evolução Mensal */}
            <div className="dashboard-card p-6 dash-card-animate" data-accent="warning" style={{ animationDelay: '550ms' }}>
              <SectionHeader title="Evolução Mensal (6 meses)" icon={BarChart3} color="warning" />
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.monthlyEvolution} margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="churns" name="Churns" stroke="hsl(0 84% 60%)" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="ativos" name="Ativos" stroke="hsl(160 84% 39%)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
