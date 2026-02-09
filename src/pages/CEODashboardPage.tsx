import { Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Crown,
  TrendingUp,
  TrendingDown,
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useCEOIndicadores } from '@/hooks/useCEOIndicadores';
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

// Mini Card Component
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  trend,
  trendValue,
  variant = 'default',
  size = 'default'
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  size?: 'default' | 'compact';
}) {
  const variantStyles = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info',
  };

  const iconBgStyles = {
    default: 'bg-muted/50',
    success: 'bg-success/10',
    warning: 'bg-warning/10',
    destructive: 'bg-destructive/10',
    info: 'bg-info/10',
  };

  return (
    <div className={cn("card-apple", size === 'compact' ? 'p-3' : 'p-4')}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("p-1.5 rounded-lg", iconBgStyles[variant])}>
          <Icon size={size === 'compact' ? 14 : 16} className={variantStyles[variant]} />
        </div>
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <p className={cn(
        "font-bold",
        size === 'compact' ? 'text-lg' : 'text-xl',
        variantStyles[variant]
      )}>
        {typeof value === 'number' ? formatCurrency(value) : value}
      </p>
      {(subValue || trendValue) && (
        <div className="flex items-center gap-1 mt-1">
          {trend && (
            <>
              {trend === 'up' && <ArrowUpRight size={12} className="text-success" />}
              {trend === 'down' && <ArrowDownRight size={12} className="text-destructive" />}
            </>
          )}
          <span className={cn(
            "text-xs",
            trend === 'up' && 'text-success',
            trend === 'down' && 'text-destructive',
            !trend && 'text-muted-foreground'
          )}>
            {trendValue || subValue}
          </span>
        </div>
      )}
    </div>
  );
}

// Section Header Component
function SectionHeader({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-primary" />
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h2>
    </div>
  );
}

