import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ProjectStatus, ProjectType, ProjectPriority } from '../lib/projectSteps';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const techProjectKeys = {
  all: ['tech', 'projects'] as const,
  list: (filters?: TechProjectFilters) => [...techProjectKeys.all, 'list', filters ?? {}] as const,
  one: (id: string) => [...techProjectKeys.all, 'one', id] as const,
};

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface TechProjectFilters {
  status?: ProjectStatus;
  type?: ProjectType;
  priority?: ProjectPriority;
  leadId?: string;
}

// ---------------------------------------------------------------------------
// Row type (from query with joins)
// ---------------------------------------------------------------------------

export interface TechProjectMemberInfo {
  user_id: string;
  name: string | null;
  role: string;
}

export interface TechProjectRow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  current_step: string;
  priority: string;
  lead_id: string | null;
  client_id: string | null;
  start_date: string | null;
  deadline: string | null;
  estimated_hours: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  lead_name: string | null;
  client_name: string | null;
  member_count: number;
  members: TechProjectMemberInfo[];
  task_count: number;
  pending_task_count: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTechProjects(filters?: TechProjectFilters) {
  return useQuery<TechProjectRow[]>({
    queryKey: techProjectKeys.list(filters),
    queryFn: async () => {
      // Base query with join to profiles for lead name
      let query = (supabase as any)
        .from('tech_projects')
        .select(`
          *,
          lead:profiles!tech_projects_lead_id_fkey(name),
          client:clients!tech_projects_client_id_fkey(name),
          members_detail:tech_project_members(user_id, role, profile:profiles!tech_project_members_user_id_fkey(name)),
          tasks:tech_tasks!tech_tasks_project_id_fkey(id, status)
        `);

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.priority) query = query.eq('priority', filters.priority);
      if (filters?.leadId) query = query.eq('lead_id', filters.leadId);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      // Flatten joined data
      return (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        type: row.type,
        status: row.status,
        current_step: row.current_step,
        priority: row.priority,
        lead_id: row.lead_id,
        client_id: row.client_id,
        start_date: row.start_date,
        deadline: row.deadline,
        estimated_hours: row.estimated_hours,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        lead_name: row.lead?.name ?? null,
        client_name: row.client?.name ?? null,
        member_count: Array.isArray(row.members_detail) ? row.members_detail.length : 0,
        members: Array.isArray(row.members_detail)
          ? row.members_detail.map((m: any) => ({
              user_id: m.user_id,
              name: m.profile?.name ?? null,
              role: m.role,
            }))
          : [],
        task_count: Array.isArray(row.tasks) ? row.tasks.length : 0,
        pending_task_count: Array.isArray(row.tasks)
          ? row.tasks.filter((t: any) => t.status !== 'DONE').length
          : 0,
      })) as TechProjectRow[];
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  name: string;
  description?: string;
  type: ProjectType;
  priority?: ProjectPriority;
  lead_id?: string;
  client_id?: string;
  start_date?: string;
  deadline?: string;
  estimated_hours?: number;
  created_by: string;
}

export function useCreateTechProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { data, error } = await (supabase as any)
        .from('tech_projects')
        .insert({
          name: input.name,
          description: input.description || null,
          type: input.type,
          priority: input.priority || 'medium',
          lead_id: input.lead_id || null,
          client_id: input.client_id || null,
          start_date: input.start_date || null,
          deadline: input.deadline || null,
          estimated_hours: input.estimated_hours || null,
          created_by: input.created_by,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techProjectKeys.all });
      toast.success('Projeto criado');
    },
    onError: (err: Error) => {
      toast.error('Erro ao criar projeto', { description: err.message });
    },
  });
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  type?: ProjectType;
  status?: ProjectStatus;
  current_step?: string;
  priority?: ProjectPriority;
  lead_id?: string | null;
  client_id?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  estimated_hours?: number | null;
}

export function useUpdateTechProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateProjectInput }) => {
      const { data, error } = await (supabase as any)
        .from('tech_projects')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any, variables: { id: string }) => {
      qc.invalidateQueries({ queryKey: techProjectKeys.all });
      qc.invalidateQueries({ queryKey: techProjectKeys.one(variables.id) });
    },
    onError: (err: Error) => {
      toast.error('Erro ao atualizar projeto', { description: err.message });
    },
  });
}

export function useDeleteTechProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('tech_projects')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techProjectKeys.all });
      toast.success('Projeto removido');
    },
    onError: (err: Error) => {
      toast.error('Erro ao remover projeto', { description: err.message });
    },
  });
}

// ---------------------------------------------------------------------------
// Lookup helpers (memoised from cached project list)
// ---------------------------------------------------------------------------

/** Returns a Map<projectId, projectName> from the cached project list */
export function useProjectNameMap(): Record<string, string> {
  const { data } = useTechProjects();
  return useMemo(() => {
    if (!data) return {};
    const map: Record<string, string> = {};
    for (const p of data) {
      map[p.id] = p.name;
    }
    return map;
  }, [data]);
}
