import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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

type RpcError = { message: string };
type RpcClient = {
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

const toNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeIndicadores = (raw: Partial<CEOIndicadores> | null | undefined): CEOIndicadores => ({
  faturamentoMes: toNumber(raw?.faturamentoMes),
  faturamentoPrevisto: toNumber(raw?.faturamentoPrevisto),
  faturamentoAno: toNumber(raw?.faturamentoAno),
  faturamentoPorProduto: Array.isArray(raw?.faturamentoPorProduto) ? raw.faturamentoPorProduto : [],
  caixaHoje: toNumber(raw?.caixaHoje),
  custosPrevistosM: toNumber(raw?.custosPrevistosM),
  custosPagosM: toNumber(raw?.custosPagosM),
  crescimentoFaturamento: toNumber(raw?.crescimentoFaturamento),
  crescimentoFaturamentoPercent: toNumber(raw?.crescimentoFaturamentoPercent),
  crescimentoMRR: toNumber(raw?.crescimentoMRR),
  crescimentoMRRPercent: toNumber(raw?.crescimentoMRRPercent),
  mrrInicial: toNumber(raw?.mrrInicial),
  mrrDepreciation: toNumber(raw?.mrrDepreciation),
  mrrExpansion: toNumber(raw?.mrrExpansion),
  mrrVendido: toNumber(raw?.mrrVendido),
  novosClientesMes: toNumber(raw?.novosClientesMes),
  vendasMRRMes: toNumber(raw?.vendasMRRMes),
  vendasProjetoMes: toNumber(raw?.vendasProjetoMes),
  vendasPorProdutoMRR: Array.isArray(raw?.vendasPorProdutoMRR) ? raw.vendasPorProdutoMRR : [],
  vendasPorProdutoProjeto: Array.isArray(raw?.vendasPorProdutoProjeto) ? raw.vendasPorProdutoProjeto : [],
  churnGeral: toNumber(raw?.churnGeral),
  churnValor: toNumber(raw?.churnValor),
  clientesAtivos: toNumber(raw?.clientesAtivos),
  ticketMedio: toNumber(raw?.ticketMedio),
  ltvMedio: toNumber(raw?.ltvMedio),
  roiClientes: toNumber(raw?.roiClientes),
  inadimplenciaValor: toNumber(raw?.inadimplenciaValor),
  inadimplenciaTaxa: toNumber(raw?.inadimplenciaTaxa),
  clientesEmRisco: toNumber(raw?.clientesEmRisco),
  historicoMensal: Array.isArray(raw?.historicoMensal) ? raw.historicoMensal : [],
});

export function useCEOIndicadores(selectedMonth?: string) {
  const currentMonth = selectedMonth || format(new Date(), 'yyyy-MM');

  return useQuery({
    queryKey: ['ceo-indicadores', currentMonth],
    queryFn: async (): Promise<CEOIndicadores> => {
      const { data, error } = await rpcClient.rpc<Partial<CEOIndicadores>>('get_ceo_indicadores', {
        _month: currentMonth,
      });

      if (error) throw error;
      return normalizeIndicadores(data);
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
