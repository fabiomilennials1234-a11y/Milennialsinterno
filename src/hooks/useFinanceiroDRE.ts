import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export interface DREData {
  id?: string;
  mes_referencia: string;
  
  // Receitas
  receita_bruta: number;
  deducoes_impostos: number;
  deducoes_descontos: number;
  outras_deducoes: number;
  
  // CMV
  cmv_produtos: number;
  cmv_servicos: number;
  outros_cmv: number;
  
  // Despesas Operacionais
  despesas_pessoal: number;
  despesas_administrativas: number;
  despesas_comerciais: number;
  despesas_marketing: number;
  despesas_ti: number;
  despesas_ocupacao: number;
  outras_despesas_operacionais: number;
  
  // Outras Receitas/Despesas
  receitas_financeiras: number;
  despesas_financeiras: number;
  outras_receitas: number;
  outras_despesas: number;
  
  // Impostos
  impostos_lucro: number;
  
  notas: string | null;
}

export interface DRECalculations {
  receitaLiquida: number;
  lucroBruto: number;
  totalDespesasOperacionais: number;
  ebitda: number;
  lucroLiquido: number;
  margemBruta: number;
  margemLiquida: number;
}

// Calcular métricas do DRE
export function calculateDRE(data: Partial<DREData>): DRECalculations {
  const receitaBruta = Number(data.receita_bruta) || 0;
  const totalDeducoes = (Number(data.deducoes_impostos) || 0) + 
                        (Number(data.deducoes_descontos) || 0) + 
                        (Number(data.outras_deducoes) || 0);
  const receitaLiquida = receitaBruta - totalDeducoes;
  
  const totalCMV = (Number(data.cmv_produtos) || 0) + 
                   (Number(data.cmv_servicos) || 0) + 
                   (Number(data.outros_cmv) || 0);
  const lucroBruto = receitaLiquida - totalCMV;
  
  const totalDespesasOperacionais = (Number(data.despesas_pessoal) || 0) +
                                     (Number(data.despesas_administrativas) || 0) +
                                     (Number(data.despesas_comerciais) || 0) +
                                     (Number(data.despesas_marketing) || 0) +
                                     (Number(data.despesas_ti) || 0) +
                                     (Number(data.despesas_ocupacao) || 0) +
                                     (Number(data.outras_despesas_operacionais) || 0);
  const ebitda = lucroBruto - totalDespesasOperacionais;
  
  const resultadoFinanceiro = (Number(data.receitas_financeiras) || 0) - (Number(data.despesas_financeiras) || 0);
  const outrosResultados = (Number(data.outras_receitas) || 0) - (Number(data.outras_despesas) || 0);
  const impostosLucro = Number(data.impostos_lucro) || 0;
  
  const lucroLiquido = ebitda + resultadoFinanceiro + outrosResultados - impostosLucro;
  
  const margemBruta = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
  const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;
  
  return {
    receitaLiquida,
    lucroBruto,
    totalDespesasOperacionais,
    ebitda,
    lucroLiquido,
    margemBruta,
    margemLiquida,
  };
}

export function useFinanceiroDRE(mesReferencia?: string) {
  const queryClient = useQueryClient();
  const currentMonth = mesReferencia || format(new Date(), 'yyyy-MM');

  // Fetch DRE data for the month
  const { data: dreData, isLoading } = useQuery({
    queryKey: ['financeiro-dre', currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_dre')
        .select('*')
        .eq('mes_referencia', currentMonth)
        .maybeSingle();

      if (error) throw error;
      return data as DREData | null;
    },
  });

  // Save/Update DRE
  const saveDRE = useMutation({
    mutationFn: async (data: Partial<DREData>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const payload = {
        ...data,
        mes_referencia: currentMonth,
        created_by: user.id,
      };

      if (dreData?.id) {
        // Update existing
        const { data: updated, error } = await supabase
          .from('financeiro_dre')
          .update(payload)
          .eq('id', dreData.id)
          .select()
          .single();

        if (error) throw error;
        return updated;
      } else {
        // Insert new
        const { data: inserted, error } = await supabase
          .from('financeiro_dre')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return inserted;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-dre', currentMonth] });
      toast.success('DRE salvo com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar DRE: ' + (error as Error).message);
    },
  });

  const calculations = calculateDRE(dreData || {});

  return {
    dreData,
    calculations,
    isLoading,
    saveDRE,
    currentMonth,
  };
}

// Produtos e Custos hooks
export interface Produto {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  cor: string;
  ativo: boolean;
  position: number;
}

export interface ProdutoDepartamento {
  id: string;
  produto_id: string;
  nome: string;
  descricao: string | null;
  position: number;
}

export interface CustoProduto {
  id?: string;
  mes_referencia: string;
  produto_id: string;
  departamento_id: string | null;
  custo_pessoal: number;
  custo_ferramentas: number;
  custo_terceiros: number;
  custo_marketing: number;
  outros_custos: number;
  descricao_outros: string | null;
  notas: string | null;
  produto?: Produto;
  departamento?: ProdutoDepartamento;
}

export interface ReceitaProduto {
  id?: string;
  mes_referencia: string;
  produto_id: string;
  receita_recorrente: number;
  receita_avulsa: number;
  outras_receitas: number;
  clientes_ativos: number;
  notas: string | null;
  produto?: Produto;
}

export interface MargemProduto {
  produto: Produto;
  receita: number;
  custos: number;
  margem: number;
  margemPercentual: number;
  clientesAtivos: number;
  margemPorCliente: number;
}

export function useFinanceiroProdutos() {
  return useQuery({
    queryKey: ['financeiro-produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_produtos')
        .select('*')
        .eq('ativo', true)
        .order('position');

      if (error) throw error;
      return data as Produto[];
    },
  });
}

