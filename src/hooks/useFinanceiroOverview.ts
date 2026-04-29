import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FinanceiroOverview {
  month: string;
  contasReceber: {
    total: number;
    recebidos: number;
    pendentes: number;
    inadimplentes: number;
  };
  contasPagar: {
    total: number;
    pagas: number;
    pendentes: number;
  };
  mrr: {
    expansion: number;
    depreciation: number;
  };
  contratosExpirando: number;
  distratos: number;
}

type RpcError = { message: string };
type RpcClient = {
  rpc: <T>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

export function useFinanceiroOverview() {
  return useQuery({
    queryKey: ['financeiro-overview'],
    queryFn: async (): Promise<FinanceiroOverview> => {
      const { data, error } = await rpcClient.rpc<FinanceiroOverview>('get_financeiro_overview');
      if (error) throw error;
      if (!data) throw new Error('RPC get_financeiro_overview retornou vazio');
      return data;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60 * 1000,
  });
}
