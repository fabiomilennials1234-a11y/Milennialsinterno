import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientCallForm {
  id: string;
  client_id: string;
  apresentacao: string | null;
  motivo_call: string | null;
  // Bloco 1 — Empresa, Produto e Margem
  historia_empresa: string | null;
  produto_servico: string | null;
  principais_produtos_margem: string | null;
  produto_carro_chefe: string | null;
  ticket_medio: string | null;
  margem_media: string | null;
  pedido_minimo: string | null;
  condicao_distribuidor_representante: string | null;
  lista_produtos: string | null;
  // Bloco 2 — Cliente Ideal e Mercado
  cliente_ideal: string | null;
  decisor_compra_cliente: string | null;
  dor_desejo: string | null;
  diferencial_vs_concorrencia: string | null;
  maior_dor_empresa: string | null;
  concorrente_direto_n1: string | null;
  feiras_eventos_setor: string | null;
  // Bloco 3 — Comercial e Operação
  comercial_existente: string | null;
  representantes_comerciais_atual: string | null;
  captar_novos_representantes: string | null;
  tempo_ciclo_venda: string | null;
  tempo_resposta_lead: string | null;
  origem_clientes_atuais: string | null;
  recompra_frequencia: string | null;
  programa_indicacao: string | null;
  cnpjs_ativos: string | null;
  // Bloco 4 — Marketing e Presença Digital
  historico_marketing: string | null;
  site: string | null;
  catalogo_fotos_videos: string | null;
  restricoes_comunicacao: string | null;
  // Bloco 5 — Marketplace
  vende_marketplaces: string | null;
  marketplaces_ativos: string | null;
  faturamento_marketplaces: string | null;
  // Bloco 6 — Foco, Objetivo e Expectativa
  foco_principal_empresa: string | null;
  objetivo_contratar_milennials: string | null;
  satisfacao_3_meses: string | null;
  expectativas_30d: string | null;
  expectativas_3m: string | null;
  expectativas_6m: string | null;
  expectativas_1a: string | null;
  // Bloco 7 — Projeto e Execução
  proposito: string | null;
  referencias: string | null;
  localizacao: string | null;
  ponto_focal_cliente: string | null;
  acoes_pontuais: string | null;
  investimento: string | null;
  strategy_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInfo {
  id: string;
  name: string;
  niche: string | null;
  expected_investment: number | null;
  general_info: string | null;
  razao_social: string | null;
  cnpj: string | null;
  contracted_products: string[] | null;
  assigned_ads_manager: string | null;
  assigned_comercial: string | null;
  assigned_mktplace: string | null;
  created_at?: string;
}

export function useClientCallForm(clientId: string) {
  return useQuery({
    queryKey: ['client-call-form', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_call_forms')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error) throw error;
      return data as ClientCallForm | null;
    },
    enabled: !!clientId,
  });
}

export function useClientInfo(clientId: string) {
  return useQuery({
    queryKey: ['client-info', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, niche, expected_investment, general_info, razao_social, cnpj, contracted_products, assigned_ads_manager, assigned_comercial, assigned_mktplace, created_at')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data as ClientInfo;
    },
    enabled: !!clientId,
  });
}

export function useUpdateClientInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: string; data: { niche?: string; expected_investment?: number | null; cnpj?: string; general_info?: string } }) => {
      const { error } = await supabase
        .from('clients')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-info', variables.clientId] });
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar informações do cliente', { description: error.message });
    },
  });
}

export function useSaveClientCallForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: string; data: Partial<ClientCallForm> }) => {
      // Check if form already exists
      const { data: existing } = await supabase
        .from('client_call_forms')
        .select('id')
        .eq('client_id', clientId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('client_call_forms')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('client_id', clientId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('client_call_forms')
          .insert({
            client_id: clientId,
            ...data,
          } as any);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-call-form', variables.clientId] });
      toast.success('Informações salvas com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar informações', { description: error.message });
    },
  });
}
