import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Eye,
  MousePointerClick,
  Percent,
  Coins,
  RefreshCw,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { useMetaAdsInsights, type CampaignData } from '@/hooks/useMetaAdsInsights';
import { useMetaAdsAccounts } from '@/hooks/useMetaAdsAccounts';
import { useMetaAdsSync } from '@/hooks/useMetaAdsSync';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Legend,
} from 'recharts';

// ---------- Formatting ----------

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatCurrencyCompact = (value: number) => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
  return formatCurrency(value);
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value);

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

// ---------- Period presets ----------

type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'prev_month';

function getDateRange(key: PeriodKey): { dateFrom: string; dateTo: string; label: string } {
  const now = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  switch (key) {
    case 'today':
      return { dateFrom: fmt(now), dateTo: fmt(now), label: 'Hoje' };
    case '7d':
      return { dateFrom: fmt(subDays(now, 6)), dateTo: fmt(now), label: 'Ultimos 7 dias' };
    case '30d':
      return { dateFrom: fmt(subDays(now, 29)), dateTo: fmt(now), label: 'Ultimos 30 dias' };
    case 'month':
      return { dateFrom: fmt(startOfMonth(now)), dateTo: fmt(now), label: format(now, "MMMM 'de' yyyy", { locale: ptBR }) };
    case 'prev_month': {
      const prev = subMonths(now, 1);
      return { dateFrom: fmt(startOfMonth(prev)), dateTo: fmt(endOfMonth(prev)), label: format(prev, "MMMM 'de' yyyy", { locale: ptBR }) };
    }
  }
}

// ---------- Relative time ----------

