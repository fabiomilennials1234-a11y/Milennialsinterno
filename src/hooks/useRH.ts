import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface RHVaga {
  id: string;
  title: string;
  description?: string;
  column_id?: string;
  status: string;
  priority: string;
  due_date?: string;
  created_by?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  position: number;
}

export interface RHVagaBriefing {
  id: string;
  vaga_id: string;
  solicitado_por?: string;
  area_squad?: string;
  nome_vaga: string;
  quantidade_vagas: number;
  modelo?: string;
  cidade_uf?: string;
  regime?: string;
  faixa_salarial?: string;
  objetivo_vaga?: string;
  principais_responsabilidades?: string;
  requisitos_obrigatorios?: string;
  requisitos_desejaveis?: string;
  ferramentas_obrigatorias?: string;
  nivel?: string;
  data_limite: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

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
  created_at: string;
  updated_at: string;
}

export interface RHJustificativa {
  id: string;
  vaga_id: string;
  user_id?: string;
  user_name?: string;
  motivo: string;
  nova_data?: string;
  created_at: string;
}

export interface RHComentario {
  id: string;
  vaga_id: string;
  user_id?: string;
  user_name?: string;
  content: string;
  created_at: string;
}

export interface RHAtividade {
  id: string;
  vaga_id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
}

// HR Statuses (main columns - simplified flow)
export const RH_STATUSES = [
  { id: 'solicitacao_vaga', label: 'Solicitação de Vaga', color: '#6366f1' },
  { id: 'vaga_registrada', label: 'Vaga Registrada', color: '#8b5cf6' },
  { id: 'processo_seletivo', label: 'Processo Seletivo', color: '#22c55e' },
  { id: 'arquivados', label: 'Arquivados', color: '#475569' },
  { id: 'justificativa', label: 'Justificativa', color: '#dc2626' },
] as const;

export type RHStatus = typeof RH_STATUSES[number]['id'];

// Get status label
export function getStatusLabel(status: string): string {
  const found = RH_STATUSES.find(s => s.id === status);
  return found?.label || status;
}

// Get status color
export function getStatusColor(status: string): string {
  const found = RH_STATUSES.find(s => s.id === status);
  return found?.color || '#6366f1';
}

// Hooks

export function useRHVagas() {
  return useQuery({
    queryKey: ['rh-vagas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_vagas')
        .select('*')
        .order('position', { ascending: true });
      
      if (error) throw error;
      return (data || []) as RHVaga[];
    },
  });
}

export function useRHVagaBriefings() {
  return useQuery({
    queryKey: ['rh-vaga-briefings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_vaga_briefings')
        .select('*');
      
      if (error) throw error;
      return (data || []) as RHVagaBriefing[];
    },
  });
}

export function useRHVagaBriefing(vagaId: string | undefined) {
  return useQuery({
    queryKey: ['rh-vaga-briefing', vagaId],
    queryFn: async () => {
      if (!vagaId) return null;
      
      const { data, error } = await supabase
        .from('rh_vaga_briefings')
        .select('*')
        .eq('vaga_id', vagaId)
        .maybeSingle();
      
      if (error) throw error;
      return data as RHVagaBriefing | null;
    },
    enabled: !!vagaId,
  });
}

export function useRHCandidatos(vagaId?: string) {
  return useQuery({
    queryKey: ['rh-candidatos', vagaId],
    queryFn: async () => {
      let query = supabase.from('rh_candidatos').select('*');
      if (vagaId) {
        query = query.eq('vaga_id', vagaId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as RHCandidato[];
    },
  });
}

export function useRHJustificativas(vagaId?: string) {
  return useQuery({
    queryKey: ['rh-justificativas', vagaId],
    queryFn: async () => {
      let query = supabase.from('rh_justificativas').select('*');
      if (vagaId) {
        query = query.eq('vaga_id', vagaId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as RHJustificativa[];
    },
  });
}

export function useRHComentarios(vagaId?: string) {
  return useQuery({
    queryKey: ['rh-comentarios', vagaId],
    queryFn: async () => {
      let query = supabase.from('rh_comentarios').select('*');
      if (vagaId) {
        query = query.eq('vaga_id', vagaId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as RHComentario[];
    },
  });
}

export function useRHAtividades(vagaId?: string) {
  return useQuery({
    queryKey: ['rh-atividades', vagaId],
    queryFn: async () => {
      let query = supabase.from('rh_atividades').select('*');
      if (vagaId) {
        query = query.eq('vaga_id', vagaId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as RHAtividade[];
    },
  });
}

// Mutations

export function useCreateRHVaga() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      due_date?: string;
      created_by?: string;
      assigned_to?: string;
    }) => {
      const { data: vaga, error } = await supabase
        .from('rh_vagas')
        .insert([{
          ...data,
          status: data.status || 'solicitacao_vaga',
          priority: data.priority || 'medium',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return vaga as RHVaga;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-vagas'] });
    },
  });
}

export function useCreateRHVagaBriefing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<RHVagaBriefing, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: briefing, error } = await supabase
        .from('rh_vaga_briefings')
        .insert([data])
        .select()
        .single();
      
      if (error) throw error;
      return briefing as RHVagaBriefing;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rh-vaga-briefings'] });
      queryClient.invalidateQueries({ queryKey: ['rh-vaga-briefing', variables.vaga_id] });
    },
  });
}

export function useUpdateRHVagaBriefing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<RHVagaBriefing> & { id: string }) => {
      const { data: briefing, error } = await supabase
        .from('rh_vaga_briefings')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return briefing as RHVagaBriefing;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rh-vaga-briefings'] });
      queryClient.invalidateQueries({ queryKey: ['rh-vaga-briefing', result.vaga_id] });
    },
  });
}

