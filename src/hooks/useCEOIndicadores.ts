import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';

export interface FaturamentoPorProduto {
  productSlug: string;
  productName: string;
  valor: number;
  clientCount: number;
  color: string;
}

export interface VendasPorProduto {
  productSlug: string;
  productName: string;
  valorMRR: number;
  valorProjeto: number;
  count: number;
}

export interface CrescimentoMensal {
  mes: string;
  faturamento: number;
  mrr: number;
}

export interface CEOIndicadores {
  faturamentoMes: number;
  faturamentoPrevisto: number;
  faturamentoAno: number;
  faturamentoPorProduto: FaturamentoPorProduto[];
  caixaHoje: number;
  custosPrevistosM: number;
  custosPagosM: number;
  crescimentoFaturamento: number;
  crescimentoFaturamentoPercent: number;
  crescimentoMRR: number;
  crescimentoMRRPercent: number;
  mrrInicial: number;
  mrrDepreciation: number;
  mrrExpansion: number;
  mrrVendido: number;
  novosClientesMes: number;
  vendasMRRMes: number;
  vendasProjetoMes: number;
  vendasPorProdutoMRR: VendasPorProduto[];
  vendasPorProdutoProjeto: VendasPorProduto[];
  churnGeral: number;
  churnValor: number;
  clientesAtivos: number;
  ticketMedio: number;
  ltvMedio: number;
  roiClientes: number;
  inadimplenciaValor: number;
  inadimplenciaTaxa: number;
  clientesEmRisco: number;
  historicoMensal: CrescimentoMensal[];
}

const PRODUCT_COLORS: Record<string, string> = {
  'millennials-growth': '#6366f1',
  'millennials-criativa': '#8b5cf6',
  'millennials-sites': '#06b6d4',
  'millennials-rh': '#f59e0b',
  'millennials-b2b': '#10b981',
  'default': '#94a3b8',
};

