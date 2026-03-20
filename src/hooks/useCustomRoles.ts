import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CustomRole {
  id: string;
  name: string;
  display_name: string;
  allowed_pages: string[];
  is_viewer: boolean;
  squad_id: string | null;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
}

export function useCustomRoles() {
  return useQuery({
    queryKey: ['custom-roles'],
    queryFn: async (): Promise<CustomRole[]> => {
      try {
        const { data, error } = await supabase
          .from('custom_roles')
          .select('*')
          .order('display_name', { ascending: true });

        if (error) {
          // Se a tabela não existe ainda, retorna vazio sem erro
          if (error.message?.includes('schema cache') || error.code === '42P01') {
            console.warn('Tabela custom_roles não encontrada. Execute a migration.');
            return [];
          }
          throw error;
        }
        return (data || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          display_name: r.display_name,
          allowed_pages: r.allowed_pages || [],
          is_viewer: r.is_viewer || false,
          squad_id: r.squad_id || null,
          created_by: r.created_by,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
      } catch (err: any) {
        if (err.message?.includes('schema cache') || err.message?.includes('custom_roles')) {
          console.warn('Tabela custom_roles não disponível:', err.message);
          return [];
        }
        throw err;
      }
    },
  });
}

export function useCreateCustomRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      display_name: string;
      allowed_pages: string[];
      is_viewer?: boolean;
      squad_id?: string | null;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase
        .from('custom_roles')
        .insert({
          name: data.name,
          display_name: data.display_name,
          allowed_pages: data.allowed_pages,
          created_by: user.id,
          ...(data.is_viewer !== undefined ? { is_viewer: data.is_viewer } : {}),
          ...(data.squad_id !== undefined ? { squad_id: data.squad_id } : {}),
        } as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
    },
  });
}

export function useDeleteCustomRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_roles')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
    },
  });
}
