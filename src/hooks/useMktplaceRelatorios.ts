import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MktplaceRelatorio {
  id: string;
  client_id: string;
  consultor_id: string;
  report_type: 'consultoria' | 'gestao';
  titulo: string | null;
  resumo: string | null;
  acoes_realizadas: string | null;
  resultados: string | null;
  metricas_chave: string | null;
  pontos_melhoria: string | null;
  proximos_passos: string | null;
  observacoes: string | null;
  feedback_cliente: string | null;
  saude_contas: string | null;
  status_logistica: string | null;
  situacao_estoque: string | null;
  cycle_start_date: string;
  cycle_end_date: string;
  public_token: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMktplaceRelatorioInput {
  clientId: string;
  reportType: 'consultoria' | 'gestao';
  titulo: string;
  resumo: string;
  acoes_realizadas: string;
  resultados: string;
  metricas_chave: string;
  pontos_melhoria: string;
  proximos_passos: string;
  observacoes: string;
  feedback_cliente: string;
  // Gestao-only fields
  saude_contas?: string;
  status_logistica?: string;
  situacao_estoque?: string;
}

/** List reports for a client filtered by report_type */
export function useMktplaceRelatorios(clientId: string, reportType: 'consultoria' | 'gestao') {
  return useQuery({
    queryKey: ['mktplace-relatorios', clientId, reportType],
    queryFn: async (): Promise<MktplaceRelatorio[]> => {
      if (!clientId) return [];
      const { data, error } = await (supabase as any)
        .from('mktplace_relatorios')
        .select('*')
        .eq('client_id', clientId)
        .eq('report_type', reportType)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as MktplaceRelatorio[];
    },
    enabled: !!clientId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always' as const,
  });
}

/** Create a new MKT Place report */
export function useCreateMktplaceRelatorio() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateMktplaceRelatorioInput) => {
      if (!user?.id) throw new Error('Usuario nao autenticado');

      const cycleDays = input.reportType === 'gestao' ? 15 : 30;
      const now = new Date();
      const cycleEnd = new Date(now);
      cycleEnd.setDate(cycleEnd.getDate() + cycleDays);

      const { data, error } = await (supabase as any)
        .from('mktplace_relatorios')
        .insert({
          client_id: input.clientId,
          consultor_id: user.id,
          report_type: input.reportType,
          titulo: input.titulo,
          resumo: input.resumo,
          acoes_realizadas: input.acoes_realizadas,
          resultados: input.resultados,
          metricas_chave: input.metricas_chave,
          pontos_melhoria: input.pontos_melhoria,
          proximos_passos: input.proximos_passos,
          observacoes: input.observacoes,
          feedback_cliente: input.feedback_cliente,
          saude_contas: input.saude_contas || null,
          status_logistica: input.status_logistica || null,
          situacao_estoque: input.situacao_estoque || null,
          cycle_start_date: now.toISOString().split('T')[0],
          cycle_end_date: cycleEnd.toISOString().split('T')[0],
          is_published: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MktplaceRelatorio;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['mktplace-relatorios', input.clientId] });
      queryClient.invalidateQueries({ queryKey: ['latest-mktplace-relatorio', input.clientId] });
      toast.success('Relatorio MKT Place criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar relatorio', { description: error.message });
    },
  });
}

/** Delete a MKT Place report */
export function useDeleteMktplaceRelatorio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await (supabase as any)
        .from('mktplace_relatorios')
        .delete()
        .eq('id', id)
        .eq('client_id', clientId);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['mktplace-relatorios', clientId] });
      queryClient.invalidateQueries({ queryKey: ['latest-mktplace-relatorio', clientId] });
      toast.success('Relatorio removido');
    },
  });
}
