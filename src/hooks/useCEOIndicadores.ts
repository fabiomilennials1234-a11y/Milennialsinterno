 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
 
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
   // Faturamento
   faturamentoMes: number;
   faturamentoPrevisto: number;
   faturamentoAno: number;
   faturamentoPorProduto: FaturamentoPorProduto[];
   
   // Caixa e Custos
   caixaHoje: number;
   custosPrevistosM: number;
   custosPagosM: number;
   
   // Crescimento
   crescimentoFaturamento: number;
   crescimentoFaturamentoPercent: number;
   crescimentoMRR: number;
   crescimentoMRRPercent: number;
   mrrInicial: number;
   mrrDepreciation: number;
   mrrExpansion: number;
   mrrVendido: number;
   
   // Vendas
   novosClientesMes: number;
   vendasMRRMes: number;
   vendasProjetoMes: number;
   vendasPorProdutoMRR: VendasPorProduto[];
   vendasPorProdutoProjeto: VendasPorProduto[];
   
   // Churn
   churnGeral: number;
   churnValor: number;
   
   // Métricas de Clientes
   clientesAtivos: number;
   ticketMedio: number;
   ltvMedio: number;
   roiClientes: number;
   
   // Inadimplência
   inadimplenciaValor: number;
   inadimplenciaTaxa: number;
   clientesEmRisco: number;
   
   // Histórico
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
 
 export function useCEOIndicadores() {
   const currentMonth = format(new Date(), 'yyyy-MM');
   const previousMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
   const currentYear = new Date().getFullYear();
 
   return useQuery({
     queryKey: ['ceo-indicadores', currentMonth],
     queryFn: async (): Promise<CEOIndicadores> => {
       const now = new Date();
       const startOfCurrentMonth = startOfMonth(now);
       const startOfPreviousMonth = startOfMonth(subMonths(now, 1));
       
       // Fetch all data in parallel
       const [
         { data: contasReceberCurrent },
         { data: contasReceberPrevious },
         { data: contasPagarCurrent },
         { data: contasPagarPrevious },
         { data: activeClients },
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
         supabase.from('financeiro_active_clients').select('*'),
         supabase.from('clients').select('*, client_onboarding(completed_at)'),
         supabase.from('client_product_values').select('*'),
         supabase.from('client_product_churns').select('*').eq('archived', false),
         supabase.from('client_product_churns').select('*'),
         supabase.from('financeiro_produtos').select('*').eq('ativo', true),
         supabase.from('upsells').select('*'),
         supabase.from('client_sales').select('*'),
       ]);
 
       // ===== FATURAMENTO MÊS (Recebido) =====
       const faturamentoMes = contasReceberCurrent
         ?.filter(c => c.status === 'pago')
         .reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;
 
       // ===== FATURAMENTO PREVISTO =====
       const totalRecebivelMes = activeClients?.reduce((sum, c) => sum + Number(c.monthly_value || 0), 0) || 0;
       const inadimplenciaValor = contasReceberCurrent
         ?.filter(c => c.status === 'atrasado')
         .reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;
       
       // Clientes em risco (em distrato)
       const clientesEmRisco = allClients?.filter(c => c.distrato_step && !c.archived).length || 0;
       const valorEmRisco = allClients
         ?.filter(c => c.distrato_step && !c.archived)
         .reduce((sum, c) => sum + Number(c.monthly_value || 0), 0) || 0;
       
       // Taxa de inadimplência
       const inadimplenciaTaxa = totalRecebivelMes > 0 
         ? (inadimplenciaValor / totalRecebivelMes) * 100 
         : 0;
       
       const faturamentoPrevisto = totalRecebivelMes - inadimplenciaValor - valorEmRisco;
 
       // ===== CAIXA HOJE =====
       // Caixa = Faturamento Recebido - Custos Pagos (simplificado)
       const custosPagosM = contasPagarCurrent
         ?.filter(c => c.status === 'pago')
         .reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;
       
       const caixaHoje = faturamentoMes - custosPagosM;
 
       // ===== CUSTOS =====
       const custosPrevistosM = contasPagarCurrent?.reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;
 
       // ===== FATURAMENTO POR PRODUTO =====
       const faturamentoPorProduto: FaturamentoPorProduto[] = [];
       const productValuesBySlug = new Map<string, { valor: number; clients: Set<string> }>();
       
       productValues?.forEach(pv => {
         const current = productValuesBySlug.get(pv.product_slug) || { valor: 0, clients: new Set<string>() };
         current.valor += Number(pv.monthly_value || 0);
         current.clients.add(pv.client_id);
         productValuesBySlug.set(pv.product_slug, current);
       });
       
       productValuesBySlug.forEach((data, slug) => {
         const produto = produtos?.find(p => p.slug === slug);
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
       const mrrAtual = totalRecebivelMes;
       const mrrAnterior = contasReceberPrevious?.reduce((sum, c) => sum + Number(c.valor || 0), 0) || 0;
       
       // MRR Vendido (novos clientes do mês)
       const novosClientesMes = allClients?.filter(c => {
         const createdAt = new Date(c.created_at);
         return createdAt >= startOfCurrentMonth && !c.archived;
       }).length || 0;
       
       const mrrVendido = allClients
         ?.filter(c => {
           const createdAt = new Date(c.created_at);
           return createdAt >= startOfCurrentMonth && !c.archived;
         })
         .reduce((sum, c) => sum + Number(c.monthly_value || 0), 0) || 0;
       
       // MRR Expansion (upsells do mês)
       const upsellsMes = upsells?.filter(u => {
         const createdAt = new Date(u.created_at);
         return createdAt >= startOfCurrentMonth && u.status !== 'cancelled';
       }) || [];
       
       const mrrExpansion = upsellsMes.reduce((sum, u) => sum + Number(u.monthly_value || 0), 0);
       
       // MRR Depreciation (churns do mês)
       const churnsMes = churns?.filter(c => {
         const enteredAt = new Date(c.distrato_entered_at);
         return enteredAt >= startOfCurrentMonth;
       }) || [];
       
       const mrrDepreciation = churnsMes.reduce((sum, c) => sum + Number(c.monthly_value || 0), 0);
       
       // MRR Inicial (MRR do mês anterior)
       const mrrInicial = mrrAnterior;
       
       // Crescimento MRR = MRR Inicial - Depreciation + Expansion + Vendido
       const crescimentoMRR = mrrVendido + mrrExpansion - mrrDepreciation;
       const crescimentoMRRPercent = mrrInicial > 0 
         ? (crescimentoMRR / mrrInicial) * 100 
         : 0;
 
       // ===== VENDAS MRR e PROJETO =====
       const vendasMRRMes = mrrVendido + mrrExpansion;
       
       // Vendas Projeto = vendas únicas (client_sales)
       const vendasProjetoMes = clientSales
         ?.filter(s => new Date(s.sale_date) >= startOfCurrentMonth)
         .reduce((sum, s) => sum + Number(s.sale_value || 0), 0) || 0;
 
       // ===== VENDAS POR PRODUTO =====
       const vendasPorProdutoMRR: VendasPorProduto[] = [];
       const vendasPorProdutoProjeto: VendasPorProduto[] = [];
       
       // Aggregate new clients by product
       const newClientIds = new Set(
         allClients
           ?.filter(c => new Date(c.created_at) >= startOfCurrentMonth && !c.archived)
           .map(c => c.id) || []
       );
       
       const newProductValues = productValues?.filter(pv => newClientIds.has(pv.client_id)) || [];
       const mrrByProduct = new Map<string, { valor: number; count: number }>();
       
       newProductValues.forEach(pv => {
         const current = mrrByProduct.get(pv.product_slug) || { valor: 0, count: 0 };
         current.valor += Number(pv.monthly_value || 0);
         current.count++;
         mrrByProduct.set(pv.product_slug, current);
       });
       
       mrrByProduct.forEach((data, slug) => {
         const produto = produtos?.find(p => p.slug === slug);
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
       const clientesAtivos = allClients?.filter(c => 
         !c.archived && c.status !== 'churned' && !c.distrato_step
       ).length || 0;
 
       // ===== TICKET MÉDIO =====
       const ticketMedio = clientesAtivos > 0 ? totalRecebivelMes / clientesAtivos : 0;
 
       // ===== LTV MÉDIO =====
       // LTV = Ticket Médio * Tempo Médio de Vida
       const completedClients = allClients?.filter(c => c.archived && c.created_at) || [];
       let avgLifetimeMonths = 12; // Default 12 meses
       
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
       // Buscar todos os meses do ano
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
       // ROI = (LTV - CAC) / CAC (simplificado como LTV/TicketMédio ratio)
       const roiClientes = ticketMedio > 0 ? (ltvMedio / ticketMedio) : 0;
 
       // ===== HISTÓRICO MENSAL (últimos 6 meses) =====
       const historicoMensal: CrescimentoMensal[] = [];
       
       for (let i = 5; i >= 0; i--) {
         const month = format(subMonths(now, i), 'yyyy-MM');
         const monthLabel = format(subMonths(now, i), 'MMM');
         
         const { data: monthReceber } = await supabase
           .from('financeiro_contas_receber')
           .select('valor, status')
           .eq('mes_referencia', month);
         
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