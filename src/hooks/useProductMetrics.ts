 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { format, subMonths, startOfMonth } from 'date-fns';
 
 export interface ProductMetrics {
   // MRR e Crescimento
   mrrAtivo: number;
   mrrInicial: number;
   mrrDepreciation: number;
   mrrExpansion: number;
   mrrVendido: number;
   crescimentoMRR: number;
   crescimentoMRRPercent: number;
   
   // Clientes
   clientesAtivos: number;
   novosClientesMes: number;
   clientesSairamMes: number;
   
   // Churn
   churnMes: number;
   churnValor: number;
   
   // Métricas
   ticketMedio: number;
   ltvMedio: number;
  tempoMedioVidaMeses: number;
   npsGeral: number;
   
   // Custos (apenas para Growth)
   custosProduto: number;
 }
 
 export function useProductMetrics(productSlug: string) {
   const currentMonth = format(new Date(), 'yyyy-MM');
   
   return useQuery({
     queryKey: ['product-metrics', productSlug, currentMonth],
     queryFn: async (): Promise<ProductMetrics> => {
       const now = new Date();
       const startOfCurrentMonth = startOfMonth(now);
       const startOfPreviousMonth = startOfMonth(subMonths(now, 1));
       const endOfPreviousMonth = startOfCurrentMonth;
       
       // Fetch all data in parallel
       const [
         { data: productValues },
         { data: productValuesLastMonth },
         { data: allClients },
         { data: churns },
         { data: upsells },
         { data: npsResponses },
         { data: contasPagar },
       ] = await Promise.all([
         // Current product values
         supabase
           .from('client_product_values')
           .select('*, clients!inner(id, archived, status, distrato_step, created_at)')
           .eq('product_slug', productSlug),
         // Previous month product values (for MRR inicial)
         supabase
           .from('client_product_values')
           .select('*, clients!inner(id, archived, created_at)')
           .eq('product_slug', productSlug),
         // All clients with this product
         supabase
           .from('clients')
           .select('id, name, created_at, archived, archived_at, status, distrato_step, contracted_products'),
         // Churns for this product
         supabase
           .from('client_product_churns')
           .select('*')
           .eq('product_slug', productSlug),
         // Upsells for this product
         supabase
           .from('upsells')
           .select('*')
           .eq('product_slug', productSlug),
         // NPS responses
         supabase
           .from('nps_responses')
           .select('nps_score'),
         // Costs that include this product
         supabase
           .from('financeiro_contas_pagar')
           .select('*')
           .eq('mes_referencia', currentMonth)
           .contains('produtos_vinculados', [productSlug]),
       ]);
       
       // Filter clients that have this product
       const clientsWithProduct = allClients?.filter(c => 
         c.contracted_products?.includes(productSlug)
       ) || [];
       
       // ===== MRR ATIVO =====
       const activeProductValues = productValues?.filter(pv => {
         const client = pv.clients as any;
         return client && !client.archived && client.status !== 'churned' && !client.distrato_step;
       }) || [];
       
       const mrrAtivo = activeProductValues.reduce((sum, pv) => sum + Number(pv.monthly_value || 0), 0);
       
       // ===== CLIENTES ATIVOS =====
       const clientesAtivos = activeProductValues.length;
       
       // ===== MRR INICIAL (mês anterior) =====
       const lastMonthValues = productValuesLastMonth?.filter(pv => {
         const client = pv.clients as any;
         const clientCreatedAt = client ? new Date(client.created_at) : new Date();
         return clientCreatedAt < startOfCurrentMonth;
       }) || [];
       
       const mrrInicial = lastMonthValues.reduce((sum, pv) => sum + Number(pv.monthly_value || 0), 0);
       
       // ===== NOVOS CLIENTES DO MÊS =====
       const newProductValues = productValues?.filter(pv => {
         const client = pv.clients as any;
         if (!client) return false;
         const createdAt = new Date(client.created_at);
         return createdAt >= startOfCurrentMonth && !client.archived;
       }) || [];
       
       const novosClientesMes = newProductValues.length;
       const mrrVendido = newProductValues.reduce((sum, pv) => sum + Number(pv.monthly_value || 0), 0);
       
       // ===== MRR EXPANSION (upsells do mês) =====
       const upsellsMes = upsells?.filter(u => {
         const createdAt = new Date(u.created_at);
         return createdAt >= startOfCurrentMonth && u.status !== 'cancelled';
       }) || [];
       
       const mrrExpansion = upsellsMes.reduce((sum, u) => sum + Number(u.monthly_value || 0), 0);
       
       // ===== CHURNS DO MÊS =====
       const churnsMes = churns?.filter(c => {
         const enteredAt = new Date(c.distrato_entered_at);
         return enteredAt >= startOfCurrentMonth && !c.archived;
       }) || [];
       
       const clientesSairamMes = churnsMes.length;
       const mrrDepreciation = churnsMes.reduce((sum, c) => sum + Number(c.monthly_value || 0), 0);
       
       // ===== CRESCIMENTO MRR =====
       const crescimentoMRR = mrrVendido + mrrExpansion - mrrDepreciation;
       const crescimentoMRRPercent = mrrInicial > 0 
         ? (crescimentoMRR / mrrInicial) * 100 
         : (crescimentoMRR > 0 ? 100 : 0);
       
       // ===== CHURN =====
       const churnMes = clientesSairamMes;
       const churnValor = mrrDepreciation;
       
       // ===== TICKET MÉDIO =====
       const ticketMedio = clientesAtivos > 0 ? mrrAtivo / clientesAtivos : 0;
       
       // ===== LTV MÉDIO =====
      // Calcular tempo médio de TODOS os clientes (ativos e churned)
      const allClientsWithDates = clientsWithProduct.filter(c => c.created_at);
      let avgLifetimeMonths = 0;
       
      if (allClientsWithDates.length > 0) {
        const lifetimes = allClientsWithDates.map(c => {
           const created = new Date(c.created_at);
          // Para clientes ativos: até hoje. Para arquivados: até a data de arquivamento
          const endDate = c.archived && c.archived_at ? new Date(c.archived_at) : now;
          const diffMs = endDate.getTime() - created.getTime();
          const months = diffMs / (1000 * 60 * 60 * 24 * 30);
          return Math.max(0.1, months); // Mínimo 0.1 para não zerar
         });
         avgLifetimeMonths = Math.round(lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length);
      } else {
        avgLifetimeMonths = 0;
       }
       
       const ltvMedio = ticketMedio * avgLifetimeMonths;
      const tempoMedioVidaMeses = avgLifetimeMonths;
       
       // ===== NPS GERAL =====
       const npsScores = npsResponses?.map(r => r.nps_score) || [];
       let npsGeral = 0;
       
       if (npsScores.length > 0) {
         const promoters = npsScores.filter(s => s >= 9).length;
         const detractors = npsScores.filter(s => s <= 6).length;
         npsGeral = Math.round(((promoters - detractors) / npsScores.length) * 100);
       }
       
       // ===== CUSTOS DO PRODUTO =====
       // Custos são rateados entre os produtos vinculados
       let custosProduto = 0;
       
       contasPagar?.forEach(conta => {
         const productSlugs = (conta.produtos_vinculados as string[]) || [];
         if (productSlugs.length > 0 && productSlugs.includes(productSlug)) {
           custosProduto += Number(conta.valor || 0) / productSlugs.length;
         }
       });
       
       return {
         mrrAtivo,
         mrrInicial,
         mrrDepreciation,
         mrrExpansion,
         mrrVendido,
         crescimentoMRR,
         crescimentoMRRPercent,
         clientesAtivos,
         novosClientesMes,
         clientesSairamMes,
         churnMes,
         churnValor,
         ticketMedio,
         ltvMedio,
        tempoMedioVidaMeses,
         npsGeral,
         custosProduto,
       };
     },
     staleTime: 60000,
     refetchInterval: 120000,
   });
 }