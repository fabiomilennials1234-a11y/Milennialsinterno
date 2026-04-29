import { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useFinanceiroActiveClients } from '@/hooks/useFinanceiroActiveClients';
import { useFinanceiroOverview } from '@/hooks/useFinanceiroOverview';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCompact(value: number) {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return formatCurrency(value);
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subtitle,
  trend,
  trendValue,
  variant = 'default',
  className 
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-card border-border',
    success: 'bg-success/5 border-success/20',
    warning: 'bg-warning/5 border-warning/20',
    danger: 'bg-destructive/5 border-destructive/20',
    info: 'bg-primary/5 border-primary/20',
  };

  const iconStyles = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    danger: 'bg-destructive/20 text-destructive',
    info: 'bg-primary/20 text-primary',
  };

  return (
    <div className={cn(
      'p-3 rounded-xl border transition-all hover:shadow-sm',
      variantStyles[variant],
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn('p-2 rounded-lg', iconStyles[variant])}>
          <Icon size={14} />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
            trend === 'up' && 'bg-success/10 text-success',
            trend === 'down' && 'bg-destructive/10 text-destructive',
            trend === 'neutral' && 'bg-muted text-muted-foreground'
          )}>
            {trend === 'up' && <ArrowUpRight size={10} />}
            {trend === 'down' && <ArrowDownRight size={10} />}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export default function FinanceiroOverviewDashboard() {
  const { stats, isLoading: isLoadingClients } = useFinanceiroActiveClients();
  const { data: overview } = useFinanceiroOverview();

  // Fetch onboarding clients (sem agregacao — lista pequena de IDs/steps).
  const { data: onboardingClients = [] } = useQuery({
    queryKey: ['financeiro-onboarding-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_client_onboarding')
        .select('id, current_step')
        .neq('current_step', 'concluido');

      if (error) throw error;
      return data || [];
    },
  });

  const financialMetrics = useMemo(() => {
    const totalRecebiveis    = overview?.contasReceber.total ?? 0;
    const recebidosMes       = overview?.contasReceber.recebidos ?? 0;
    const pendentesReceber   = overview?.contasReceber.pendentes ?? 0;
    const inadimplentes      = overview?.contasReceber.inadimplentes ?? 0;
    const totalDespesas      = overview?.contasPagar.total ?? 0;
    const despesasPagas      = overview?.contasPagar.pagas ?? 0;
    const despesasPendentes  = overview?.contasPagar.pendentes ?? 0;
    const resultado          = recebidosMes - despesasPagas;
    const taxaRecebimento    = totalRecebiveis > 0 ? (recebidosMes / totalRecebiveis) * 100 : 0;
    const taxaPagamento      = totalDespesas > 0 ? (despesasPagas / totalDespesas) * 100 : 0;

    return {
      totalRecebiveis,
      recebidosMes,
      pendentesReceber,
      inadimplentes,
      totalDespesas,
      despesasPagas,
      despesasPendentes,
      resultado,
      taxaRecebimento,
      taxaPagamento,
    };
  }, [overview]);

  const mrrMetrics = overview?.mrr;
  const contratosExpirandoCount = overview?.contratosExpirando ?? 0;
  const distratosCount = overview?.distratos ?? 0;

  if (isLoadingClients) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const monthLabel = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-4">
      {/* Header do mês */}
      <div className="flex items-center gap-2 px-1">
        <Calendar size={14} className="text-primary" />
        <span className="text-xs font-medium text-muted-foreground capitalize">
          {monthLabel}
        </span>
      </div>

      {/* Grid de métricas principais */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={DollarSign}
          label="Total a Receber"
          value={formatCurrencyCompact(stats.totalToReceive)}
          subtitle={`${stats.totalClients} clientes`}
          variant="info"
        />
        <StatCard
          icon={AlertTriangle}
          label="Inadimplentes"
          value={formatCurrencyCompact(stats.totalOverdue)}
          subtitle={`${stats.overdueCount} clientes`}
          variant={stats.overdueCount > 0 ? 'danger' : 'default'}
        />
        <StatCard
          icon={CheckCircle}
          label="Recebido"
          value={formatCurrencyCompact(financialMetrics.recebidosMes)}
          subtitle={`${stats.totalClients > 0 ? ((financialMetrics.recebidosMes / stats.totalToReceive) * 100).toFixed(0) : 0}% do total`}
          variant="success"
        />
        <StatCard
          icon={Wallet}
          label="A Pagar"
          value={formatCurrencyCompact(financialMetrics.despesasPendentes)}
          subtitle={`de ${formatCurrencyCompact(financialMetrics.totalDespesas)}`}
          variant="warning"
        />
      </div>

      {/* Progress de Recebimento */}
      <div className="p-3 bg-muted/30 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Recebimento do Mês
          </span>
          <span className="text-xs font-bold text-primary">
            {financialMetrics.taxaRecebimento.toFixed(0)}%
          </span>
        </div>
        <Progress value={financialMetrics.taxaRecebimento} className="h-2" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Recebido: {formatCurrencyCompact(financialMetrics.recebidosMes)}</span>
          <span>Meta: {formatCurrencyCompact(financialMetrics.totalRecebiveis)}</span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Status Geral
        </h4>
        
        <div className="space-y-1.5">
          {/* Clientes Ativos */}
          <div className="flex items-center justify-between p-2.5 bg-success/5 rounded-lg border border-success/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                <Users size={12} className="text-success" />
              </div>
              <span className="text-xs font-medium">Clientes Ativos</span>
            </div>
            <span className="text-sm font-bold text-success">{stats.totalClients}</span>
          </div>

          {/* Em Onboarding */}
          <div className="flex items-center justify-between p-2.5 bg-primary/5 rounded-lg border border-primary/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Clock size={12} className="text-primary" />
              </div>
              <span className="text-xs font-medium">Em Onboarding</span>
            </div>
            <span className="text-sm font-bold text-primary">{onboardingClients.length}</span>
          </div>

          {/* Contratos Expirando */}
          <div className={cn(
            'flex items-center justify-between p-2.5 rounded-lg border',
            contratosExpirandoCount > 0 
              ? 'bg-warning/5 border-warning/10' 
              : 'bg-muted/30 border-border'
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center',
                contratosExpirandoCount > 0 ? 'bg-warning/20' : 'bg-muted'
              )}>
                <FileText size={12} className={contratosExpirandoCount > 0 ? 'text-warning' : 'text-muted-foreground'} />
              </div>
              <span className="text-xs font-medium">Contratos Expirando</span>
            </div>
            <span className={cn(
              'text-sm font-bold',
              contratosExpirandoCount > 0 ? 'text-warning' : 'text-muted-foreground'
            )}>
              {contratosExpirandoCount}
            </span>
          </div>

          {/* Em Distrato */}
          <div className={cn(
            'flex items-center justify-between p-2.5 rounded-lg border',
            distratosCount > 0 
              ? 'bg-destructive/5 border-destructive/10' 
              : 'bg-muted/30 border-border'
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center',
                distratosCount > 0 ? 'bg-destructive/20' : 'bg-muted'
              )}>
                <TrendingDown size={12} className={distratosCount > 0 ? 'text-destructive' : 'text-muted-foreground'} />
              </div>
              <span className="text-xs font-medium">Em Distrato</span>
            </div>
            <span className={cn(
              'text-sm font-bold',
              distratosCount > 0 ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {distratosCount}
            </span>
          </div>

          {/* MRR Expansion */}
          {(mrrMetrics?.expansion ?? 0) > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <ArrowUpRight size={12} className="text-emerald-500" />
                </div>
                <div>
                  <span className="text-xs font-medium">MRR Expansion</span>
                  <p className="text-[10px] text-muted-foreground">Upsells + reajustes</p>
                </div>
              </div>
              <span className="text-sm font-bold text-emerald-600">
                {formatCurrencyCompact(mrrMetrics!.expansion)}
              </span>
            </div>
          )}

          {/* MRR Depreciation */}
          {(mrrMetrics?.depreciation ?? 0) > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <ArrowDownRight size={12} className="text-amber-500" />
                </div>
                <div>
                  <span className="text-xs font-medium">MRR Depreciation</span>
                  <p className="text-[10px] text-muted-foreground">Downgrades + reduções</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-600">
                {formatCurrencyCompact(mrrMetrics!.depreciation)}
              </span>
            </div>
          )}

          {/* Churn do Mês */}
          {stats.monthlyChurnValue > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-destructive/5 rounded-lg border border-destructive/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertTriangle size={12} className="text-destructive" />
                </div>
                <div>
                  <span className="text-xs font-medium">Churn do Mês</span>
                  <p className="text-[10px] text-muted-foreground">{stats.monthlyChurnCount} clientes</p>
                </div>
              </div>
              <span className="text-sm font-bold text-destructive">
                {formatCurrencyCompact(stats.monthlyChurnValue)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
