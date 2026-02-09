import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientCallForm {
  id: string;
  client_id: string;
  apresentacao: string | null;
  motivo_call: string | null;
  historia_empresa: string | null;
  produto_servico: string | null;
  lista_produtos: string | null;
  cliente_ideal: string | null;
  dor_desejo: string | null;
  historico_marketing: string | null;
  site: string | null;
  comercial_existente: string | null;
  expectativas_30d: string | null;
  expectativas_3m: string | null;
  expectativas_6m: string | null;
  expectativas_1a: string | null;
  proposito: string | null;
  referencias: string | null;
  localizacao: string | null;
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
        .select('id, name, niche, expected_investment, general_info, razao_social, cnpj')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      return data as ClientInfo;
    },
    enabled: !!clientId,
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
