import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MetaAdAccountSelector } from '@/components/meta-ads/MetaAdAccountSelector';
import { Calendar } from '@/components/ui/calendar';
import {
  BarChart3,
  CalendarDays,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMetaAdsInsights } from '@/hooks/useMetaAdsInsights';
import { useMetaAdsAccounts, resolveDefaultAccountId } from '@/hooks/useMetaAdsAccounts';
import { useMetaAdsSync } from '@/hooks/useMetaAdsSync';
import { getDatePresets } from '@/lib/meta-ads-utils';
import MetaAdsOverviewTab from './meta-ads/MetaAdsOverviewTab';
import MetaAdsLeadsTab from './meta-ads/MetaAdsLeadsTab';
import MetaAdsSalesTab from './meta-ads/MetaAdsSalesTab';
import MetaAdsCreativesTab from './meta-ads/MetaAdsCreativesTab';

// ---------- Helpers ----------

const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');
const fmtDisplay = (iso: string) => {
  const d = parse(iso, 'yyyy-MM-dd', new Date());
  return format(d, 'dd/MM', { locale: ptBR });
};

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
  // null until accounts load — then defaults to the principal account (Milennials).
  // 'all' and explicit account_ids are user choices. We track "did the user pick"
  // separately so the principal default doesn't clobber an explicit selection.
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  // account_id whose on-demand sync we kicked off on switch — drives the inline
  // spinner in the selector. Cleared once the global isSyncing flag settles.
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const userPickedAccountRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [presetLabel, setPresetLabel] = useState('Ultimos 30 dias');

  // Date range state — default last 30 days
  const [dateFrom, setDateFrom] = useState(() => fmtDate(subDays(new Date(), 29)));
  const [dateTo, setDateTo] = useState(() => fmtDate(new Date()));

  // Convert committed string dates to Date objects for Calendar default
  const committedRange: DateRange = useMemo(() => ({
    from: parse(dateFrom, 'yyyy-MM-dd', new Date()),
    to: parse(dateTo, 'yyyy-MM-dd', new Date()),
  }), [dateFrom, dateTo]);

  // Draft selection — the calendar edits this, nothing queries until "Aplicar".
  // Preview-then-apply: keeps the dashboard stable behind the open popover and
  // makes the single-day-vs-range affordance explicit (footer narrates state).
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(committedRange);

  // Re-sync the draft to the committed range each time the popover opens, so the
  // calendar always reflects the active period (and discards an abandoned draft).
  useEffect(() => {
    if (pickerOpen) setDraftRange(committedRange);
  }, [pickerOpen, committedRange]);

  const handleRangeSelect = useCallback((range: DateRange | undefined) => {
    // react-day-picker returns { from, to: undefined } on the first click — a
    // valid one-day selection. Normalize so the draft always has both endpoints
    // (single day => from === to). Meta query filters date_start BETWEEN from
    // AND to, so from === to returns exactly that day.
    if (!range?.from) {
      setDraftRange(undefined);
      return;
    }
    setDraftRange({ from: range.from, to: range.to ?? range.from });
  }, []);

  const applyDraft = useCallback(() => {
    if (!draftRange?.from) return;
    const from = fmtDate(draftRange.from);
    const to = draftRange.to ? fmtDate(draftRange.to) : from;
    setDateFrom(from);
    setDateTo(to);
    setPresetLabel(
      from === to ? fmtDisplay(from) : `${fmtDisplay(from)} – ${fmtDisplay(to)}`,
    );
    setPickerOpen(false);
  }, [draftRange]);

  // Narrates the draft state in the footer: guides the single-vs-range choice.
  const draftSummary = useMemo(() => {
    if (!draftRange?.from) return 'Selecione uma data';
    const from = fmtDisplay(fmtDate(draftRange.from));
    if (!draftRange.to || fmtDate(draftRange.to) === fmtDate(draftRange.from)) {
      return { from, to: null };
    }
    return { from, to: fmtDisplay(fmtDate(draftRange.to)) };
  }, [draftRange]);

  const presets = useMemo(() => getDatePresets(), []);

  const handlePreset = useCallback((label: string, since: string, until: string) => {
    setDateFrom(since);
    setDateTo(until);
    setPresetLabel(label);
    setPickerOpen(false);
  }, []);

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

  const { data: accounts = [] } = useMetaAdsAccounts();
  const { sync, isSyncing, canSync, cooldownRemaining, syncError } = useMetaAdsSync();

  const defaultAccountId = useMemo(() => resolveDefaultAccountId(accounts), [accounts]);

  // Default the selector to the principal account once accounts load, unless the
  // user already picked. resolveDefaultAccountId falls back to 'all'.
  useEffect(() => {
    if (userPickedAccountRef.current || accountFilter !== null || accounts.length === 0) return;
    setAccountFilter(defaultAccountId);
  }, [accounts.length, defaultAccountId, accountFilter]);

  const effectiveAccountId = accountFilter ?? defaultAccountId;

  const { data: insights, isLoading, aggregates } = useMetaAdsInsights({
    dateFrom,
    dateTo,
    accountId: effectiveAccountId,
  });

  const handleAccountChange = useCallback((value: string) => {
    userPickedAccountRef.current = true;
    setAccountFilter(value);

    // On-demand accounts aren't pulled by the cron, so their data is stale (or
    // empty) until we ask. Fire a scoped sync on switch. cron/principal accounts
    // already have fresh data — don't waste a Graph call. Cooldown still applies.
    const account = accounts.find(a => a.account_id === value);
    if (account && account.sync_policy === 'on_demand') {
      setSyncingAccountId(value);
      sync({ mode: 'insights', accountId: value });
    } else {
      setSyncingAccountId(null);
    }
  }, [accounts, sync]);

  // Clear the per-account spinner once the scoped sync finishes.
  useEffect(() => {
    if (!isSyncing) setSyncingAccountId(null);
  }, [isSyncing]);

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
        {/* Topbar editorial A — título + sub à esquerda; controles como pills glass à direita */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] leading-none text-foreground">
              Meta Ads
            </h1>
            <p className="text-[13px] text-muted-foreground mt-2">Performance de campanhas</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date range picker */}
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="glass gap-2 min-w-[190px] justify-start font-normal"
                  aria-label={`Período selecionado: ${presetLabel}. Alterar.`}
                >
                  <CalendarDays size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground/70 shrink-0">
                    Período
                  </span>
                  <span className="truncate font-medium text-foreground">{presetLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 overflow-hidden" align="start">
                <div className="flex">
                  {/* Preset sidebar */}
                  <div className="flex flex-col gap-0.5 border-r border-border/50 p-2 min-w-[136px] bg-muted/30">
                    <p className="px-2.5 pt-1 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Atalhos
                    </p>
                    {presets.map(p => (
                      <button
                        key={p.label}
                        onClick={() => handlePreset(p.label, p.value.since, p.value.until)}
                        className={cn(
                          'text-left text-[0.8rem] px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          p.label === presetLabel
                            ? 'farol-active font-medium'
                            : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Calendar + apply footer */}
                  <div className="flex flex-col">
                    <Calendar
                      mode="range"
                      selected={draftRange}
                      onSelect={handleRangeSelect}
                      defaultMonth={committedRange.from}
                      numberOfMonths={2}
                      locale={ptBR}
                      disabled={{ after: new Date() }}
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-border/50 px-3 py-2.5">
                      {typeof draftSummary === 'string' ? (
                        <span className="text-xs text-muted-foreground">{draftSummary}</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs tabular-nums">
                          <span className="font-medium text-foreground">{draftSummary.from}</span>
                          {draftSummary.to ? (
                            <>
                              <ArrowRight size={12} className="text-muted-foreground" />
                              <span className="font-medium text-foreground">{draftSummary.to}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">· dia único</span>
                          )}
                        </span>
                      )}
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={applyDraft}
                        disabled={!draftRange?.from}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Account selector — Combobox built for 184+ accounts */}
            <MetaAdAccountSelector
              accounts={accounts}
              value={effectiveAccountId}
              onChange={handleAccountChange}
              syncingAccountId={syncingAccountId}
            />

            {/* Sync button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync({ mode: 'full' })}
              disabled={!canSync}
              className="glass gap-1.5"
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
              <Badge variant="outline" className="glass gap-1.5 px-2.5 py-1 text-xs">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isStale ? 'bg-warning' : 'bg-success ring-2 ring-success/30'
                )} />
                {timeAgo(aggregates.latestFetchedAt)}
              </Badge>
            )}
          </div>
        </div>

        {/* Alerts — glass com cor semântica (tratamento A) */}
        {syncError && (
          <div className="glass flex items-center gap-2 px-4 py-2.5 border-destructive/30 text-destructive text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            Erro na sincronizacao: {syncError}
          </div>
        )}
        {isStale && !syncError && (
          <div className="glass flex items-center gap-2 px-4 py-2.5 border-warning/30 text-warning text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            Dados podem estar desatualizados. Ultima sincronizacao {timeAgo(aggregates.latestFetchedAt)}.
          </div>
        )}

        {/* Tab bar — tratamento A: hairline base + ativo em farol-active pill + underline Farol */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors relative rounded-t-lg',
                activeTab === tab.key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-farol rounded-t glow-farol-sm" />
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
            accountId={effectiveAccountId}
            aggregates={aggregates}
          />
        )}
        {activeTab === 'sales' && (
          <MetaAdsSalesTab
            dateFrom={dateFrom}
            dateTo={dateTo}
            accountId={effectiveAccountId}
            aggregates={aggregates}
          />
        )}
        {activeTab === 'creatives' && (
          <MetaAdsCreativesTab
            dateFrom={dateFrom}
            dateTo={dateTo}
            accountId={effectiveAccountId}
          />
        )}

        {/* Empty state (overview only) */}
        {activeTab === 'overview' && insights.length === 0 && !isLoading && (
          <div className="glass grain text-center py-16 px-6 space-y-3" style={{ borderRadius: 24 }}>
            <BarChart3 size={48} className="mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum dado para o periodo selecionado</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync({ mode: 'backfill' })}
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
