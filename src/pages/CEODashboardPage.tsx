import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Crown,
  TrendingUp,
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  CreditCard,
  Users,
  UserPlus,
  UserMinus,
  Target,
  Calendar,
  PiggyBank,
  BarChart3,
  Percent,
  DollarSign,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useCEOIndicadores } from '@/hooks/useCEOIndicadores';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyCompact = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}K`;
  }
  return formatCurrency(value);
};

// Variant → accent color map for dashboard-card top bar
const ACCENT_MAP: Record<string, string> = {
  default: 'primary',
  success: 'success',
  warning: 'warning',
  destructive: 'danger',
  info: 'info',
};

// Enhanced Metric Card Component
function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  trendValue,
  variant = 'default',
  size = 'default',
  animDelay = 0,
}: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  size?: 'default' | 'compact';
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
      className={cn("dashboard-card dash-card-animate", size === 'compact' ? 'p-3' : 'p-5')}
      data-accent={ACCENT_MAP[variant]}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn("p-2 rounded-xl", iconBgStyles[variant])}>
          <Icon size={size === 'compact' ? 14 : 16} className={variantStyles[variant]} />
        </div>
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
      </div>
      {typeof value === 'number' ? (
        <AnimatedCounter
          value={value}
          prefix="R$ "
          className={cn(
            "dashboard-metric-sm font-bold block",
            variantStyles[variant]
          )}
        />
      ) : (
        <p className={cn(
          "font-bold animate-count-up",
          size === 'compact' ? 'text-xl' : 'text-2xl',
          variantStyles[variant]
        )}>
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
          {!trend && (
            <span className="text-xs text-muted-foreground">{trendValue || subValue}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Enhanced Section Header Component
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
      <div className={cn("icon-circle", colorMap[color] || colorMap.primary)}>
        <Icon size={20} />
      </div>
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h2>
    </div>
  );
}

// Enhanced chart tooltip style
const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
  padding: '8px 12px',
};

// Pie chart colors (design system palette)
const PIE_COLORS = [
  'hsl(217 91% 60%)',   // blue
  'hsl(160 84% 39%)',   // green
  'hsl(258 90% 66%)',   // purple
  'hsl(38 92% 50%)',    // orange
  'hsl(0 84% 60%)',     // red
  'hsl(48 100% 50%)',   // yellow
];

const generateMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
    });
  }
  return options;
};

export default function CEODashboardPage() {
  const { isCEO } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const { data: indicadores, isLoading } = useCEOIndicadores(selectedMonth);

  if (!isCEO) {
    return <Navigate to="/" replace />;
  }

  if (isLoading || !indicadores) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const resultado = indicadores.faturamentoMes - indicadores.custosPagosM;
  const margemPercent = indicadores.faturamentoMes > 0
    ? (resultado / indicadores.faturamentoMes) * 100
    : 0;

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="icon-circle bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <Crown size={22} />
            </div>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold uppercase tracking-wide text-foreground">
                Indicadores
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm">
                {format(new Date(selectedMonth + '-15'), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecionar mês" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 bg-success/5 border-success/20 text-success">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Tempo real
            </Badge>
          </div>
        </div>

        {/* ===== RESULTADO DO MES ===== */}
        <div className="dashboard-hero dash-card-animate">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="text-center md:text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-2 text-white/50">
                Resultado do Mes
              </p>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl",
                  resultado >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"
                )}>
                  {resultado >= 0 ? (
                    <ArrowUpRight size={24} className="text-emerald-400" />
                  ) : (
                    <ArrowDownRight size={24} className="text-red-400" />
                  )}
                </div>
                <AnimatedCounter
                  value={Math.abs(resultado)}
                  prefix={resultado >= 0 ? "R$ " : "-R$ "}
                  className={cn(
                    "dashboard-metric",
                    resultado >= 0 ? "text-emerald-400" : "text-red-400"
                  )}
                />
              </div>
              <div className={cn(
                "inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-semibold",
                margemPercent >= 0
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              )}>
                {margemPercent.toFixed(1)}% de margem
              </div>
            </div>

            {/* Mini Stats */}
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1 text-white/45">Recebido</p>
                <p className="text-lg font-bold text-emerald-400">{formatCurrencyCompact(indicadores.faturamentoMes)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1 text-white/45">Custos</p>
                <p className="text-lg font-bold text-red-400">{formatCurrencyCompact(indicadores.custosPagosM)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1 text-white/45">Caixa</p>
                <p className={cn("text-lg font-bold", indicadores.caixaHoje >= 0 ? 'text-blue-400' : 'text-amber-400')}>
                  {formatCurrencyCompact(indicadores.caixaHoje)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ===== FATURAMENTO ===== */}
        <section>
          <SectionHeader title="Faturamento" icon={DollarSign} color="success" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              icon={CreditCard}
              label="Faturamento /mes"
              value={indicadores.faturamentoMes}
              subValue="Ja recebido"
              variant="success"
              animDelay={0}
            />
            <MetricCard
              icon={Target}
              label="Faturamento Previsto"
              value={indicadores.faturamentoPrevisto}
              subValue={`-${indicadores.inadimplenciaTaxa.toFixed(1)}% inadimplencia`}
              variant="info"
              animDelay={80}
            />
            <MetricCard
              icon={Calendar}
              label="Faturamento /ano"
              value={indicadores.faturamentoAno}
              variant="default"
              animDelay={160}
            />
            <MetricCard
              icon={Wallet}
              label="Caixa Hoje"
              value={indicadores.caixaHoje}
              variant={indicadores.caixaHoje >= 0 ? 'success' : 'warning'}
              animDelay={240}
            />
          </div>

          {/* Faturamento por Produto - Grafico */}
          {indicadores.faturamentoPorProduto.length > 0 && (
            <div className="dashboard-card dash-card-animate mt-4" style={{ animationDelay: '300ms' }}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Faturamento por Produto</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={indicadores.faturamentoPorProduto} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 10, fill: 'hsl(130 7% 45%)' }} />
                    <YAxis dataKey="productName" type="category" width={100} tick={{ fontSize: 10, fill: 'hsl(130 7% 45%)' }} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                      contentStyle={chartTooltipStyle}
                    />
                    <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                      {indicadores.faturamentoPorProduto.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>

        {/* ===== CUSTOS ===== */}
        <section>
          <SectionHeader title="Custos" icon={Receipt} color="danger" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard
              icon={Receipt}
              label="Custos Previstos /mes"
              value={indicadores.custosPrevistosM}
              variant="destructive"
              animDelay={0}
            />
            <MetricCard
              icon={CreditCard}
              label="Custos Pagos /mes"
              value={indicadores.custosPagosM}
              subValue={`${((indicadores.custosPagosM / indicadores.custosPrevistosM) * 100).toFixed(0)}% do previsto`}
              variant="warning"
              animDelay={80}
            />
            <MetricCard
              icon={AlertTriangle}
              label="Inadimplencia"
              value={indicadores.inadimplenciaValor}
              subValue={`${indicadores.inadimplenciaTaxa.toFixed(1)}%`}
              variant={indicadores.inadimplenciaValor > 0 ? 'warning' : 'success'}
              animDelay={160}
            />
          </div>
        </section>

        {/* ===== CRESCIMENTO ===== */}
        <section>
          <SectionHeader title="Crescimento Mensal" icon={TrendingUp} color="info" />
          <div className="grid grid-cols-2 gap-3">
            {/* Crescimento Faturamento */}
            <div
              className="dashboard-card dash-card-animate"
              data-accent={indicadores.crescimentoFaturamento >= 0 ? 'success' : 'danger'}
              style={{ animationDelay: '0ms' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">Crescimento | Faturamento</span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                  indicadores.crescimentoFaturamento >= 0
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}>
                  {indicadores.crescimentoFaturamento >= 0 ? '+' : ''}{indicadores.crescimentoFaturamentoPercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-1.5 rounded-lg",
                  indicadores.crescimentoFaturamento >= 0 ? "bg-success/10" : "bg-destructive/10"
                )}>
                  {indicadores.crescimentoFaturamento >= 0 ? (
                    <ArrowUpRight size={18} className="text-success" />
                  ) : (
                    <ArrowDownRight size={18} className="text-destructive" />
                  )}
                </div>
                <AnimatedCounter
                  value={Math.abs(indicadores.crescimentoFaturamento)}
                  prefix={indicadores.crescimentoFaturamento >= 0 ? "R$ " : "-R$ "}
                  className={cn(
                    "text-2xl font-bold",
                    indicadores.crescimentoFaturamento >= 0 ? 'text-success' : 'text-destructive'
                  )}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">vs. mes anterior</p>
            </div>

            {/* Crescimento MRR */}
            <div
              className="dashboard-card dash-card-animate"
              data-accent={indicadores.crescimentoMRR >= 0 ? 'success' : 'danger'}
              style={{ animationDelay: '80ms' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">Crescimento | MRR</span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                  indicadores.crescimentoMRR >= 0
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}>
                  {indicadores.crescimentoMRR >= 0 ? '+' : ''}{indicadores.crescimentoMRRPercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-1.5 rounded-lg",
                  indicadores.crescimentoMRR >= 0 ? "bg-success/10" : "bg-destructive/10"
                )}>
                  {indicadores.crescimentoMRR >= 0 ? (
                    <ArrowUpRight size={18} className="text-success" />
                  ) : (
                    <ArrowDownRight size={18} className="text-destructive" />
                  )}
                </div>
                <AnimatedCounter
                  value={Math.abs(indicadores.crescimentoMRR)}
                  prefix={indicadores.crescimentoMRR >= 0 ? "R$ " : "-R$ "}
                  className={cn(
                    "text-2xl font-bold",
                    indicadores.crescimentoMRR >= 0 ? 'text-success' : 'text-destructive'
                  )}
                />
              </div>
              {/* MRR Breakdown */}
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                <div className="text-center p-1.5 bg-muted/40 rounded-lg">
                  <p className="text-[9px] font-medium text-muted-foreground">Inicial</p>
                  <p className="text-[10px] font-bold">{formatCurrencyCompact(indicadores.mrrInicial)}</p>
                </div>
                <div className="text-center p-1.5 bg-destructive/10 rounded-lg">
                  <p className="text-[9px] font-medium text-destructive">-Churn</p>
                  <p className="text-[10px] font-bold text-destructive">{formatCurrencyCompact(indicadores.mrrDepreciation)}</p>
                </div>
                <div className="text-center p-1.5 bg-info/10 rounded-lg">
                  <p className="text-[9px] font-medium text-info">+Exp</p>
                  <p className="text-[10px] font-bold text-info">{formatCurrencyCompact(indicadores.mrrExpansion)}</p>
                </div>
                <div className="text-center p-1.5 bg-success/10 rounded-lg">
                  <p className="text-[9px] font-medium text-success">+Novo</p>
                  <p className="text-[10px] font-bold text-success">{formatCurrencyCompact(indicadores.mrrVendido)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Historico de Crescimento */}
          {indicadores.historicoMensal.length > 0 && (
            <div className="dashboard-card dash-card-animate mt-4" style={{ animationDelay: '160ms' }}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Evolucao (6 meses)</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={indicadores.historicoMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(130 7% 45%)' }} />
                    <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 10, fill: 'hsl(130 7% 45%)' }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === 'faturamento' ? 'Faturamento' : 'MRR'
                      ]}
                      contentStyle={chartTooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="faturamento"
                      stroke="hsl(var(--success))"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: 'hsl(var(--success))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                      activeDot={{ r: 6 }}
                      name="Faturamento"
                    />
                    <Line
                      type="monotone"
                      dataKey="mrr"
                      stroke="hsl(var(--info))"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: 'hsl(var(--info))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                      activeDot={{ r: 6 }}
                      name="MRR"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>

        {/* ===== VENDAS ===== */}
        <section>
          <SectionHeader title="Vendas do Mes" icon={ShoppingCart} color="primary" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard
              icon={UserPlus}
              label="Novos Clientes"
              value={`${indicadores.novosClientesMes}`}
              variant="success"
              animDelay={0}
            />
            <MetricCard
              icon={TrendingUp}
              label="Vendas MRR /mes"
              value={indicadores.vendasMRRMes}
              variant="success"
              animDelay={80}
            />
            <MetricCard
              icon={ShoppingCart}
              label="Vendas Projeto /mes"
              value={indicadores.vendasProjetoMes}
              variant="info"
              animDelay={160}
            />
          </div>

          {/* Vendas por Produto - Grafico */}
          {indicadores.vendasPorProdutoMRR.length > 0 && (
            <div className="dashboard-card dash-card-animate mt-4" style={{ animationDelay: '240ms' }}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Vendas MRR por Produto</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={indicadores.vendasPorProdutoMRR}
                      dataKey="valorMRR"
                      nameKey="productName"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {indicadores.vendasPorProdutoMRR.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Valor MRR']}
                      contentStyle={chartTooltipStyle}
                    />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>

        {/* ===== CLIENTES ===== */}
        <section>
          <SectionHeader title="Metricas de Clientes" icon={Users} color="info" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              icon={Users}
              label="Clientes Ativos"
              value={`${indicadores.clientesAtivos}`}
              variant="default"
              animDelay={0}
            />
            <MetricCard
              icon={UserMinus}
              label="Churn /mes"
              value={`${indicadores.churnGeral}`}
              subValue={formatCurrency(indicadores.churnValor)}
              variant={indicadores.churnGeral > 0 ? 'destructive' : 'success'}
              animDelay={80}
            />
            <MetricCard
              icon={AlertTriangle}
              label="Em Risco"
              value={`${indicadores.clientesEmRisco}`}
              variant={indicadores.clientesEmRisco > 0 ? 'warning' : 'success'}
              animDelay={160}
            />
            <MetricCard
              icon={Target}
              label="Ticket Medio"
              value={indicadores.ticketMedio}
              variant="info"
              animDelay={240}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            <MetricCard
              icon={PiggyBank}
              label="LTV Medio"
              value={indicadores.ltvMedio}
              variant="success"
              animDelay={300}
            />
            <MetricCard
              icon={Percent}
              label="ROI Clientes"
              value={`${indicadores.roiClientes.toFixed(1)}x`}
              subValue="LTV / Ticket"
              variant="info"
              animDelay={380}
            />
            <MetricCard
              icon={BarChart3}
              label="Inadimplencia"
              value={`${indicadores.inadimplenciaTaxa.toFixed(1)}%`}
              subValue={formatCurrency(indicadores.inadimplenciaValor)}
              variant={indicadores.inadimplenciaTaxa > 5 ? 'warning' : 'success'}
              animDelay={460}
            />
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Dados atualizados em tempo real
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
