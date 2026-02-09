import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RHVagaPlataforma {
  id: string;
  vaga_id: string;
  plataforma: string;
  budget: number | null;
  descricao: string | null;
  expectativa_curriculos: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlataformaData {
  vaga_id: string;
  plataforma: string;
  budget?: number | null;
  descricao?: string | null;
  expectativa_curriculos?: number | null;
  observacoes?: string | null;
}

// Fetch plataformas for a specific vaga
export function useRHVagaPlataformasQuery(vagaId: string | undefined) {
  return useQuery({
    queryKey: ['rh-vaga-plataformas', vagaId],
    queryFn: async () => {
      if (!vagaId) return [];
      
      const { data, error } = await supabase
        .from('rh_vaga_plataformas')
        .select('*')
        .eq('vaga_id', vagaId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as RHVagaPlataforma[];
    },
    enabled: !!vagaId,
  });
}

// Create multiple plataformas
export function useCreateRHVagaPlataformas() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (plataformas: CreatePlataformaData[]) => {
      // First delete existing plataformas for this vaga
      if (plataformas.length > 0) {
        const vagaId = plataformas[0].vaga_id;
        await supabase
          .from('rh_vaga_plataformas')
          .delete()
          .eq('vaga_id', vagaId);
      }
      
      // Then insert new ones
      const { data, error } = await supabase
        .from('rh_vaga_plataformas')
        .insert(plataformas)
        .select();
      
      if (error) throw error;
      return data as RHVagaPlataforma[];
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['rh-vaga-plataformas', variables[0].vaga_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['rh-vaga-plataformas'] });
    },
  });
}

// Update a single plataforma
export function useUpdateRHVagaPlataforma() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<RHVagaPlataforma> & { id: string }) => {
      const { data: plataforma, error } = await supabase
        .from('rh_vaga_plataformas')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return plataforma as RHVagaPlataforma;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rh-vaga-plataformas', result.vaga_id] });
      queryClient.invalidateQueries({ queryKey: ['rh-vaga-plataformas'] });
    },
  });
}

// Delete a plataforma
export function useDeleteRHVagaPlataforma() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, vagaId }: { id: string; vagaId: string }) => {
      const { error } = await supabase
        .from('rh_vaga_plataformas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, vagaId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rh-vaga-plataformas', result.vagaId] });
      queryClient.invalidateQueries({ queryKey: ['rh-vaga-plataformas'] });
    },
  });
}

// Combined hook for use in modal
export function useRHVagaPlataformas(vagaId: string | undefined) {
  const { data: existingPlataformas, isLoading } = useRHVagaPlataformasQuery(vagaId);
  const createMutation = useCreateRHVagaPlataformas();
  
  return {
    existingPlataformas,
    isLoading,
    createPlataformas: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
