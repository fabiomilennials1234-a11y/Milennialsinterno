import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface DREAutomaticoData {
  // Receitas (vindas de contas a receber)
  receitaBruta: number;
  totalClientes: number;
  
  // Custos por categoria (vindas de contas a pagar)
  custoEquipe: number;
  custoCartao: number;
  custoEscritorio: number;
  custoExtras: number;
  custoInvestimento: number;
  custoFreelas: number;
  totalCustos: number;
  
  // CMV (Custo de Mercadoria/Serviço Vendido)
  cmvMercadoria: number;
  cmvServicos: number;
  cmvProdutos: number;
  totalCMV: number;
  
  // Custos por área
  custosPorArea: Record<string, number>;
  
  // Custos pagos vs pendentes
  custosPagos: number;
  custosPendentes: number;
  custosAtrasados: number;
  
  // Margem automática
  margemBruta: number;
  margemPercentual: number;
}

const AREAS = ['Financeiro', 'RH', 'Comercial', 'Operacional', 'Marketing interno'] as const;

export function useDREAutomatico(mesReferencia?: string) {
  const currentMonth = mesReferencia || format(new Date(), 'yyyy-MM');

  // Buscar receitas de contas a receber
  const { data: contasReceber = [] } = useQuery({
    queryKey: ['financeiro-contas-receber-dre', currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_contas_receber')
        .select('id, client_id, valor, status')
        .eq('mes_referencia', currentMonth);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar custos de contas a pagar
  const { data: contasPagar = [] } = useQuery({
    queryKey: ['financeiro-contas-pagar-dre', currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_contas_pagar')
        .select('id, fornecedor, valor, categoria, status, area')
        .eq('mes_referencia', currentMonth);
      if (error) throw error;
      return data || [];
    },
  });

  // Calcular totais de receita
  const receitaBruta = contasReceber.reduce((sum, c) => sum + Number(c.valor || 0), 0);
  const totalClientes = contasReceber.length;

  // Calcular custos por categoria
  const custosPorCategoria = contasPagar.reduce((acc, c) => {
    const categoria = c.categoria || 'Extras';
    if (!acc[categoria]) acc[categoria] = 0;
    acc[categoria] += Number(c.valor || 0);
    return acc;
  }, {} as Record<string, number>);

  // Calcular custos por área
  const custosPorArea = contasPagar.reduce((acc, c) => {
    const area = c.area || 'Não definido';
    if (!acc[area]) acc[area] = 0;
    acc[area] += Number(c.valor || 0);
    return acc;
  }, {} as Record<string, number>);

  // Garantir que todas as áreas existam no objeto (mesmo com valor 0)
  AREAS.forEach(area => {
    if (!custosPorArea[area]) custosPorArea[area] = 0;
  });

  // Calcular custos por status
  const custosPagos = contasPagar
    .filter(c => c.status === 'pago')
    .reduce((sum, c) => sum + Number(c.valor || 0), 0);
  const custosPendentes = contasPagar
    .filter(c => c.status === 'pendente')
    .reduce((sum, c) => sum + Number(c.valor || 0), 0);
  const custosAtrasados = contasPagar
    .filter(c => c.status === 'atrasado')
    .reduce((sum, c) => sum + Number(c.valor || 0), 0);

  // CMV - Custo de Mercadoria/Serviço Vendido
  const cmvMercadoria = custosPorCategoria['CMV Mercadoria'] || 0;
  const cmvServicos = custosPorCategoria['CMV Serviços'] || 0;
  const cmvProdutos = custosPorCategoria['CMV Produtos'] || 0;
  const totalCMV = cmvMercadoria + cmvServicos + cmvProdutos;

  // Total de custos operacionais (excluindo CMV para não duplicar)
  const totalCustosOperacionais = contasPagar
    .filter(c => !c.categoria?.startsWith('CMV'))
    .reduce((sum, c) => sum + Number(c.valor || 0), 0);

  const totalCustos = contasPagar.reduce((sum, c) => sum + Number(c.valor || 0), 0);

  // Margem (após CMV)
  const margemBruta = receitaBruta - totalCMV - totalCustosOperacionais;
  const margemPercentual = receitaBruta > 0 ? (margemBruta / receitaBruta) * 100 : 0;

  const dadosAutomaticos: DREAutomaticoData = {
    receitaBruta,
    totalClientes,
    
    custoEquipe: custosPorCategoria['Equipe'] || 0,
    custoCartao: custosPorCategoria['Cartão'] || 0,
    custoEscritorio: custosPorCategoria['Escritório'] || 0,
    custoExtras: custosPorCategoria['Extras'] || 0,
    custoInvestimento: custosPorCategoria['Investimento'] || 0,
    custoFreelas: custosPorCategoria['Freelas'] || 0,
    totalCustos,
    
    cmvMercadoria,
    cmvServicos,
    cmvProdutos,
    totalCMV,
    
    custosPorArea,
    
    custosPagos,
    custosPendentes,
    custosAtrasados,
    
    margemBruta,
    margemPercentual,
  };

  // Mapeamento para campos DRE
  const camposDRE = {
    receita_bruta: receitaBruta,
    // CMV
    cmv_produtos: cmvProdutos,
    cmv_servicos: cmvServicos,
    outros_cmv: cmvMercadoria,
    // Despesas Operacionais
    despesas_pessoal: (custosPorCategoria['Equipe'] || 0) + (custosPorCategoria['Freelas'] || 0),
    despesas_ti: custosPorCategoria['Cartão'] || 0,
    despesas_ocupacao: custosPorCategoria['Escritório'] || 0,
    despesas_administrativas: custosPorCategoria['Extras'] || 0,
    despesas_marketing: custosPorCategoria['Investimento'] || 0,
    // Por Área
    custos_financeiro: custosPorArea['Financeiro'] || 0,
    custos_rh: custosPorArea['RH'] || 0,
    custos_comercial: custosPorArea['Comercial'] || 0,
    custos_operacional: custosPorArea['Operacional'] || 0,
    custos_marketing_interno: custosPorArea['Marketing interno'] || 0,
  };

  return {
    dadosAutomaticos,
    camposDRE,
    currentMonth,
    isLoading: false,
  };
}
