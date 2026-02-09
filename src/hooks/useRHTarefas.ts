import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Task statuses
export const TAREFA_STATUSES = [
  { id: 'a_fazer', label: 'A Fazer', color: '#6366f1' },
  { id: 'fazendo', label: 'Fazendo', color: '#f59e0b' },
  { id: 'feitas', label: 'Feitas', color: '#22c55e' },
] as const;

export type TarefaStatus = typeof TAREFA_STATUSES[number]['id'];

export interface RHTarefa {
  id: string;
  titulo: string;
  descricao?: string;
  status: TarefaStatus;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  vaga_id?: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  data_limite?: string;
  created_by?: string;
  created_by_name?: string;
  position: number;
  archived?: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
  // Automation fields
  tipo?: 'manual' | 'registrar_vaga' | 'publicar_anuncio' | 'publicar_campanha';
  completed_at?: string;
}

// Get status label
export function getTarefaStatusLabel(status: string): string {
  const found = TAREFA_STATUSES.find(s => s.id === status);
  return found?.label || status;
}

// Get status color
export function getTarefaStatusColor(status: string): string {
  const found = TAREFA_STATUSES.find(s => s.id === status);
  return found?.color || '#6366f1';
}

// Fetch all RH tasks
export function useRHTarefas() {
  return useQuery({
    queryKey: ['rh-tarefas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rh_tarefas')
        .select('*')
        .order('position', { ascending: true });
      
      if (error) throw error;
      return (data || []) as RHTarefa[];
    },
  });
}

// Create a new task
export function useCreateRHTarefa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      titulo: string;
      descricao?: string;
      status?: TarefaStatus;
      prioridade?: 'baixa' | 'media' | 'alta' | 'urgente';
      vaga_id?: string;
      responsavel_id?: string;
      responsavel_nome?: string;
      data_limite?: string;
      created_by?: string;
      created_by_name?: string;
      tipo?: 'manual' | 'registrar_vaga' | 'publicar_anuncio' | 'publicar_campanha';
    }) => {
      const { data: tarefa, error } = await (supabase as any)
        .from('rh_tarefas')
        .insert([{
          ...data,
          status: data.status || 'a_fazer',
          prioridade: data.prioridade || 'media',
          tipo: data.tipo || 'manual',
          position: 0,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return tarefa as RHTarefa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-tarefas'] });
    },
  });
}

// Update a task
export function useUpdateRHTarefa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<RHTarefa> & { id: string }) => {
      const { data: tarefa, error } = await (supabase as any)
        .from('rh_tarefas')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return tarefa as RHTarefa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-tarefas'] });
    },
  });
}

// Move a task to a new status
export function useMoveRHTarefa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status, position }: { id: string; status: TarefaStatus; position?: number }) => {
      const { data: tarefa, error } = await (supabase as any)
        .from('rh_tarefas')
        .update({ status, position: position ?? 0 })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return tarefa as RHTarefa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-tarefas'] });
    },
  });
}

// Delete a task
export function useDeleteRHTarefa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('rh_tarefas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-tarefas'] });
    },
  });
}
