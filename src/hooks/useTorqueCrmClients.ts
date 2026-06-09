import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getTorqueCrmProducts, type CrmProduto } from '@/hooks/useCrmKanban';

export interface TorqueCrmClient {
  id: string;
  name: string;
  razao_social: string | null;
  /** Sub-produtos Torque CRM válidos contratados (torque/automation/copilot). */
  produtos: CrmProduto[];
  /** Gestor de CRM atribuído (null => modal pede seleção inline). */
  assigned_crm: string | null;
}

/**
 * Lista os clientes ELEGÍVEIS a brifar um card de implantação: ativos,
 * com `torque-crm` em `contracted_products` E com ao menos um sub-produto
 * válido (torque/automation/copilot) em `torque_crm_products`.
 *
 * Fonte: PostgREST direto em `clients`. A leitura é escopada pela RLS
 * (`cliente.pode_ver_cliente`): quem opera o board do CRM (gestor_crm via
 * page-access 'gestor-crm', ou executivo) já enxerga todos os clientes por
 * essa policy — mesma audiência que JÁ pode escrever o card
 * (`_torque_board_pode_escrever`). Logo, ZERO porta nova de dados: o combobox
 * só lista o que o usuário já podia ler e escrever. Sem RPC nova.
 *
 * O filtro Torque CRM é aplicado client-side sobre a projeção mínima — a lista
 * de clientes ativos é pequena (dezenas) e o predicado é barato.
 */
export function useTorqueCrmClients(enabled = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['torque-crm-clients'],
    enabled: enabled && !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<TorqueCrmClient[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, razao_social, contracted_products, torque_crm_products, assigned_crm')
        .eq('archived', false)
        .order('name', { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        id: string;
        name: string;
        razao_social: string | null;
        contracted_products: string[] | null;
        torque_crm_products: string[] | null;
        assigned_crm: string | null;
      }>;

      return rows
        .filter(c => (c.contracted_products ?? []).includes('torque-crm'))
        .map(c => ({
          id: c.id,
          name: c.name,
          razao_social: c.razao_social,
          produtos: getTorqueCrmProducts(c),
          assigned_crm: c.assigned_crm,
        }))
        // Só clientes com sub-produto válido geram card (CONTEXT "Card de
        // implantação": não há brief fora do Torque CRM com tier).
        .filter(c => c.produtos.length > 0);
    },
  });
}
