import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { DepartmentTask } from './useDepartmentTasks';

// ---------------------------------------------------------------------------
// Extended type: department task with project name attached
// ---------------------------------------------------------------------------

export interface ProjectTaskWithName extends DepartmentTask {
  project_name: string | null;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const allProjectTaskKeys = {
  all: ['all-project-tasks'] as const,
  byType: (type: 'daily' | 'weekly') => [...allProjectTaskKeys.all, type] as const,
};

// ---------------------------------------------------------------------------
// Internal helper: fetch project names by IDs
// ---------------------------------------------------------------------------

async function fetchProjectNameMap(projectIds: string[]): Promise<Record<string, string>> {
  if (projectIds.length === 0) return {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects } = await (supabase as any)
    .from('tech_projects')
    .select('id, name')
    .in('id', projectIds);

  const map: Record<string, string> = {};
  if (projects) {
    for (const p of projects) {
      map[p.id] = p.name;
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Internal helper: extract unique project IDs from tasks
// ---------------------------------------------------------------------------

function extractProjectIds(tasks: Record<string, unknown>[]): string[] {
  const ids = new Set<string>();
  for (const t of tasks) {
    const pid = t.related_project_id;
    if (typeof pid === 'string') ids.add(pid);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Internal helper: map raw rows to ProjectTaskWithName
// ---------------------------------------------------------------------------

function mapToProjectTasks(
  rows: Record<string, unknown>[],
  projectMap: Record<string, string>,
): ProjectTaskWithName[] {
  return rows.map((t) => ({
    ...(t as unknown as DepartmentTask),
    _source: 'department' as const,
    project_name: projectMap[(t.related_project_id as string) ?? ''] || null,
  }));
}

// ---------------------------------------------------------------------------
// Query: fetch ALL department_tasks linked to projects (daily)
//        or ALL devs weekly tasks (weekly — includes global ones)
// ---------------------------------------------------------------------------

export function useAllProjectTasks(type: 'daily' | 'weekly') {
  const { user } = useAuth();

  return useQuery({
    queryKey: allProjectTaskKeys.byType(type),
    queryFn: async (): Promise<ProjectTaskWithName[]> => {
      if (type === 'daily') {
        // Daily: all tasks linked to a project
        const { data, error } = await supabase
          .from('department_tasks')
          .select('*, clients:related_client_id(name, razao_social)')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .not('related_project_id' as any, 'is', null)
          .eq('task_type', 'daily')
          .eq('archived', false)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const rows = (data || []) as unknown as Record<string, unknown>[];
        const projectMap = await fetchProjectNameMap(extractProjectIds(rows));
        return mapToProjectTasks(rows, projectMap);
      }

      // Weekly: all devs weekly tasks (includes global + project-linked)
      const { data, error } = await supabase
        .from('department_tasks')
        .select('*, clients:related_client_id(name, razao_social)')
        .eq('task_type', 'weekly')
        .eq('department', 'devs')
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as unknown as Record<string, unknown>[];
      const projectMap = await fetchProjectNameMap(extractProjectIds(rows));
      return mapToProjectTasks(rows, projectMap);
    },
    enabled: !!user?.id,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create a task with selectable project
// ---------------------------------------------------------------------------

export function useCreateAllProjectTask() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskData: {
      title: string;
      task_type: 'daily' | 'weekly';
      related_project_id?: string | null;
      description?: string;
      priority?: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('department_tasks')
        .insert({
          user_id: user.id,
          title: taskData.title,
          description: taskData.description || null,
          task_type: taskData.task_type,
          priority: taskData.priority || 'normal',
          status: 'todo',
          department: 'devs',
          related_project_id: taskData.related_project_id || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allProjectTaskKeys.all });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['department-tasks'] });
      toast.success('Tarefa criada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar tarefa', { description: error.message });
    },
  });
}