export function useUpdateRHVaga() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<RHVaga> & { id: string }) => {
      const { data: vaga, error } = await supabase
        .from('rh_vagas')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return vaga as RHVaga;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-vagas'] });
    },
  });
}

export function useMoveRHVaga() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status, position }: { id: string; status: string; position?: number }) => {
      const { data: vaga, error } = await supabase
        .from('rh_vagas')
        .update({ status, position: position ?? 0 })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return vaga as RHVaga;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-vagas'] });
    },
  });
}

export function useArchiveRHVaga() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: vaga, error } = await supabase
        .from('rh_vagas')
        .update({ archived_at: new Date().toISOString(), status: 'arquivados' })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return vaga as RHVaga;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-vagas'] });
    },
  });
}

export function useUnarchiveRHVaga() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: vaga, error } = await supabase
        .from('rh_vagas')
        .update({ archived_at: null, status: 'processo_seletivo' })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return vaga as RHVaga;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-vagas'] });
    },
  });
}

export function useDeleteRHVaga() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rh_vagas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-vagas'] });
    },
  });
}

export function useCreateRHJustificativa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      vaga_id: string;
      user_id?: string;
      user_name?: string;
      motivo: string;
      nova_data?: string;
    }) => {
      const { data: justificativa, error } = await supabase
        .from('rh_justificativas')
        .insert([data])
        .select()
        .single();
      
      if (error) throw error;
      return justificativa as RHJustificativa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-justificativas'] });
    },
  });
}

export function useCreateRHComentario() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      vaga_id: string;
      user_id?: string;
      user_name?: string;
      content: string;
    }) => {
      const { data: comentario, error } = await supabase
        .from('rh_comentarios')
        .insert([data])
        .select()
        .single();
      
      if (error) throw error;
      return comentario as RHComentario;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rh-comentarios', variables.vaga_id] });
    },
  });
}

export function useCreateRHAtividade() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      vaga_id: string;
      user_id?: string;
      user_name?: string;
      action: string;
      details?: Record<string, any>;
    }) => {
      const { data: atividade, error } = await supabase
        .from('rh_atividades')
        .insert([data])
        .select()
        .single();
      
      if (error) throw error;
      return atividade as RHAtividade;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rh-atividades', variables.vaga_id] });
    },
  });
}

// Dashboard stats
export function useRHDashboardStats() {
  const { data: vagas } = useRHVagas();
  const { data: briefings } = useRHVagaBriefings();
  
  const stats = {
    vagasAbertas: 0,
    vagasEmAnuncio: 0,
    vagasComEntrevista: 0,
    vagasEmNegociacao: 0,
    vagasFechadas: 0,
    vagasAtrasadas: 0,
    tempoMedioPorEtapa: {} as Record<string, number>,
  };
  
  if (!vagas) return stats;
  
  const now = new Date();
  
  vagas.forEach(vaga => {
    const briefing = briefings?.find(b => b.vaga_id === vaga.id);
    
    // Vagas abertas (não arquivadas e não finalizadas)
    if (!['arquivados', 'descartado'].includes(vaga.status)) {
      stats.vagasAbertas++;
    }
    
    // Vagas em anúncio
    if (vaga.status === 'anuncio_publicado') {
      stats.vagasEmAnuncio++;
    }
    
    // Vagas com entrevista marcada ou feita
    if (['entrevista_marcada', 'entrevista_primeiro', 'entrevista_segundo', 'entrevista_terceiro'].includes(vaga.status)) {
      stats.vagasComEntrevista++;
    }
    
    // Vagas em negociação
    if (['negociando', 'selecionando'].includes(vaga.status)) {
      stats.vagasEmNegociacao++;
    }
    
    // Vagas fechadas
    if (vaga.status === 'arquivados') {
      stats.vagasFechadas++;
    }
    
    // Vagas atrasadas
    if (briefing?.data_limite) {
      const dataLimite = new Date(briefing.data_limite);
      if (dataLimite < now && !['arquivados', 'descartado'].includes(vaga.status)) {
        stats.vagasAtrasadas++;
      }
    }
  });
  
  return stats;
}

// Check if vaga is overdue
export function isVagaOverdue(vaga: RHVaga, briefing?: RHVagaBriefing | null): boolean {
  if (!briefing?.data_limite) return false;
  if (['arquivados', 'descartado'].includes(vaga.status)) return false;
  
  const dataLimite = new Date(briefing.data_limite);
  const now = new Date();
  return dataLimite < now;
}
