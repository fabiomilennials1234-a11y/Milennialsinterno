import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { techProjectKeys } from './useTechProjects';
import type { ProjectMemberRole } from '../lib/projectSteps';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const techProjectMemberKeys = {
  all: ['tech', 'project-members'] as const,
  list: (projectId: string) => [...techProjectMemberKeys.all, 'list', projectId] as const,
};

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

export interface TechProjectMemberRow {
  project_id: string;
  user_id: string;
  allocated_hours_week: number;
  role: string;
  added_at: string;
  user_name: string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTechProjectMembers(projectId: string | undefined) {
  return useQuery<TechProjectMemberRow[]>({
    queryKey: techProjectMemberKeys.list(projectId ?? ''),
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await (supabase as any)
        .from('tech_project_members')
        .select(`
          project_id,
          user_id,
          allocated_hours_week,
          role,
          added_at,
          profile:profiles!tech_project_members_user_id_fkey(name)
        `)
        .eq('project_id', projectId)
        .order('added_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        project_id: row.project_id,
        user_id: row.user_id,
        allocated_hours_week: row.allocated_hours_week,
        role: row.role,
        added_at: row.added_at,
        user_name: row.profile?.name ?? null,
      })) as TechProjectMemberRow[];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useAddProjectMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      user_id: string;
      role?: ProjectMemberRole;
      allocated_hours_week?: number;
    }) => {
      const { data, error } = await (supabase as any)
        .from('tech_project_members')
        .insert({
          project_id: input.project_id,
          user_id: input.user_id,
          role: input.role || 'dev',
          allocated_hours_week: input.allocated_hours_week || 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: { project_id: string }) => {
      qc.invalidateQueries({ queryKey: techProjectMemberKeys.list(variables.project_id) });
      qc.invalidateQueries({ queryKey: techProjectKeys.all });
      toast.success('Membro adicionado');
    },
    onError: (err: Error) => {
      toast.error('Erro ao adicionar membro', { description: err.message });
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: string; userId: string }) => {
      const { error } = await (supabase as any)
        .from('tech_project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data: any, variables: { projectId: string }) => {
      qc.invalidateQueries({ queryKey: techProjectMemberKeys.list(variables.projectId) });
      qc.invalidateQueries({ queryKey: techProjectKeys.all });
      toast.success('Membro removido');
    },
    onError: (err: Error) => {
      toast.error('Erro ao remover membro', { description: err.message });
    },
  });
}

export function useUpdateProjectMemberHours() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      userId,
      allocatedHoursWeek,
    }: {
      projectId: string;
      userId: string;
      allocatedHoursWeek: number;
    }) => {
      const { data, error } = await (supabase as any)
        .from('tech_project_members')
        .update({ allocated_hours_week: allocatedHoursWeek })
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: { projectId: string }) => {
      qc.invalidateQueries({ queryKey: techProjectMemberKeys.list(variables.projectId) });
    },
    onError: (err: Error) => {
      toast.error('Erro ao atualizar horas', { description: err.message });
    },
  });
}
