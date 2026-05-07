import { useMemo } from 'react';
import { FolderKanban } from 'lucide-react';
import { useTechProjects, type TechProjectRow } from '../../hooks/useTechProjects';
import {
  PROJECT_STEP_LABEL,
  PROJECT_MEMBER_ROLE_LABEL,
  type ProjectStep,
  type ProjectMemberRole,
} from '../../lib/projectSteps';
import { getInitials } from '../../hooks/useProfiles';

// ---------------------------------------------------------------------------
// Step color mapping
// ---------------------------------------------------------------------------

const STEP_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  briefing: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  arquitetura: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  setup_ambiente: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  desenvolvimento: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  code_review: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  testes: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  deploy: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  acompanhamento: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
};

const DEFAULT_STEP_COLOR = { text: 'text-[var(--mtech-text-muted)]', bg: 'bg-[var(--mtech-surface-elev)]', border: 'border-[var(--mtech-border)]' };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TechTeamProjectStatus() {
  const { data: projects = [], isLoading } = useTechProjects({ status: 'active' });

  // Group projects by current_step
  const grouped = useMemo(() => {
    const map = new Map<string, TechProjectRow[]>();

    for (const p of projects) {
      const step = p.current_step;
      if (!map.has(step)) map.set(step, []);
      map.get(step)!.push(p);
    }

    // Sort by step order
    const stepOrder = Object.keys(PROJECT_STEP_LABEL);
    return Array.from(map.entries()).sort(
      (a, b) => stepOrder.indexOf(a[0]) - stepOrder.indexOf(b[0]),
    );
  }, [projects]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-[var(--mtech-surface-elev)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <FolderKanban className="h-6 w-6 text-[var(--mtech-text-subtle)]" />
        <p className="text-xs text-[var(--mtech-text-subtle)]">Nenhum projeto ativo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([step, stepProjects]) => {
        const stepLabel = PROJECT_STEP_LABEL[step as ProjectStep] ?? step;
        const colors = STEP_COLORS[step] ?? DEFAULT_STEP_COLOR;

        return (
          <div key={step}>
            {/* Step header */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors.text} ${colors.bg} border ${colors.border}`}
              >
                {stepLabel}
              </span>
              <span className="text-[10px] text-[var(--mtech-text-subtle)]">
                {stepProjects.length} projeto{stepProjects.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Project cards */}
            <div className="space-y-2">
              {stepProjects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-lg border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-2.5 transition-colors hover:border-[var(--mtech-accent)]/30"
                >
                  <p className="text-[12px] font-medium text-[var(--mtech-text)] truncate mb-1.5">
                    {project.name}
                  </p>

                  {/* Members */}
                  {project.members.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {project.members.map((m) => {
                        const roleLabel =
                          PROJECT_MEMBER_ROLE_LABEL[m.role as ProjectMemberRole] ?? m.role;
                        return (
                          <span
                            key={m.user_id}
                            className="inline-flex items-center gap-1 rounded-md bg-[var(--mtech-surface-elev)] px-1.5 py-0.5 text-[9px] text-[var(--mtech-text-muted)] border border-[var(--mtech-border)]/50"
                            title={`${m.name ?? 'Sem nome'} (${roleLabel})`}
                          >
                            <span className="flex-shrink-0 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[var(--mtech-accent-muted)] text-[7px] font-bold text-[var(--mtech-accent)]">
                              {getInitials(m.name ?? '')}
                            </span>
                            <span className="truncate max-w-[60px]">{m.name ?? '?'}</span>
                            <span className="opacity-50">{roleLabel}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-[var(--mtech-text-subtle)]/60">Sem membros</p>
                  )}

                  {/* Task count */}
                  {project.pending_task_count > 0 && (
                    <p className="text-[10px] text-[var(--mtech-text-subtle)] mt-1.5">
                      {project.pending_task_count} tarefa{project.pending_task_count !== 1 ? 's' : ''} pendente{project.pending_task_count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
