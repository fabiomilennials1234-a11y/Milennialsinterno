import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useFinanceiroProdutos } from '@/hooks/useFinanceiroDRE';

export interface CustoPorProduto {
  produtoSlug: string;
  produtoNome: string;
  produtoCor: string;
  totalCustos: number;
  itens: {
    fornecedor: string;
    valor: number;
    categoria: string;
  }[];
}

export interface ReceitaPorProduto {
  produtoSlug: string;
  produtoNome: string;
  produtoCor: string;
  totalReceita: number;
  clientes: {
    clientId: string;
    clientName: string;
    valor: number;
  }[];
}

export interface MargemPorProdutoAuto {
  produtoSlug: string;
  produtoNome: string;
  produtoCor: string;
  totalReceita: number;
  totalCustos: number;
  margem: number;
  margemPercent: number;
  qtdClientes: number;
}

// Hook para calcular custos por produto automaticamente das contas a pagar
export function useCustosPorProduto(mesReferencia?: string) {
  const currentMonth = mesReferencia || format(new Date(), 'yyyy-MM');
  const { data: produtos = [] } = useFinanceiroProdutos();

  const { data: contasPagar = [] } = useQuery({
    queryKey: ['financeiro-contas-pagar', currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_contas_pagar')
        .select('*')
        .eq('mes_referencia', currentMonth);
      if (error) throw error;
      return data || [];
    },
  });

  // Agrupar custos por produto
  const custosPorProduto: CustoPorProduto[] = produtos.map(produto => {
    // Filtrar contas que têm esse produto vinculado
    const contasVinculadas = contasPagar.filter(conta => {
      const vinculados = (conta.produtos_vinculados as string[]) || [];
      return vinculados.includes(produto.slug);
    });

    // Calcular valor proporcional quando há múltiplos produtos
    const itens = contasVinculadas.map(conta => {
      const vinculados = (conta.produtos_vinculados as string[]) || [];
      const proporcao = vinculados.length > 0 ? 1 / vinculados.length : 1;
      return {
        fornecedor: conta.fornecedor,
        valor: Number(conta.valor) * proporcao,
        categoria: conta.categoria,
      };
    });

    const totalCustos = itens.reduce((sum, item) => sum + item.valor, 0);

    return {
      produtoSlug: produto.slug,
      produtoNome: produto.nome,
      produtoCor: produto.cor,
      totalCustos,
      itens,
    };
  });

  return { custosPorProduto, currentMonth };
}

// Hook para calcular receitas por produto automaticamente das contas a receber
export function useReceitasPorProduto(mesReferencia?: string) {
  const currentMonth = mesReferencia || format(new Date(), 'yyyy-MM');
  const { data: produtos = [] } = useFinanceiroProdutos();

  const { data: contasReceber = [] } = useQuery({
    queryKey: ['financeiro-contas-receber-com-produtos', currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_contas_receber')
        .select(`
          id,
          client_id,
          valor,
          produto_slug,
          client:clients(id, name, razao_social, contracted_products)
        `)
        .eq('mes_referencia', currentMonth);
      if (error) throw error;
      return data || [];
    },
  });

  // Agrupar receitas por produto
  const receitasPorProduto: ReceitaPorProduto[] = produtos.map(produto => {
    // Filtrar clientes que têm esse produto contratado
    const clientesComProduto = contasReceber.filter(conta => {
      const contratados = (conta.client?.contracted_products as string[]) || [];
      return contratados.includes(produto.slug);
    });

    // Calcular valor proporcional quando cliente tem múltiplos produtos
    const clientes = clientesComProduto.map(conta => {
      const contratados = (conta.client?.contracted_products as string[]) || [];
      const proporcao = contratados.length > 0 ? 1 / contratados.length : 1;
      return {
        clientId: conta.client_id,
        clientName: conta.client?.name || 'Cliente',
        valor: Number(conta.valor) * proporcao,
      };
    });

    const totalReceita = clientes.reduce((sum, c) => sum + c.valor, 0);

    return {
      produtoSlug: produto.slug,
      produtoNome: produto.nome,
      produtoCor: produto.cor,
      totalReceita,
      clientes,
    };
  });

  return { receitasPorProduto, currentMonth };
}

// Hook principal para calcular margem por produto automaticamente
export function useMargemPorProdutoAuto(mesReferencia?: string) {
  const currentMonth = mesReferencia || format(new Date(), 'yyyy-MM');
  const { custosPorProduto } = useCustosPorProduto(currentMonth);
  const { receitasPorProduto } = useReceitasPorProduto(currentMonth);

  const margens: MargemPorProdutoAuto[] = receitasPorProduto.map(receita => {
    const custos = custosPorProduto.find(c => c.produtoSlug === receita.produtoSlug);
    const totalCustos = custos?.totalCustos || 0;
    const margem = receita.totalReceita - totalCustos;
    const margemPercent = receita.totalReceita > 0 
      ? (margem / receita.totalReceita) * 100 
      : 0;

    return {
      produtoSlug: receita.produtoSlug,
      produtoNome: receita.produtoNome,
      produtoCor: receita.produtoCor,
      totalReceita: receita.totalReceita,
      totalCustos,
      margem,
      margemPercent,
      qtdClientes: receita.clientes.length,
    };
  });

  // Ordenar por margem (maior primeiro)
  const margensOrdenadas = margens.sort((a, b) => b.margem - a.margem);

  // Totais gerais
  const totais = {
    receita: margens.reduce((sum, m) => sum + m.totalReceita, 0),
    custos: margens.reduce((sum, m) => sum + m.totalCustos, 0),
    margem: margens.reduce((sum, m) => sum + m.margem, 0),
    clientes: margens.reduce((sum, m) => sum + m.qtdClientes, 0),
  };

  return { 
    margens: margensOrdenadas, 
    totais,
    currentMonth,
  };
}
