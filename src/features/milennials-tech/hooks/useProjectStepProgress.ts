import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isLastProjectStep } from '../lib/projectSteps';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepProgress {
  projectId: string;
  currentStep: string;
  totalBlocking: number;
  doneBlocking: number;
  canAdvance: boolean;
  isLastStep: boolean;
}

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

export const projectStepProgressKeys = {
  all: ['project-step-progress'] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * For each active project, computes how many blocking tasks in the current
 * step are done vs total. Returns `canAdvance` when all blocking tasks are
 * complete (and at least one exists).
 */
export function useProjectStepProgress(
  projects: { id: string; currentStep: string }[],
) {
  const projectIds = projects.map((p) => p.id);
  const enabled = projectIds.length > 0;

  return useQuery<StepProgress[]>({
    queryKey: [...projectStepProgressKeys.all, projectIds],
    queryFn: async () => {
      // Fetch all blocking, non-archived tasks for these projects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('department_tasks')
        .select('related_project_id, project_step, status, is_blocking')
        .in('related_project_id', projectIds)
        .eq('is_blocking', true)
        .eq('archived', false);

      if (error) throw error;

      const rows = (data || []) as unknown as {
        related_project_id: string;
        project_step: string | null;
        status: string;
        is_blocking: boolean;
      }[];

      // Build progress per project
      return projects.map((project) => {
        const stepTasks = rows.filter(
          (r) =>
            r.related_project_id === project.id &&
            r.project_step === project.currentStep,
        );

        const totalBlocking = stepTasks.length;
        const doneBlocking = stepTasks.filter((t) => t.status === 'done').length;

        return {
          projectId: project.id,
          currentStep: project.currentStep,
          totalBlocking,
          doneBlocking,
          canAdvance: totalBlocking > 0 && doneBlocking === totalBlocking,
          isLastStep: isLastProjectStep(project.currentStep),
        };
      });
    },
    enabled,
    staleTime: 10_000,
  });
}