export function useFinanceiroCustosProduto(mesReferencia?: string) {
  const queryClient = useQueryClient();
  const currentMonth = mesReferencia || format(new Date(), 'yyyy-MM');

  const { data: custos = [], isLoading } = useQuery({
    queryKey: ['financeiro-custos-produto', currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_custos_produto')
        .select(`
          *,
          produto:financeiro_produtos(*),
          departamento:financeiro_produto_departamentos(*)
        `)
        .eq('mes_referencia', currentMonth);

      if (error) throw error;
      return data as CustoProduto[];
    },
  });

  const saveCusto = useMutation({
    mutationFn: async (data: Partial<CustoProduto> & { produto_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const existingCusto = custos.find(c => 
        c.produto_id === data.produto_id && 
        c.departamento_id === (data.departamento_id || null)
      );

      const payload = {
        ...data,
        mes_referencia: currentMonth,
        created_by: user.id,
      };

      if (existingCusto?.id) {
        const { error } = await supabase
          .from('financeiro_custos_produto')
          .update(payload)
          .eq('id', existingCusto.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('financeiro_custos_produto')
          .insert(payload);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-custos-produto', currentMonth] });
      toast.success('Custos salvos!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar custos: ' + (error as Error).message);
    },
  });

  return { custos, isLoading, saveCusto, currentMonth };
}

export function useFinanceiroReceitaProduto(mesReferencia?: string) {
  const queryClient = useQueryClient();
  const currentMonth = mesReferencia || format(new Date(), 'yyyy-MM');

  const { data: receitas = [], isLoading } = useQuery({
    queryKey: ['financeiro-receita-produto', currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_receita_produto')
        .select(`
          *,
          produto:financeiro_produtos(*)
        `)
        .eq('mes_referencia', currentMonth);

      if (error) throw error;
      return data as ReceitaProduto[];
    },
  });

  const saveReceita = useMutation({
    mutationFn: async (data: Partial<ReceitaProduto> & { produto_id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const existingReceita = receitas.find(r => r.produto_id === data.produto_id);

      const payload = {
        ...data,
        mes_referencia: currentMonth,
        created_by: user.id,
      };

      if (existingReceita?.id) {
        const { error } = await supabase
          .from('financeiro_receita_produto')
          .update(payload)
          .eq('id', existingReceita.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('financeiro_receita_produto')
          .insert(payload);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro-receita-produto', currentMonth] });
      toast.success('Receita salva!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar receita: ' + (error as Error).message);
    },
  });

  return { receitas, isLoading, saveReceita, currentMonth };
}

// Hook para calcular margens por produto
export function useMargensProduto(mesReferencia?: string) {
  const currentMonth = mesReferencia || format(new Date(), 'yyyy-MM');
  const { data: produtos = [] } = useFinanceiroProdutos();
  const { custos } = useFinanceiroCustosProduto(currentMonth);
  const { receitas } = useFinanceiroReceitaProduto(currentMonth);

  const margens: MargemProduto[] = produtos.map(produto => {
    // Somar custos do produto
    const custosDoP = custos
      .filter(c => c.produto_id === produto.id)
      .reduce((sum, c) => sum + 
        (Number(c.custo_pessoal) || 0) + 
        (Number(c.custo_ferramentas) || 0) + 
        (Number(c.custo_terceiros) || 0) + 
        (Number(c.custo_marketing) || 0) + 
        (Number(c.outros_custos) || 0), 0);

    // Somar receitas do produto
    const receitaDoP = receitas.find(r => r.produto_id === produto.id);
    const totalReceita = receitaDoP 
      ? (Number(receitaDoP.receita_recorrente) || 0) + 
        (Number(receitaDoP.receita_avulsa) || 0) + 
        (Number(receitaDoP.outras_receitas) || 0)
      : 0;

    const clientesAtivos = receitaDoP?.clientes_ativos || 0;
    const margem = totalReceita - custosDoP;
    const margemPercentual = totalReceita > 0 ? (margem / totalReceita) * 100 : 0;
    const margemPorCliente = clientesAtivos > 0 ? margem / clientesAtivos : 0;

    return {
      produto,
      receita: totalReceita,
      custos: custosDoP,
      margem,
      margemPercentual,
      clientesAtivos,
      margemPorCliente,
    };
  });

  // Totais
  const totais = {
    receita: margens.reduce((sum, m) => sum + m.receita, 0),
    custos: margens.reduce((sum, m) => sum + m.custos, 0),
    margem: margens.reduce((sum, m) => sum + m.margem, 0),
    clientesAtivos: margens.reduce((sum, m) => sum + m.clientesAtivos, 0),
  };

  return { margens, totais, currentMonth };
}
