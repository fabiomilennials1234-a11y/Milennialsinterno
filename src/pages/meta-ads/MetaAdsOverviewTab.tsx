import { useState, useMemo } from 'react';
import {
  BarChart3,
  Eye,
  MousePointerClick,
  Percent,
  Coins,
  Users,
  ArrowUpRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Video,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { type MetaAdsAggregates, type CampaignData } from '@/hooks/useMetaAdsInsights';
import { MetricCard, SectionHeader } from './shared-components';
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent, chartTooltipStyle } from './format-utils';
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

type SortColumn = 'campaign_name' | 'spend' | 'leads' | 'cpl' | 'impressions' | 'clicks' | 'ctr' | 'hook_rate' | 'connect_rate';

function SortIcon({ column, current, direction }: { column: SortColumn; current: SortColumn; direction: 'asc' | 'desc' }) {
  if (column !== current) return <ArrowUpDown size={12} className="opacity-30" />;
  return direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

interface Props {
  aggregates: MetaAdsAggregates;
  hasData: boolean;
}

export default function MetaAdsOverviewTab({ aggregates, hasData }: Props) {
  const [sortCol, setSortCol] = useState<SortColumn>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  if (!hasData) return null;

  return (
    <div className="space-y-6">
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

      {/* KPIs */}
      <section>
        <SectionHeader title="KPIs Secundarios" icon={BarChart3} color="info" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard icon={Eye} label="Impressoes" value={formatNumber(aggregates.totalImpressions)} variant="info" animDelay={0} />
          <MetricCard icon={MousePointerClick} label="Clicks" value={formatNumber(aggregates.totalClicks)} variant="default" animDelay={80} />
          <MetricCard icon={Percent} label="CTR" value={formatPercent(aggregates.avgCTR)} variant={aggregates.avgCTR >= 1 ? 'success' : 'warning'} animDelay={160} />
          <MetricCard icon={Coins} label="CPC" value={formatCurrency(aggregates.avgCPC)} variant="default" animDelay={240} />
          <MetricCard icon={BarChart3} label="CPM" value={formatCurrency(aggregates.avgCPM)} variant="info" animDelay={320} />
          <MetricCard icon={Users} label="Alcance" value={formatNumber(aggregates.totalReach)} variant="success" animDelay={400} />
          <MetricCard icon={Video} label="Hook Rate" value={formatPercent(aggregates.avgHookRate)} subValue="3s views / impressoes" variant="info" animDelay={480} />
          <MetricCard icon={Zap} label="Connect Rate" value={formatPercent(aggregates.avgConnectRate)} subValue="clicks / 3s views" variant={aggregates.avgConnectRate >= 5 ? 'success' : 'warning'} animDelay={560} />
        </div>
      </section>

      {/* Investimento vs Leads chart */}
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

      {/* Top 10 bar chart */}
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

      {/* Campaign table */}
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
                    ['hook_rate', 'Hook Rate'],
                    ['connect_rate', 'Connect Rate'],
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
                      <td className="px-3 py-2.5 font-mono text-xs">{c.impressions > 0 ? formatPercent(c.hook_rate) : '--'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{c.video_views > 0 ? formatPercent(c.connect_rate) : '--'}</td>
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
    </div>
  );
}
