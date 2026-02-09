import { Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  CreditCard,
  FileText,
  UserMinus,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function FinanceiroDashboardPage() {
  const { user, isCEO, isAdminUser } = useAuth();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

  // Verificar acesso
  const allowedRoles = ['financeiro', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);

  // Fetch financial data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['financeiro-dashboard', currentMonth],
    queryFn: async () => {
      const [
        { data: contasPagar },
        { data: contasPagarLastMonth },
        { data: contasReceber },
        { data: contasReceberLastMonth },
        { data: activeClients },
        { data: allClients },
        { data: dreData },
      ] = await Promise.all([
        supabase.from('financeiro_contas_pagar').select('*').eq('mes_referencia', currentMonth),
        supabase.from('financeiro_contas_pagar').select('*').eq('mes_referencia', lastMonth),
        supabase.from('financeiro_contas_receber').select('*').eq('mes_referencia', currentMonth),
        supabase.from('financeiro_contas_receber').select('*').eq('mes_referencia', lastMonth),
        supabase.from('financeiro_active_clients').select('*'),
        supabase.from('clients').select('id, name, status, archived, distrato_step, monthly_value, entry_date'),
        supabase.from('financeiro_dre').select('*').eq('mes_referencia', currentMonth).maybeSingle(),
      ]);

      // Clientes ativos
      const totalActiveClients = activeClients?.length || 0;
      const totalMonthlyValue = activeClients?.reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0) || 0;

      // Clientes em distrato
      const distratoClients = allClients?.filter(c => c.distrato_step && !c.archived) || [];
      const distratoValue = distratoClients.reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0);

      // Contas a Receber
      const totalReceivable = contasReceber?.reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;
      const totalRecebido = contasReceber?.filter(c => c.status === 'pago').reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;
      const totalOverdue = contasReceber?.filter(c => c.status === 'atrasado').reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;
      const overdueCount = contasReceber?.filter(c => c.status === 'atrasado').length || 0;

      // Contas a Pagar
      const totalPayable = contasPagar?.reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;
      const totalPaid = contasPagar?.filter(c => c.status === 'pago').reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;
      const totalPending = contasPagar?.filter(c => c.status === 'pendente').reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;
      const pendingCount = contasPagar?.filter(c => c.status === 'pendente').length || 0;

      // Custos por categoria
      const custosPorCategoria = contasPagar?.reduce((acc, c) => {
        const categoria = c.categoria || 'Outros';
        if (!acc[categoria]) acc[categoria] = 0;
        acc[categoria] += Number(c.valor || 0);
        return acc;
      }, {} as Record<string, number>) || {};

      // Comparação mês anterior
      const lastMonthReceivable = contasReceberLastMonth?.reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;
      const lastMonthPayable = contasPagarLastMonth?.reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;

      // Resultado
      const result = totalMonthlyValue - totalPayable;
      const marginPercent = totalMonthlyValue > 0 ? (result / totalMonthlyValue) * 100 : 0;

      // DRE
      const lucroLiquido = dreData 
        ? (Number(dreData.receita_bruta) || 0) - 
          (Number(dreData.deducoes_impostos) || 0) - 
          (Number(dreData.cmv_produtos) || 0) - 
          (Number(dreData.cmv_servicos) || 0) - 
          (Number(dreData.despesas_pessoal) || 0) - 
          (Number(dreData.despesas_administrativas) || 0) - 
          (Number(dreData.despesas_comerciais) || 0) - 
          (Number(dreData.despesas_ti) || 0) - 
          (Number(dreData.despesas_ocupacao) || 0) - 
          (Number(dreData.despesas_marketing) || 0) - 
          (Number(dreData.outras_despesas) || 0)
        : 0;

      return {
        // Clientes
        totalActiveClients,
        totalMonthlyValue,
        distratoClients: distratoClients.length,
        distratoValue,
        
        // Receber
        totalReceivable,
        totalRecebido,
        totalOverdue,
        overdueCount,
        
        // Pagar
        totalPayable,
        totalPaid,
        totalPending,
        pendingCount,
        custosPorCategoria,
        
        // Comparação
        receivableChange: lastMonthReceivable > 0 
          ? ((totalReceivable - lastMonthReceivable) / lastMonthReceivable) * 100 
          : 0,
        payableChange: lastMonthPayable > 0 
          ? ((totalPayable - lastMonthPayable) / lastMonthPayable) * 100 
          : 0,
        
        // Resultado
        result,
        marginPercent,
        lucroLiquido,
      };
    },
    refetchInterval: 60000,
  });

  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  if (isLoading || !dashboardData) {
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
      <div className="p-6 space-y-6 animate-fade-in overflow-y-auto h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
                Dashboard Financeiro
              </h1>
              <p className="text-muted-foreground text-sm">
                Visão consolidada • {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Tempo real
          </div>
        </div>

        {/* Resultado Principal */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="text-center md:text-left">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Faturamento Previsto
                </p>
                <p className="text-3xl font-bold text-success">
                  {formatCurrency(dashboardData.totalMonthlyValue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboardData.totalActiveClients} clientes ativos
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Resultado do Mês
                </p>
                <div className="flex items-center justify-center gap-2">
                  {dashboardData.result >= 0 ? (
                    <ArrowUpRight size={28} className="text-success" />
                  ) : (
                    <ArrowDownRight size={28} className="text-destructive" />
                  )}
                  <p className={cn(
                    "text-4xl font-bold",
                    dashboardData.result >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatCurrency(dashboardData.result)}
                  </p>
                </div>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "mt-2",
                    dashboardData.marginPercent >= 0 
                      ? "bg-success/10 text-success" 
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {dashboardData.marginPercent.toFixed(1)}% margem
                </Badge>
              </div>
              
              <div className="text-center md:text-right">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Custos Totais
                </p>
                <p className="text-3xl font-bold text-destructive">
                  {formatCurrency(dashboardData.totalPayable)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboardData.pendingCount} contas pendentes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Status */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Recebido */}
          <Card className="border-l-4 border-l-success">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-success" />
                <span className="text-xs text-muted-foreground">Recebido</span>
              </div>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(dashboardData.totalRecebido)}
              </p>
              <Progress 
                value={dashboardData.totalMonthlyValue > 0 
                  ? (dashboardData.totalRecebido / dashboardData.totalMonthlyValue) * 100 
                  : 0
                } 
                className="h-1.5 mt-3"
              />
            </CardContent>
          </Card>

          {/* Inadimplência */}
          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-warning" />
                <span className="text-xs text-muted-foreground">Inadimplência</span>
              </div>
              <p className={cn(
                "text-2xl font-bold",
                dashboardData.totalOverdue > 0 ? "text-warning" : "text-foreground"
              )}>
                {formatCurrency(dashboardData.totalOverdue)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {dashboardData.overdueCount} {dashboardData.overdueCount === 1 ? 'cliente' : 'clientes'}
              </p>
            </CardContent>
          </Card>

          {/* A Pagar */}
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Receipt size={16} className="text-destructive" />
                <span className="text-xs text-muted-foreground">A Pagar</span>
              </div>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(dashboardData.totalPending)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {dashboardData.pendingCount} {dashboardData.pendingCount === 1 ? 'conta' : 'contas'}
              </p>
            </CardContent>
          </Card>

          {/* Distrato */}
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <UserMinus size={16} className="text-orange-500" />
                <span className="text-xs text-muted-foreground">Em Distrato</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {dashboardData.distratoClients}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {formatCurrency(dashboardData.distratoValue)} em risco
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Seção Detalhada */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Custos por Categoria */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <PieChart size={18} className="text-primary" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider">
                  Custos por Categoria
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(dashboardData.custosPorCategoria)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([categoria, valor]) => {
                  const percentage = dashboardData.totalPayable > 0 
                    ? (valor / dashboardData.totalPayable) * 100 
                    : 0;
                  
                  return (
                    <div key={categoria} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{categoria}</span>
                        <span className="font-medium">{formatCurrency(valor)}</span>
                      </div>
                      <Progress value={percentage} className="h-1.5" />
                    </div>
                  );
                })}
              
              {Object.keys(dashboardData.custosPorCategoria).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum custo registrado este mês
                </p>
              )}
            </CardContent>
          </Card>

          {/* Resumo Rápido */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider">
                  Resumo do Mês
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-success/10">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-success" />
                    <span className="text-xs text-muted-foreground">Entradas</span>
                  </div>
                  <p className="text-lg font-bold text-success">
                    {formatCurrency(dashboardData.totalMonthlyValue)}
                  </p>
                </div>
                
                <div className="p-4 rounded-xl bg-destructive/10">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={16} className="text-destructive" />
                    <span className="text-xs text-muted-foreground">Saídas</span>
                  </div>
                  <p className="text-lg font-bold text-destructive">
                    {formatCurrency(dashboardData.totalPayable)}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Clientes Ativos</span>
                  <Badge variant="secondary">{dashboardData.totalActiveClients}</Badge>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Contas a Receber</span>
                  <span className="text-sm font-medium">{formatCurrency(dashboardData.totalMonthlyValue - dashboardData.totalRecebido)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contas a Pagar</span>
                  <span className="text-sm font-medium">{formatCurrency(dashboardData.totalPending)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dica */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Para gestão detalhada, acesse <span className="font-medium text-foreground">Millennials Contratos</span> ou <span className="font-medium text-foreground">Contas a Pagar e Receber</span>
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
