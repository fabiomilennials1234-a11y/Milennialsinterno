import { useState, useMemo } from 'react';
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
  CalendarDays,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Generate month options for filter
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
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Derive previous month from selectedMonth
  const previousMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    return format(prevDate, 'yyyy-MM');
  }, [selectedMonth]);

  // Verificar acesso
  const allowedRoles = ['financeiro', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);

  // Fetch financial data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['financeiro-dashboard', selectedMonth],
    queryFn: async () => {
      const currentMonthStr = format(new Date(), 'yyyy-MM');

      // Garantir que o mês selecionado tenha dados em contas a pagar (mesma lógica do modal)
      const { data: existingContasPagar } = await supabase
        .from('financeiro_contas_pagar')
        .select('id')
        .eq('mes_referencia', selectedMonth)
        .limit(1);

      if (!existingContasPagar || existingContasPagar.length === 0) {
        const { data: prevData } = await supabase
          .from('financeiro_contas_pagar')
          .select('fornecedor, valor, categoria, status, produtos_vinculados, area')
          .eq('mes_referencia', previousMonth);

        if (prevData && prevData.length > 0) {
          const isCurrentOrPast = selectedMonth <= currentMonthStr;
          const dataToInsert = prevData.map(item => ({
            fornecedor: item.fornecedor,
            valor: item.valor,
            categoria: item.categoria,
            status: isCurrentOrPast ? item.status : 'pendente',
            produtos_vinculados: item.produtos_vinculados || [],
            area: item.area || null,
            mes_referencia: selectedMonth,
          }));
          await supabase.from('financeiro_contas_pagar').insert(dataToInsert);
        }
      }

      // Garantir que o mês selecionado tenha dados em contas a receber (mesma lógica do modal)
      const { data: existingContasReceber } = await supabase
        .from('financeiro_contas_receber')
        .select('id')
        .eq('mes_referencia', selectedMonth)
        .limit(1);

      if (!existingContasReceber || existingContasReceber.length === 0) {
        const { data: prevRecData } = await supabase
          .from('financeiro_contas_receber')
          .select('client_id, valor, status, produto_slug, is_recurring, inadimplencia_count')
          .eq('mes_referencia', previousMonth)
          .eq('is_recurring', true);

        if (prevRecData && prevRecData.length > 0) {
          const isCurrentOrPast = selectedMonth <= currentMonthStr;
          const dataToInsert = prevRecData.map(item => ({
            client_id: item.client_id,
            valor: item.valor,
            produto_slug: item.produto_slug,
            status: isCurrentOrPast ? (item.status === 'pago' ? 'pendente' : item.status) : 'pendente',
            mes_referencia: selectedMonth,
            is_recurring: true,
            inadimplencia_count: item.status !== 'pago' ? (item.inadimplencia_count || 0) + 1 : 0,
          }));
          await supabase.from('financeiro_contas_receber').insert(dataToInsert);
        }
      }

      // Datas de início/fim do mês selecionado para filtros
      const [selYear, selMonth] = selectedMonth.split('-').map(Number);
      const startOfSelectedMonth = new Date(selYear, selMonth - 1, 1);
      const endOfSelectedMonth = new Date(selYear, selMonth, 0, 23, 59, 59, 999);
      const startISO = startOfSelectedMonth.toISOString();
      const endISO = endOfSelectedMonth.toISOString();

      const [
        { data: contasPagar },
        { data: contasPagarLastMonth },
        { data: contasReceber },
        { data: contasReceberLastMonth },
        { data: allClients },
        { data: productValues },
        { data: dreData },
        { data: mrrChanges },
        { data: upsellsData },
      ] = await Promise.all([
        supabase.from('financeiro_contas_pagar').select('*').eq('mes_referencia', selectedMonth),
        supabase.from('financeiro_contas_pagar').select('*').eq('mes_referencia', previousMonth),
        supabase.from('financeiro_contas_receber').select('*').eq('mes_referencia', selectedMonth),
        supabase.from('financeiro_contas_receber').select('*').eq('mes_referencia', previousMonth),
        supabase.from('clients').select('id, name, status, archived, distrato_step, monthly_value, entry_date, contracted_products'),
        supabase.from('client_product_values').select('client_id, monthly_value, product_name, product_slug'),
        supabase.from('financeiro_dre').select('*').eq('mes_referencia', selectedMonth).maybeSingle(),
        supabase.from('mrr_changes').select('*').gte('effective_date', startOfSelectedMonth.toISOString().split('T')[0]).lte('effective_date', endOfSelectedMonth.toISOString().split('T')[0]),
        supabase.from('upsells').select('*').gte('created_at', startISO).lte('created_at', endISO).neq('status', 'cancelled'),
      ]);

      // Build product value map (sum all products per client)
      const productValueMap: Record<string, number> = {};
      productValues?.forEach((pv: any) => {
        productValueMap[pv.client_id] = (productValueMap[pv.client_id] || 0) + (Number(pv.monthly_value) || 0);
      });

      // Selected month boundaries for entry_date filter
      const monthEnd = endOfSelectedMonth;

      // Active clients = not archived, not churned, entered before or during selected month
      const activeClientsList = allClients?.filter(c => {
        if (c.archived) return false;
        if (c.status === 'churned') return false;
        if (c.distrato_step) return false;
        // Client must have entered on or before the selected month
        const entryDate = c.entry_date ? new Date(c.entry_date) : null;
        if (entryDate && entryDate > monthEnd) return false;
        return true;
      }) || [];

      const totalActiveClients = activeClientsList.length;
      const activeClientIds = new Set(activeClientsList.map(c => c.id));
      const totalMonthlyValue = activeClientsList.reduce((sum, c) => {
        // Use product values sum if available, otherwise client monthly_value
        const value = productValueMap[c.id] || Number(c.monthly_value) || 0;
        return sum + value;
      }, 0);

      // Faturamento por produto (apenas clientes ativos)
      const revenueByProduct: Record<string, { name: string; slug: string; total: number }> = {};
      const clientsWithProductValues = new Set<string>();
      productValues?.forEach((pv: any) => {
        if (!activeClientIds.has(pv.client_id)) return;
        clientsWithProductValues.add(pv.client_id);
        const slug = pv.product_slug || 'sem-produto';
        const name = pv.product_name || 'Sem produto';
        if (!revenueByProduct[slug]) {
          revenueByProduct[slug] = { name, slug, total: 0 };
        }
        revenueByProduct[slug].total += Number(pv.monthly_value) || 0;
      });
      // Clientes ativos sem product_values → categoria "Sem produto"
      let unclassifiedTotal = 0;
      activeClientsList.forEach(c => {
        if (!clientsWithProductValues.has(c.id)) {
          unclassifiedTotal += Number(c.monthly_value) || 0;
        }
      });
      if (unclassifiedTotal > 0) {
        if (!revenueByProduct['sem-produto']) {
          revenueByProduct['sem-produto'] = { name: 'Sem produto', slug: 'sem-produto', total: 0 };
        }
        revenueByProduct['sem-produto'].total += unclassifiedTotal;
      }
      // Ordenar por valor decrescente e filtrar zerados
      const faturamentoPorProduto = Object.values(revenueByProduct)
        .filter(p => p.total > 0)
        .sort((a, b) => b.total - a.total);

      // Clientes em distrato
      const distratoClients = allClients?.filter(c => c.distrato_step && !c.archived) || [];
      const distratoValue = distratoClients.reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0);

      // Contas a Receber
      const totalReceivable = contasReceber?.reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;
      const totalRecebido = contasReceber?.filter(c => c.status === 'pago').reduce((sum, c) => sum + (Number(c.valor) || 0), 0) || 0;
      const inadimplenteEntries = contasReceber?.filter(c => c.status === 'inadimplente') || [];
      const totalOverdue = inadimplenteEntries.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
      const overdueCount = inadimplenteEntries.length;
      // Contar clientes únicos inadimplentes no mês
      const uniqueOverdueClients = new Set(inadimplenteEntries.map(c => c.client_id).filter(Boolean));
      const overdueClientCount = uniqueOverdueClients.size;

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

      // ===== MRR EXPANSION & DEPRECIATION =====
      // IDs de clientes que entraram neste mês (novos) — excluídos de expansion
      const newClientIds = new Set(
        allClients?.filter(c => {
          const entryDate = c.entry_date ? new Date(c.entry_date) : null;
          return entryDate && entryDate >= startOfSelectedMonth && entryDate <= endOfSelectedMonth && !c.archived;
        }).map(c => c.id) || []
      );

      // Mudanças manuais de valor (mrr_changes) — apenas de clientes já existentes
      const manualExpansion = (mrrChanges || [])
        .filter((mc: any) => mc.change_type === 'expansion' && !newClientIds.has(mc.client_id))
        .reduce((sum: number, mc: any) => sum + Number(mc.change_value || 0), 0);

      const manualDepreciation = (mrrChanges || [])
        .filter((mc: any) => mc.change_type === 'depreciation' && !newClientIds.has(mc.client_id))
        .reduce((sum: number, mc: any) => sum + Number(mc.change_value || 0), 0);

      // Upsells (novos produtos para clientes existentes) — apenas clientes que NÃO são novos
      const upsellExpansion = (upsellsData || [])
        .filter((u: any) => !newClientIds.has(u.client_id))
        .reduce((sum: number, u: any) => sum + Number(u.monthly_value || 0), 0);

      const mrrExpansion = manualExpansion + upsellExpansion;
      const mrrDepreciation = manualDepreciation;

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
        overdueClientCount,

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

        // Por produto
        faturamentoPorProduto,

        // MRR Expansion & Depreciation
        mrrExpansion,
        mrrDepreciation,
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
                Dashboard Financeiro
              </h1>
              <p className="text-muted-foreground text-sm">
                Visão consolidada • {format(new Date(selectedMonth + '-15'), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[220px]">
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
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Tempo real
            </div>
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

        {/* Faturamento por Produto */}
        {dashboardData.faturamentoPorProduto.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <PieChart size={18} className="text-primary" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider">
                  Faturamento por Produto
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {dashboardData.faturamentoPorProduto.map((produto) => {
                  const percent = dashboardData.totalMonthlyValue > 0
                    ? (produto.total / dashboardData.totalMonthlyValue) * 100
                    : 0;
                  return (
                    <div
                      key={produto.slug}
                      className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
                    >
                      <p className="text-sm font-semibold text-foreground truncate mb-1">
                        {produto.name}
                      </p>
                      <p className="text-2xl font-bold text-success">
                        {formatCurrency(produto.total)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={percent} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
                {dashboardData.overdueClientCount} {dashboardData.overdueClientCount === 1 ? 'cliente' : 'clientes'} • {dashboardData.overdueCount} {dashboardData.overdueCount === 1 ? 'fatura' : 'faturas'}
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

        {/* MRR Expansion & Depreciation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MRR Expansion */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <ArrowUpRight size={16} className="text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">MRR Expansion</span>
                    <p className="text-[10px] text-muted-foreground">Aumento de receita recorrente em clientes ativos</p>
                  </div>
                </div>
              </div>
              <p className="text-3xl font-bold text-emerald-600">
                {formatCurrency(dashboardData.mrrExpansion)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Upsells + reajustes positivos no mês
              </p>
            </CardContent>
          </Card>

          {/* MRR Depreciation */}
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <ArrowDownRight size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">MRR Depreciation</span>
                    <p className="text-[10px] text-muted-foreground">Redução de receita recorrente em clientes ativos</p>
                  </div>
                </div>
              </div>
              <p className="text-3xl font-bold text-amber-600">
                {formatCurrency(dashboardData.mrrDepreciation)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Downgrades + reajustes negativos no mês
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