export default function CEODashboardPage() {
  const { isCEO } = useAuth();
  const { data: indicadores, isLoading } = useCEOIndicadores();

  if (!isCEO) {
    return <Navigate to="/dashboard" replace />;
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
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <Crown size={22} />
            </div>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold uppercase tracking-wide text-foreground">
                Indicadores
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm">
                {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 bg-success/5 border-success/20 text-success">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Tempo real
          </Badge>
        </div>

        {/* ===== RESULTADO DO MÊS ===== */}
        <div className="card-apple p-6 bg-gradient-to-br from-primary/5 via-background to-primary/10 border border-primary/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Resultado do Mês
              </p>
              <div className="flex items-center gap-2">
                {resultado >= 0 ? (
                  <ArrowUpRight size={28} className="text-success" />
                ) : (
                  <ArrowDownRight size={28} className="text-destructive" />
                )}
                <p className={cn(
                  "text-4xl font-bold",
                  resultado >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(resultado)}
                </p>
              </div>
              <Badge 
                variant="secondary" 
                className={cn(
                  "mt-2 text-xs",
                  margemPercent >= 0 
                    ? "bg-success/10 text-success border-success/20" 
                    : "bg-destructive/10 text-destructive border-destructive/20"
                )}
              >
                {margemPercent.toFixed(1)}% de margem
              </Badge>
            </div>
            
            {/* Mini Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-lg font-bold text-success">{formatCurrencyCompact(indicadores.faturamentoMes)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Custos</p>
                <p className="text-lg font-bold text-destructive">{formatCurrencyCompact(indicadores.custosPagosM)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Caixa</p>
                <p className={cn("text-lg font-bold", indicadores.caixaHoje >= 0 ? 'text-info' : 'text-warning')}>
                  {formatCurrencyCompact(indicadores.caixaHoje)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ===== FATURAMENTO ===== */}
        <section>
          <SectionHeader title="Faturamento" icon={DollarSign} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard 
              icon={CreditCard}
              label="Faturamento /mês"
              value={indicadores.faturamentoMes}
              subValue="Já recebido"
              variant="success"
            />
            <MetricCard 
              icon={Target}
              label="Faturamento Previsto"
              value={indicadores.faturamentoPrevisto}
              subValue={`-${indicadores.inadimplenciaTaxa.toFixed(1)}% inadimplência`}
              variant="info"
            />
            <MetricCard 
              icon={Calendar}
              label="Faturamento /ano"
              value={indicadores.faturamentoAno}
              variant="default"
            />
            <MetricCard 
              icon={Wallet}
              label="Caixa Hoje"
              value={indicadores.caixaHoje}
              variant={indicadores.caixaHoje >= 0 ? 'success' : 'warning'}
            />
          </div>

          {/* Faturamento por Produto - Gráfico */}
          {indicadores.faturamentoPorProduto.length > 0 && (
            <div className="card-apple p-4 mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Faturamento por Produto</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={indicadores.faturamentoPorProduto} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="productName" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
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
          <SectionHeader title="Custos" icon={Receipt} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard 
              icon={Receipt}
              label="Custos Previstos /mês"
              value={indicadores.custosPrevistosM}
              variant="destructive"
            />
            <MetricCard 
              icon={CreditCard}
              label="Custos Pagos /mês"
              value={indicadores.custosPagosM}
              subValue={`${((indicadores.custosPagosM / indicadores.custosPrevistosM) * 100).toFixed(0)}% do previsto`}
              variant="warning"
            />
            <MetricCard 
              icon={AlertTriangle}
              label="Inadimplência"
              value={indicadores.inadimplenciaValor}
              subValue={`${indicadores.inadimplenciaTaxa.toFixed(1)}%`}
              variant={indicadores.inadimplenciaValor > 0 ? 'warning' : 'success'}
            />
          </div>
        </section>

        {/* ===== CRESCIMENTO ===== */}
        <section>
          <SectionHeader title="Crescimento Mensal" icon={TrendingUp} />
          <div className="grid grid-cols-2 gap-3">
            <div className="card-apple p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Crescimento | Faturamento</span>
                {indicadores.crescimentoFaturamento >= 0 ? (
                  <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
                    +{indicadores.crescimentoFaturamentoPercent.toFixed(1)}%
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px]">
                    {indicadores.crescimentoFaturamentoPercent.toFixed(1)}%
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {indicadores.crescimentoFaturamento >= 0 ? (
                  <ArrowUpRight size={20} className="text-success" />
                ) : (
                  <ArrowDownRight size={20} className="text-destructive" />
                )}
                <span className={cn(
                  "text-2xl font-bold",
                  indicadores.crescimentoFaturamento >= 0 ? 'text-success' : 'text-destructive'
                )}>
                  {formatCurrency(Math.abs(indicadores.crescimentoFaturamento))}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">vs. mês anterior</p>
            </div>

            <div className="card-apple p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Crescimento | MRR</span>
                {indicadores.crescimentoMRR >= 0 ? (
                  <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
                    +{indicadores.crescimentoMRRPercent.toFixed(1)}%
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px]">
                    {indicadores.crescimentoMRRPercent.toFixed(1)}%
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {indicadores.crescimentoMRR >= 0 ? (
                  <ArrowUpRight size={20} className="text-success" />
                ) : (
                  <ArrowDownRight size={20} className="text-destructive" />
                )}
                <span className={cn(
                  "text-2xl font-bold",
                  indicadores.crescimentoMRR >= 0 ? 'text-success' : 'text-destructive'
                )}>
                  {formatCurrency(Math.abs(indicadores.crescimentoMRR))}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 mt-2 text-[9px]">
                <div className="text-center p-1 bg-muted/30 rounded">
                  <p className="text-muted-foreground">Inicial</p>
                  <p className="font-medium">{formatCurrencyCompact(indicadores.mrrInicial)}</p>
                </div>
                <div className="text-center p-1 bg-destructive/10 rounded">
                  <p className="text-destructive">-Churn</p>
                  <p className="font-medium text-destructive">{formatCurrencyCompact(indicadores.mrrDepreciation)}</p>
                </div>
                <div className="text-center p-1 bg-info/10 rounded">
                  <p className="text-info">+Exp</p>
                  <p className="font-medium text-info">{formatCurrencyCompact(indicadores.mrrExpansion)}</p>
                </div>
                <div className="text-center p-1 bg-success/10 rounded">
                  <p className="text-success">+Novo</p>
                  <p className="font-medium text-success">{formatCurrencyCompact(indicadores.mrrVendido)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico de Crescimento */}
          {indicadores.historicoMensal.length > 0 && (
            <div className="card-apple p-4 mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Evolução (6 meses)</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={indicadores.historicoMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => formatCurrencyCompact(v)} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        formatCurrency(value), 
                        name === 'faturamento' ? 'Faturamento' : 'MRR'
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="faturamento" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Faturamento"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="mrr" 
                      stroke="hsl(var(--info))" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
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
          <SectionHeader title="Vendas do Mês" icon={ShoppingCart} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard 
              icon={UserPlus}
              label="Novos Clientes"
              value={`${indicadores.novosClientesMes}`}
              variant="success"
            />
            <MetricCard 
              icon={TrendingUp}
              label="Vendas MRR /mês"
              value={indicadores.vendasMRRMes}
              variant="success"
            />
            <MetricCard 
              icon={ShoppingCart}
              label="Vendas Projeto /mês"
              value={indicadores.vendasProjetoMes}
              variant="info"
            />
          </div>

          {/* Vendas por Produto - Gráfico */}
          {indicadores.vendasPorProdutoMRR.length > 0 && (
            <div className="card-apple p-4 mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Vendas MRR por Produto</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={indicadores.vendasPorProdutoMRR}
                      dataKey="valorMRR"
                      nameKey="productName"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                    >
                      {indicadores.vendasPorProdutoMRR.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`hsl(${(index * 60) % 360}, 70%, 50%)`} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Valor MRR']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '11px'
                      }}
                    />
                    <Legend 
                      layout="vertical" 
                      align="right" 
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>

        {/* ===== CLIENTES ===== */}
        <section>
          <SectionHeader title="Métricas de Clientes" icon={Users} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard 
              icon={Users}
              label="Clientes Ativos"
              value={`${indicadores.clientesAtivos}`}
              variant="default"
            />
            <MetricCard 
              icon={UserMinus}
              label="Churn /mês"
              value={`${indicadores.churnGeral}`}
              subValue={formatCurrency(indicadores.churnValor)}
              variant={indicadores.churnGeral > 0 ? 'destructive' : 'success'}
            />
            <MetricCard 
              icon={AlertTriangle}
              label="Em Risco"
              value={`${indicadores.clientesEmRisco}`}
              variant={indicadores.clientesEmRisco > 0 ? 'warning' : 'success'}
            />
            <MetricCard 
              icon={Target}
              label="Ticket Médio"
              value={indicadores.ticketMedio}
              variant="info"
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            <MetricCard 
              icon={PiggyBank}
              label="LTV Médio"
              value={indicadores.ltvMedio}
              variant="success"
            />
            <MetricCard 
              icon={Percent}
              label="ROI Clientes"
              value={`${indicadores.roiClientes.toFixed(1)}x`}
              subValue="LTV / Ticket"
              variant="info"
            />
            <MetricCard 
              icon={BarChart3}
              label="Inadimplência"
              value={`${indicadores.inadimplenciaTaxa.toFixed(1)}%`}
              subValue={formatCurrency(indicadores.inadimplenciaValor)}
              variant={indicadores.inadimplenciaTaxa > 5 ? 'warning' : 'success'}
            />
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Dados atualizados em tempo real • Para análises detalhadas, acesse o{' '}
            <span className="font-medium text-foreground">Dash Millennials Growth</span>
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