function timeAgo(isoString: string | null): string {
  if (!isoString) return 'Nunca';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `ha ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `ha ${hours}h`;
  return `ha ${Math.floor(hours / 24)}d`;
}

function cooldownText(ms: number): string {
  const mins = Math.ceil(ms / 60_000);
  return `Aguarde ${mins}min`;
}

// ---------- Accent map for dashboard-card ----------

const ACCENT_MAP: Record<string, string> = {
  default: 'primary',
  success: 'success',
  warning: 'warning',
  destructive: 'danger',
  info: 'info',
};

// ---------- MetricCard ----------

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  variant = 'default',
  animDelay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  animDelay?: number;
}) {
  const variantStyles: Record<string, string> = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info',
  };
  const iconBgStyles: Record<string, string> = {
    default: 'bg-primary/10',
    success: 'bg-success/10',
    warning: 'bg-warning/10',
    destructive: 'bg-destructive/10',
    info: 'bg-info/10',
  };

  return (
    <div
      className="dashboard-card dash-card-animate p-4"
      data-accent={ACCENT_MAP[variant]}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded-xl', iconBgStyles[variant])}>
          <Icon size={14} className={variantStyles[variant]} />
        </div>
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
      </div>
      <p className={cn('text-xl font-bold', variantStyles[variant])}>{value}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
    </div>
  );
}

// ---------- SectionHeader ----------

function SectionHeader({ title, icon: Icon, color = 'primary' }: { title: string; icon: React.ElementType; color?: string }) {
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

// ---------- Chart tooltip ----------

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
  padding: '8px 12px',
};

// ---------- Sortable table ----------

type SortColumn = 'campaign_name' | 'spend' | 'leads' | 'cpl' | 'impressions' | 'clicks' | 'ctr';

function SortIcon({ column, current, direction }: { column: SortColumn; current: SortColumn; direction: 'asc' | 'desc' }) {
  if (column !== current) return <ArrowUpDown size={12} className="opacity-30" />;
  return direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

// ---------- Page ----------

export default function MetaAdsDashboardPage() {
  const { isCEO } = useAuth();
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d');
  const [accountFilter, setAccountFilter] = useState('all');
  const [sortCol, setSortCol] = useState<SortColumn>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { dateFrom, dateTo, label: periodLabel } = useMemo(() => getDateRange(periodKey), [periodKey]);
  const { data: accounts = [] } = useMetaAdsAccounts();
  const { data: insights, isLoading, aggregates } = useMetaAdsInsights({ dateFrom, dateTo, accountId: accountFilter });
  const { sync, isSyncing, canSync, cooldownRemaining, syncError } = useMetaAdsSync();

  // Sort campaigns — must be before any early return
  const sortedCampaigns = useMemo(() => {
    const sorted = [...aggregates.campaignData];
    sorted.sort((a, b) => {
      const av = a[sortCol as keyof CampaignData] as number | string;
      const bv = b[sortCol as keyof CampaignData] as number | string;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return sorted;
  }, [aggregates.campaignData, sortCol, sortDir]);

  if (!isCEO) {
    return <Navigate to="/" replace />;
  }

  // Staleness check: data older than 2 hours
  const isStale = aggregates.latestFetchedAt
    ? (Date.now() - new Date(aggregates.latestFetchedAt).getTime()) > 2 * 60 * 60 * 1000
    : false;

  // Sort campaigns
  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  if (isLoading) {
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
      <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="icon-circle bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold uppercase tracking-wide text-foreground">
                Meta Ads
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm">{periodLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period filter */}
            <Select value={periodKey} onValueChange={(v) => setPeriodKey(v as PeriodKey)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Ultimos 7 dias</SelectItem>
                <SelectItem value="30d">Ultimos 30 dias</SelectItem>
                <SelectItem value="month">Mes atual</SelectItem>
                <SelectItem value="prev_month">Mes anterior</SelectItem>
              </SelectContent>
            </Select>

            {/* Account filter */}
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map(acc => (
                  <SelectItem key={acc.account_id} value={acc.account_id}>
                    {acc.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sync button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync({ backfill: false })}
              disabled={!canSync}
              className="gap-1.5"
            >
              <RefreshCw size={14} className={cn(isSyncing && 'animate-spin')} />
              {isSyncing
                ? 'Sincronizando...'
                : !canSync
                  ? cooldownText(cooldownRemaining)
                  : 'Sync'}
            </Button>

            {/* Last sync badge */}
            {aggregates.latestFetchedAt && (
              <Badge variant="outline" className="gap-1.5 px-2 py-1 text-xs">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isStale ? 'bg-amber-400' : 'bg-success animate-pulse'
                )} />
                {timeAgo(aggregates.latestFetchedAt)}
              </Badge>
            )}
          </div>
        </div>

        {/* Staleness / error alerts */}
        {syncError && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertTriangle size={16} />
            Erro na sincronizacao: {syncError}
          </div>
        )}
        {isStale && !syncError && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
            <AlertTriangle size={16} />
            Dados podem estar desatualizados. Ultima sincronizacao {timeAgo(aggregates.latestFetchedAt)}.
          </div>
        )}

        {/* Hero */}
        <div className="dashboard-hero dash-card-animate">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="text-center md:text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-2 text-white/50">
                Total Investido
              </p>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20">
                  <Coins size={24} className="text-blue-400" />
                </div>
                <AnimatedCounter
                  value={aggregates.totalSpend}
                  prefix="R$ "
                  className="dashboard-metric text-blue-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1 text-white/45">Leads</p>
                <p className="text-2xl font-bold text-emerald-400">{formatNumber(aggregates.totalLeads)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1 text-white/45">Custo por Lead</p>
                <p className={cn(
                  'text-2xl font-bold',
                  aggregates.avgCPL > 0 ? 'text-amber-400' : 'text-white/60'
                )}>
                  {aggregates.avgCPL > 0 ? formatCurrency(aggregates.avgCPL) : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs Secundarios */}
        <section>
          <SectionHeader title="KPIs Secundarios" icon={BarChart3} color="info" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard icon={Eye} label="Impressoes" value={formatNumber(aggregates.totalImpressions)} variant="info" animDelay={0} />
            <MetricCard icon={MousePointerClick} label="Clicks" value={formatNumber(aggregates.totalClicks)} variant="default" animDelay={80} />
            <MetricCard icon={Percent} label="CTR" value={formatPercent(aggregates.avgCTR)} variant={aggregates.avgCTR >= 1 ? 'success' : 'warning'} animDelay={160} />
            <MetricCard icon={Coins} label="CPC" value={formatCurrency(aggregates.avgCPC)} variant="default" animDelay={240} />
            <MetricCard icon={BarChart3} label="CPM" value={formatCurrency(aggregates.avgCPM)} variant="info" animDelay={320} />
            <MetricCard icon={Users} label="Alcance" value={formatNumber(aggregates.totalReach)} variant="success" animDelay={400} />
          </div>
        </section>

        {/* Investimento vs Leads (dual-axis) */}
        {aggregates.dailyData.length > 0 && (
          <section>
            <SectionHeader title="Investimento vs Leads" icon={BarChart3} color="primary" />
            <div className="dashboard-card dash-card-animate" style={{ animationDelay: '100ms' }}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={aggregates.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'hsl(130 7% 45%)' }}
                      tickFormatter={(d: string) => {
                        const [, m, day] = d.split('-');
                        return `${day}/${m}`;
                      }}
                    />
                    <YAxis
                      yAxisId="spend"
                      tickFormatter={(v: number) => formatCurrencyCompact(v)}
                      tick={{ fontSize: 10, fill: 'hsl(130 7% 45%)' }}
                    />
                    <YAxis
                      yAxisId="leads"
                      orientation="right"
                      tick={{ fontSize: 10, fill: 'hsl(130 7% 45%)' }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === 'spend' ? formatCurrency(value) : formatNumber(value),
                        name === 'spend' ? 'Investimento' : 'Leads',
                      ]}
                      contentStyle={chartTooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar
                      yAxisId="spend"
                      dataKey="spend"
                      fill="hsl(217 91% 60%)"
                      radius={[4, 4, 0, 0]}
                      opacity={0.7}
                      name="Investimento"
                    />
                    <Line
                      yAxisId="leads"
                      type="monotone"
                      dataKey="leads"
                      stroke="hsl(160 84% 39%)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'hsl(160 84% 39%)', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                      activeDot={{ r: 5 }}
                      name="Leads"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* Top 10 Campanhas (bar chart) */}
        {aggregates.top10Campaigns.length > 0 && (
          <section>
            <SectionHeader title="Top 10 Campanhas por Investimento" icon={BarChart3} color="info" />
            <div className="dashboard-card dash-card-animate" style={{ animationDelay: '200ms' }}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aggregates.top10Campaigns} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatCurrencyCompact(v)}
                      tick={{ fontSize: 10, fill: 'hsl(130 7% 45%)' }}
                    />
                    <YAxis
                      dataKey="campaign_name"
                      type="category"
                      width={160}
                      tick={{ fontSize: 10, fill: 'hsl(130 7% 45%)' }}
                      tickFormatter={(name: string) => name.length > 25 ? name.slice(0, 22) + '...' : name}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Investimento']}
                      contentStyle={chartTooltipStyle}
                    />
                    <Bar dataKey="spend" fill="hsl(217 91% 60%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

        {/* Tabela de Campanhas */}
        {sortedCampaigns.length > 0 && (
          <section>
            <SectionHeader title="Todas as Campanhas" icon={BarChart3} color="primary" />
            <div className="dashboard-card dash-card-animate overflow-x-auto" style={{ animationDelay: '300ms' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {([
                      ['campaign_name', 'Campanha'],
                      ['spend', 'Investimento'],
                      ['leads', 'Leads'],
                      ['cpl', 'CPL'],
                      ['impressions', 'Impressoes'],
                      ['clicks', 'Clicks'],
                      ['ctr', 'CTR'],
                    ] as [SortColumn, string][]).map(([col, title]) => (
                      <th
                        key={col}
                        className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                        onClick={() => handleSort(col)}
                      >
                        <div className="flex items-center gap-1">
                          {title}
                          <SortIcon column={col} current={sortCol} direction={sortDir} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCampaigns.map(c => {
                    const isHighCPL = c.cpl > aggregates.avgCPL && aggregates.avgCPL > 0 && c.leads > 0;
                    return (
                      <tr
                        key={c.campaign_id}
                        className={cn(
                          'border-b border-border/30 hover:bg-muted/30 transition-colors',
                          isHighCPL && 'bg-amber-500/5'
                        )}
                      >
                        <td className="px-3 py-2.5 max-w-[250px]">
                          <span className="truncate block" title={c.campaign_name}>{c.campaign_name}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{formatCurrency(c.spend)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{formatNumber(c.leads)}</td>
                        <td className={cn('px-3 py-2.5 font-mono text-xs', isHighCPL && 'text-amber-500 font-semibold')}>
                          {c.leads > 0 ? formatCurrency(c.cpl) : '--'}
                          {isHighCPL && (
                            <ArrowUpRight size={12} className="inline ml-1 text-amber-500" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{formatNumber(c.impressions)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{formatNumber(c.clicks)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{formatPercent(c.ctr)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {aggregates.avgCPL > 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/30">
                  CPL medio: {formatCurrency(aggregates.avgCPL)} — linhas destacadas indicam CPL acima da media
                </div>
              )}
            </div>
          </section>
        )}

        {/* Empty state */}
        {insights.length === 0 && !isLoading && (
          <div className="text-center py-16 space-y-3">
            <BarChart3 size={48} className="mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum dado para o periodo selecionado</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync({ backfill: true })}
              disabled={!canSync}
              className="gap-1.5"
            >
              <RefreshCw size={14} className={cn(isSyncing && 'animate-spin')} />
              Backfill 90 dias
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Dados sincronizados via Meta Marketing API
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
