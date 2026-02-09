import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface OKR {
  id: string;
  title: string;
  description: string | null;
  type: 'annual' | 'weekly';
  target_value: number | null;
  current_value: number | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'completed' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useOKRs(type?: 'annual' | 'weekly') {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['okrs', type],
    queryFn: async () => {
      let queryBuilder: any = supabase
        .from('okrs')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (type) {
        queryBuilder = queryBuilder.eq('type', type);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return data as OKR[];
    },
  });

  const createOKR = useMutation({
    mutationFn: async (data: Partial<OKR>) => {
      const insertData = {
        title: data.title || '',
        description: data.description || null,
        type: data.type || 'annual',
        target_value: data.target_value ?? null,
        current_value: data.current_value ?? null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        status: data.status || 'active',
        created_by: user?.id || null,
      };
      const { data: newOKR, error } = await supabase
        .from('okrs')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return newOKR;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okrs'] });
      toast.success('OKR criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar OKR: ' + error.message);
    },
  });

  const updateOKR = useMutation({
    mutationFn: async ({ id, ...data }: Partial<OKR> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from('okrs')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okrs'] });
      toast.success('OKR atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar OKR: ' + error.message);
    },
  });

  const deleteOKR = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('okrs')
        .update({ status: 'archived' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okrs'] });
      toast.success('OKR arquivado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao arquivar OKR: ' + error.message);
    },
  });

  return {
    okrs: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createOKR,
    updateOKR,
    deleteOKR,
  };
}

export function useArchiveWeeklyOKRs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('okrs')
        .update({ status: 'archived' })
        .eq('type', 'weekly')
        .eq('status', 'active');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['okrs'] });
      toast.success('OKRs semanais arquivados');
    },
    onError: (error: Error) => {
      toast.error('Erro ao arquivar OKRs: ' + error.message);
    },
  });
}
