import { useState, useMemo, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
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
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMetaAdsInsights } from '@/hooks/useMetaAdsInsights';
import { useMetaAdsAccounts } from '@/hooks/useMetaAdsAccounts';
import { useMetaAdsSync } from '@/hooks/useMetaAdsSync';
import MetaAdsOverviewTab from './meta-ads/MetaAdsOverviewTab';
import MetaAdsLeadsTab from './meta-ads/MetaAdsLeadsTab';
import MetaAdsSalesTab from './meta-ads/MetaAdsSalesTab';
import MetaAdsCreativesTab from './meta-ads/MetaAdsCreativesTab';

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

// ---------- Tab types ----------

type TabKey = 'overview' | 'leads' | 'sales' | 'creatives';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Visao Geral' },
  { key: 'leads', label: 'Leads' },
  { key: 'sales', label: 'Vendas' },
  { key: 'creatives', label: 'Criativos' },
];

// ---------- Page ----------

export default function MetaAdsDashboardPage() {
  const { isCEO } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [periodKey, setPeriodKey] = useState<PeriodKey>('30d');
  const [accountFilter, setAccountFilter] = useState('all');

  // Tab from URL or default
  const activeTab = (searchParams.get('tab') as TabKey) || 'overview';
  const setActiveTab = useCallback((tab: TabKey) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const { dateFrom, dateTo, label: periodLabel } = useMemo(() => getDateRange(periodKey), [periodKey]);
  const { data: accounts = [] } = useMetaAdsAccounts();
  const { data: insights, isLoading, aggregates } = useMetaAdsInsights({ dateFrom, dateTo, accountId: accountFilter });
  const { sync, isSyncing, canSync, cooldownRemaining, syncError } = useMetaAdsSync();

  if (!isCEO) {
    return <Navigate to="/" replace />;
  }

  const isStale = aggregates.latestFetchedAt
    ? (Date.now() - new Date(aggregates.latestFetchedAt).getTime()) > 2 * 60 * 60 * 1000
    : false;

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

        {/* Alerts */}
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

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border/50">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors relative',
                activeTab === tab.key
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <MetaAdsOverviewTab aggregates={aggregates} hasData={insights.length > 0} />
        )}
        {activeTab === 'leads' && (
          <MetaAdsLeadsTab
            dateFrom={dateFrom}
            dateTo={dateTo}
            accountId={accountFilter}
            aggregates={aggregates}
          />
        )}
        {activeTab === 'sales' && (
          <MetaAdsSalesTab
            dateFrom={dateFrom}
            dateTo={dateTo}
            accountId={accountFilter}
            aggregates={aggregates}
          />
        )}
        {activeTab === 'creatives' && (
          <MetaAdsCreativesTab
            dateFrom={dateFrom}
            dateTo={dateTo}
            accountId={accountFilter}
          />
        )}

        {/* Empty state (overview only) */}
        {activeTab === 'overview' && insights.length === 0 && !isLoading && (
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
