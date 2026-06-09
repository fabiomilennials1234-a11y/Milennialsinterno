import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ConcessaoMotivo = Database['public']['Enums']['concessao_motivo'];
export type ConcessaoStatus = Database['public']['Enums']['concessao_status'];

// Deriva do schema (Row é a verdade; não duplicamos shape). Adiciona só o join
// embutido `client` (não existe na Row porque vem do select aninhado).
export type Concessao = Database['public']['Tables']['concessoes']['Row'] & {
  client?: { id: string; name: string } | null;
};

// Lê concessões. RLS (concessoes_select → cliente.pode_ver_cliente) escopa as
// linhas server-side: cada usuário só vê concessões de clientes que pode ver.
// Sem filtro de autorização client-side (a lei é a RLS, ADR 0005).
export function useConcessoes() {
  return useQuery({
    queryKey: ['concessoes'],
    queryFn: async (): Promise<Concessao[]> => {
      const { data, error } = await supabase
        .from('concessoes')
        .select('*, client:clients(id, name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Concessao[];
    },
  });
}

export interface ConcederProdutoInput {
  clientId: string;
  productSlug: string;
  motivo: ConcessaoMotivo;
  /** ISO date (YYYY-MM-DD) ou null. Opcional: data de revisão da concessão. */
  contractExpiresAt?: string | null;
}

// Escreve via RPC conceder_produto — ÚNICA porta de escrita da Concessão (ADR 0004
// contract-only; INSERT direto está revogado no schema). NUNCA from('concessoes').insert().
export function useConcederProduto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConcederProdutoInput): Promise<string> => {
      const { data, error } = await supabase.rpc('conceder_produto', {
        p_client_id: input.clientId,
        p_product_slug: input.productSlug,
        p_motivo: input.motivo,
        p_contract_expires_at: input.contractExpiresAt ?? undefined,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({ queryKey: ['concessoes'] });
      // Badges/produtos do Card Universal do cliente afetado (a entrega adiciona
      // o produto a contracted_products).
      queryClient.invalidateQueries({ queryKey: ['client-info', input.clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-sales'] });
    },
  });
}