export function useCEOIndicadores(selectedMonth?: string) {
  const currentMonth = selectedMonth || format(new Date(), 'yyyy-MM');
  const [selYear, selMon] = currentMonth.split('-').map(Number);
  const previousMonth = format(new Date(selYear, selMon - 2, 1), 'yyyy-MM');
  const currentYear = selYear;

  return useQuery({
    queryKey: ['ceo-indicadores', currentMonth],
    queryFn: async (): Promise<CEOIndicadores> => {
      const now = new Date();
      const monthEnd = new Date(selYear, selMon, 0, 23, 59, 59, 999);
      const startOfCurrentMonth = new Date(selYear, selMon - 1, 1);

      const [
        { data: contasReceberCurrent },
        { data: contasReceberPrevious },
        { data: contasPagarCurrent },
        { data: contasPagarPrevious },
        { data: allClients },
        { data: productValues },
        { data: churns },
        { data: churnsHistorico },
        { data: produtos },
        { data: upsells },
        { data: clientSales },
      ] = await Promise.all([
        supabase.from('financeiro_contas_receber').select('*').eq('mes_referencia', currentMonth),
        supabase.from('financeiro_contas_receber').select('*').eq('mes_referencia', previousMonth),
        supabase.from('financeiro_contas_pagar').select('*').eq('mes_referencia', currentMonth),
        supabase.from('financeiro_contas_pagar').select('*').eq('mes_referencia', previousMonth),
        supabase.from('clients').select('*, client_onboarding(completed_at)'),
        supabase.from('client_product_values').select('*'),
        supabase.from('client_product_churns').select('*').eq('archived', false),
        supabase.from('client_product_churns').select('*'),
        supabase.from('financeiro_produtos').select('*').eq('ativo', true),
        supabase.from('upsells').select('*'),
        supabase.from('client_sales').select('*'),
      ]);

      // ===== ACTIVE CLIENTS (real, from clients table) =====
      const activeClientsList = allClients?.filter(c => {
        if (c.archived) return false;
        if (c.status === 'churned') return false;
        if (c.distrato_step) return false;
        const entryDate = c.entry_date ? new Date(c.entry_date) : null;
        if (entryDate && entryDate > monthEnd) return false;
        return true;
      }) || [];

      // Build product value map (sum per client)
      const pvMap: Record<string, number> = {};
      productValues?.forEach((pv: any) => {
        pvMap[pv.client_id] = (pvMap[pv.client_id] || 0) + Number(pv.monthly_value || 0);
      });

      const totalRecebivelMes = activeClientsList.reduce((sum, c) => {
        return sum + (pvMap[c.id] || Number(c.monthly_value) || 0);
      }, 0);

      // ===== FATURAMENTO MÊS (Recebido) =====
      const faturamentoMes = contasReceberCurrent
        ?.filter(c => c.status === 'pago')
        .reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;

      // ===== FATURAMENTO PREVISTO =====
      const inadimplenciaValor = contasReceberCurrent
        ?.filter(c => c.status === 'atrasado')
        .reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;

      const clientesEmRisco = allClients?.filter(c => c.distrato_step && !c.archived).length || 0;
      const valorEmRisco = allClients
        ?.filter(c => c.distrato_step && !c.archived)
        .reduce((sum, c) => sum + Number(c.monthly_value || 0), 0) || 0;

      const inadimplenciaTaxa = totalRecebivelMes > 0
        ? (inadimplenciaValor / totalRecebivelMes) * 100
        : 0;

      const faturamentoPrevisto = totalRecebivelMes;

      // ===== CAIXA HOJE =====
      const custosPagosM = contasPagarCurrent
        ?.filter(c => c.status === 'pago')
        .reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;

      const caixaHoje = faturamentoMes - custosPagosM;

      // ===== CUSTOS =====
      const custosPrevistosM = contasPagarCurrent?.reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;

      // ===== FATURAMENTO POR PRODUTO =====
      const faturamentoPorProduto: FaturamentoPorProduto[] = [];
      const productValuesBySlug = new Map<string, { valor: number; clients: Set<string> }>();

      // Only count product values for active clients
      const activeIds = new Set(activeClientsList.map(c => c.id));
      productValues?.forEach((pv: any) => {
        if (!activeIds.has(pv.client_id)) return;
        const current = productValuesBySlug.get(pv.product_slug) || { valor: 0, clients: new Set<string>() };
        current.valor += Number(pv.monthly_value || 0);
        current.clients.add(pv.client_id);
        productValuesBySlug.set(pv.product_slug, current);
      });

      productValuesBySlug.forEach((data, slug) => {
        const produto = produtos?.find((p: any) => p.slug === slug);
        faturamentoPorProduto.push({
          productSlug: slug,
          productName: produto?.nome || slug,
          valor: data.valor,
          clientCount: data.clients.size,
          color: PRODUCT_COLORS[slug] || PRODUCT_COLORS.default,
        });
      });

      faturamentoPorProduto.sort((a, b) => b.valor - a.valor);

      // ===== CRESCIMENTO MENSAL | FATURAMENTO =====
      const faturamentoMesAnterior = contasReceberPrevious
        ?.filter(c => c.status === 'pago')
        .reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;

      const crescimentoFaturamento = faturamentoMes - faturamentoMesAnterior;
      const crescimentoFaturamentoPercent = faturamentoMesAnterior > 0
        ? (crescimentoFaturamento / faturamentoMesAnterior) * 100
        : 0;

      // ===== MRR CALCULATION =====
      const mrrAnterior = contasReceberPrevious?.reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;

      const novosClientesMes = allClients?.filter(c => {
        const entryDate = c.entry_date ? new Date(c.entry_date) : new Date(c.created_at);
        return entryDate >= startOfCurrentMonth && entryDate <= monthEnd && !c.archived;
      }).length || 0;

      const mrrVendido = allClients
        ?.filter(c => {
          const entryDate = c.entry_date ? new Date(c.entry_date) : new Date(c.created_at);
          return entryDate >= startOfCurrentMonth && entryDate <= monthEnd && !c.archived;
        })
        .reduce((sum, c) => sum + (pvMap[c.id] || Number(c.monthly_value) || 0), 0) || 0;

      const upsellsMes = upsells?.filter(u => {
        const createdAt = new Date(u.created_at);
        return createdAt >= startOfCurrentMonth && createdAt <= monthEnd && u.status !== 'cancelled';
      }) || [];

      const mrrExpansion = upsellsMes.reduce((sum, u) => sum + Number(u.monthly_value || 0), 0);

      const churnsMes = churns?.filter(c => {
        const enteredAt = new Date(c.distrato_entered_at);
        return enteredAt >= startOfCurrentMonth && enteredAt <= monthEnd;
      }) || [];

      const mrrDepreciation = churnsMes.reduce((sum, c) => sum + Number(c.monthly_value || 0), 0);

      const mrrInicial = mrrAnterior;

      const crescimentoMRR = mrrVendido + mrrExpansion - mrrDepreciation;
      const crescimentoMRRPercent = mrrInicial > 0
        ? (crescimentoMRR / mrrInicial) * 100
        : 0;

      // ===== VENDAS MRR e PROJETO =====
      const vendasMRRMes = mrrVendido + mrrExpansion;

      const vendasProjetoMes = clientSales
        ?.filter(s => {
          const d = new Date(s.sale_date);
          return d >= startOfCurrentMonth && d <= monthEnd;
        })
        .reduce((sum, s) => sum + Number(s.sale_value || 0), 0) || 0;

      // ===== VENDAS POR PRODUTO =====
      const vendasPorProdutoMRR: VendasPorProduto[] = [];
      const vendasPorProdutoProjeto: VendasPorProduto[] = [];

      const newClientIds = new Set(
        allClients
          ?.filter(c => {
            const entryDate = c.entry_date ? new Date(c.entry_date) : new Date(c.created_at);
            return entryDate >= startOfCurrentMonth && entryDate <= monthEnd && !c.archived;
          })
          .map(c => c.id) || []
      );

      const newProductValues = productValues?.filter((pv: any) => newClientIds.has(pv.client_id)) || [];
      const mrrByProduct = new Map<string, { valor: number; count: number }>();

      newProductValues.forEach((pv: any) => {
        const current = mrrByProduct.get(pv.product_slug) || { valor: 0, count: 0 };
        current.valor += Number(pv.monthly_value || 0);
        current.count++;
        mrrByProduct.set(pv.product_slug, current);
      });

      mrrByProduct.forEach((data, slug) => {
        const produto = produtos?.find((p: any) => p.slug === slug);
        vendasPorProdutoMRR.push({
          productSlug: slug,
          productName: produto?.nome || slug,
          valorMRR: data.valor,
          valorProjeto: 0,
          count: data.count,
        });
      });

      vendasPorProdutoMRR.sort((a, b) => b.valorMRR - a.valorMRR);

      // ===== CHURN =====
      const churnGeral = churnsMes.length;
      const churnValor = mrrDepreciation;

      // ===== CLIENTES ATIVOS =====
      const clientesAtivos = activeClientsList.length;

      // ===== TICKET MÉDIO =====
      const ticketMedio = clientesAtivos > 0 ? totalRecebivelMes / clientesAtivos : 0;

      // ===== LTV MÉDIO =====
      const completedClients = allClients?.filter(c => c.archived && c.created_at) || [];
      let avgLifetimeMonths = 12;

      if (completedClients.length > 0) {
        const lifetimes = completedClients.map(c => {
          const created = new Date(c.created_at);
          const archived = c.archived_at ? new Date(c.archived_at) : now;
          return Math.max(1, Math.round((archived.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        });
        avgLifetimeMonths = Math.round(lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length);
      }

      const ltvMedio = ticketMedio * avgLifetimeMonths;

      // ===== FATURAMENTO ANO =====
      const monthsOfYear = Array.from({ length: 12 }, (_, i) =>
        format(new Date(currentYear, i, 1), 'yyyy-MM')
      );

      const { data: contasReceberAno } = await supabase
        .from('financeiro_contas_receber')
        .select('valor, status')
        .in('mes_referencia', monthsOfYear);

      const faturamentoAno = contasReceberAno
        ?.filter(c => c.status === 'pago')
        .reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;

      // ===== ROI CLIENTES =====
      const roiClientes = ticketMedio > 0 ? (ltvMedio / ticketMedio) : 0;

      // ===== HISTÓRICO MENSAL (últimos 6 meses) =====
      const historicoMensal: CrescimentoMensal[] = [];
      const refDate = new Date(selYear, selMon - 1, 15);

      for (let i = 5; i >= 0; i--) {
        const m = format(subMonths(refDate, i), 'yyyy-MM');
        const monthLabel = format(subMonths(refDate, i), 'MMM');

        const { data: monthReceber } = await supabase
          .from('financeiro_contas_receber')
          .select('valor, status')
          .eq('mes_referencia', m);

        const monthFaturamento = monthReceber
          ?.filter(c => c.status === 'pago')
          .reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;

        const monthMRR = monthReceber?.reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;

        historicoMensal.push({
          mes: monthLabel,
          faturamento: monthFaturamento,
          mrr: monthMRR,
        });
      }

      return {
        faturamentoMes,
        faturamentoPrevisto,
        faturamentoAno,
        faturamentoPorProduto,
        caixaHoje,
        custosPrevistosM,
        custosPagosM,
        crescimentoFaturamento,
        crescimentoFaturamentoPercent,
        crescimentoMRR,
        crescimentoMRRPercent,
        mrrInicial,
        mrrDepreciation,
        mrrExpansion,
        mrrVendido,
        novosClientesMes,
        vendasMRRMes,
        vendasProjetoMes,
        vendasPorProdutoMRR,
        vendasPorProdutoProjeto,
        churnGeral,
        churnValor,
        clientesAtivos,
        ticketMedio,
        ltvMedio,
        roiClientes,
        inadimplenciaValor,
        inadimplenciaTaxa,
        clientesEmRisco,
        historicoMensal,
      };
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
