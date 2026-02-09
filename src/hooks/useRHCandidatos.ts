import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Candidate statuses for the nested Kanban inside each vacancy
export const CANDIDATO_STATUSES = [
  { id: 'aplicados', label: 'Aplicados (Currículos)', color: '#14b8a6' },
  { id: 'abordados', label: 'Abordados', color: '#22c55e' },
  { id: 'descartado', label: 'Descartado', color: '#ef4444' },
  { id: 'entrevista_marcada', label: 'Entrevista Marcada', color: '#f59e0b' },
  { id: 'entrevista_feita', label: 'Entrevista Feita', color: '#eab308' },
  { id: 'viaveis', label: 'Viáveis', color: '#22c55e' },
  { id: 'nao_viaveis', label: 'Não Viáveis', color: '#64748b' },
  { id: 'selecionados', label: 'Selecionados', color: '#0ea5e9' },
  { id: 'negociando', label: 'Negociando', color: '#06b6d4' },
  { id: 'futuro', label: 'Futuro', color: '#94a3b8' },
  { id: 'contratados', label: 'Contratados', color: '#10b981' },
] as const;

export type CandidatoStatus = typeof CANDIDATO_STATUSES[number]['id'];

export interface RHCandidato {
  id: string;
  vaga_id: string;
  nome: string;
  email?: string;
  telefone?: string;
  linkedin?: string;
  curriculo_url?: string;
  status: string;
  etapa_entrevista: number;
  notas?: string;
  avaliacao?: number;
  position: number;
  created_at: string;
  updated_at: string;
}

// Get status label
export function getCandidatoStatusLabel(status: string): string {
  const found = CANDIDATO_STATUSES.find(s => s.id === status);
  return found?.label || status;
}

// Get status color
export function getCandidatoStatusColor(status: string): string {
  const found = CANDIDATO_STATUSES.find(s => s.id === status);
  return found?.color || '#6366f1';
}

// Fetch all candidates for a specific vacancy
export function useRHCandidatos(vagaId: string) {
  return useQuery({
    queryKey: ['rh-candidatos', vagaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_candidatos')
        .select('*')
        .eq('vaga_id', vagaId)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return (data || []) as RHCandidato[];
    },
    enabled: !!vagaId,
  });
}

// Create a new candidate
export function useCreateCandidato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      vaga_id: string;
      nome: string;
      email?: string;
      telefone?: string;
      linkedin?: string;
      curriculo_url?: string;
      status?: string;
      notas?: string;
    }) => {
      const { data: candidato, error } = await supabase
        .from('rh_candidatos')
        .insert([{
          ...data,
          status: data.status || 'aplicados',
          etapa_entrevista: 0,
          position: 0,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return candidato as RHCandidato;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rh-candidatos', variables.vaga_id] });
    },
  });
}

// Update a candidate
export function useUpdateCandidato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, vaga_id, ...data }: Partial<RHCandidato> & { id: string; vaga_id: string }) => {
      const { data: candidato, error } = await supabase
        .from('rh_candidatos')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return candidato as RHCandidato;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rh-candidatos', variables.vaga_id] });
    },
  });
}

// Move a candidate to a new status
export function useMoveCandidato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, vaga_id, status, position }: { id: string; vaga_id: string; status: string; position?: number }) => {
      const { data: candidato, error } = await supabase
        .from('rh_candidatos')
        .update({ status, position: position ?? 0 })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return candidato as RHCandidato;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rh-candidatos', variables.vaga_id] });
    },
  });
}

// Delete a candidate
export function useDeleteCandidato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, vaga_id }: { id: string; vaga_id: string }) => {
      const { error } = await supabase
        .from('rh_candidatos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rh-candidatos', variables.vaga_id] });
    },
  });
}

// Get candidate counts by status for a vacancy
export function useCandidatoCounts(vagaId: string) {
  const { data: candidatos = [] } = useRHCandidatos(vagaId);
  
  const counts: Record<string, number> = {};
  CANDIDATO_STATUSES.forEach(status => {
    counts[status.id] = candidatos.filter(c => c.status === status.id).length;
  });
  
  return {
    counts,
    total: candidatos.length,
  };
}
