import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/auth';

export interface DbUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  created_at: string;
  group_id: string | null;
  squad_id: string | null;
  category_id: string | null;
  is_coringa: boolean;
  group_name?: string;
  squad_name?: string;
  category_name?: string;
}

// Fetch all users with their roles, groups, squads and categories
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<DbUser[]> => {
      // Fetch profiles with related data
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          organization_groups(name),
          squads(name),
          independent_categories(name)
        `)
        .order('created_at', { ascending: true });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Map profiles with their roles
      return profiles.map(profile => {
        const userRole = roles.find(r => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          name: profile.name,
          email: profile.email,
          role: (userRole?.role as UserRole) || 'design',
          avatar: profile.avatar,
          created_at: profile.created_at,
          group_id: profile.group_id,
          squad_id: profile.squad_id,
          category_id: profile.category_id,
          is_coringa: profile.is_coringa || false,
          group_name: (profile.organization_groups as any)?.name || null,
          squad_name: (profile.squads as any)?.name || null,
          category_name: (profile.independent_categories as any)?.name || null,
        };
      });
    }
  });
}

// Create user
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      name: string;
      role: UserRole;
      group_id?: string;
      squad_id?: string;
      category_id?: string;
      is_coringa?: boolean;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-user', {
        body: data,
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao criar usuário');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
}

// Update user
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      email?: string;
      password?: string;
      name?: string;
      role?: UserRole;
      group_id?: string | null;
      squad_id?: string | null;
      category_id?: string | null;
      is_coringa?: boolean;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('update-user', {
        body: data,
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao atualizar usuário');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
}

// Delete user
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao remover usuário');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
}
