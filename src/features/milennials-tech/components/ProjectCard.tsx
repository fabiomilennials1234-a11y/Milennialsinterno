import { motion } from 'framer-motion';
import { AlertTriangle, Clock, CheckCircle2, User } from 'lucide-react';
import type { TechProjectRow } from '../hooks/useTechProjects';
import type { ProjectStep, ProjectPriority, ProjectType } from '../lib/projectSteps';
import { PROJECT_STEPS, PROJECT_STEP_LABEL } from '../lib/projectSteps';
import { getInitials } from '../hooks/useProfiles';

// ---------------------------------------------------------------------------
// Priority config
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#E5484D', bg: 'rgba(229,72,77,0.14)', label: 'Critica' },
  high: { color: '#F97316', bg: 'rgba(249,115,22,0.14)', label: 'Alta' },
  medium: { color: '#EAB308', bg: 'rgba(234,179,8,0.14)', label: 'Media' },
  low: { color: '#6E6E7A', bg: 'rgba(110,110,122,0.14)', label: 'Baixa' },
};

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  client: { color: '#3B82F6', bg: 'rgba(59,130,246,0.14)', label: 'Cliente' },
  internal: { color: '#8A8A95', bg: 'rgba(138,138,149,0.14)', label: 'Interno' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStepIndex(step: string): number {
  const idx = (PROJECT_STEPS as readonly string[]).indexOf(step);
  return idx >= 0 ? idx : 0;
}

function getDaysRemaining(deadline: string | null): { days: number; label: string; urgent: boolean } | null {
  if (!deadline) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + 'T00:00:00');
  const diff = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { days: diff, label: `${Math.abs(diff)}d atrasado`, urgent: true };
  if (diff === 0) return { days: 0, label: 'Hoje', urgent: true };
  if (diff <= 3) return { days: diff, label: `${diff}d`, urgent: true };
  return { days: diff, label: `${diff}d`, urgent: false };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  project: TechProjectRow;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const stepIdx = getStepIndex(project.current_step);
  const progress = ((stepIdx + 1) / PROJECT_STEPS.length) * 100;
  const priority = PRIORITY_CONFIG[project.priority] ?? PRIORITY_CONFIG.medium;
  const type = TYPE_CONFIG[project.type] ?? TYPE_CONFIG.internal;
  const deadline = getDaysRemaining(project.deadline);
  const showPriorityBadge = project.priority === 'critical' || project.priority === 'high';

  // Members for avatar stack (max 4)
  const visibleMembers = project.members.slice(0, 4);
  const overflowCount = Math.max(0, project.members.length - 4);

  return (
    <motion.div
      layout
      layoutId={`project-card-${project.id}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-3.5 transition-all hover:border-[var(--mtech-border-strong)] hover:translate-y-[-1px]"
      style={{ boxShadow: 'var(--mtech-shadow-card)', width: 340 }}
    >
      {/* Row 1: Name + type badge */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <h3 className="text-sm font-semibold text-[var(--mtech-text)] truncate flex-1 leading-tight">
          {project.name}
        </h3>
        <span
          className="flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none"
          style={{ color: type.color, backgroundColor: type.bg }}
        >
          {type.label}
        </span>
      </div>

      {/* Row 2: Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--mtech-text-subtle)] uppercase tracking-wider font-medium">
            {PROJECT_STEP_LABEL[project.current_step as ProjectStep] ?? project.current_step}
          </span>
          <span className="text-[10px] text-[var(--mtech-text-subtle)]" data-mono>
            {stepIdx + 1}/{PROJECT_STEPS.length}
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-[var(--mtech-surface-elev)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: progress === 100
                ? 'var(--mtech-success)'
                : 'var(--mtech-accent)',
            }}
          />
        </div>
      </div>

      {/* Row 3: Lead + devs */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* Lead avatar */}
          {project.lead_name ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                title={`Lead: ${project.lead_name}`}
                className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-accent-muted)] border border-[var(--mtech-accent)]/30 text-[9px] font-bold text-[var(--mtech-accent)] select-none"
              >
                {getInitials(project.lead_name)}
              </span>
              <span className="truncate text-[11px] text-[var(--mtech-text-muted)]">
                {project.lead_name}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[var(--mtech-text-subtle)]">
                <User className="h-3 w-3" />
              </span>
              <span className="text-[11px] text-[var(--mtech-text-subtle)]">Sem lead</span>
            </div>
          )}
        </div>

        {/* Dev avatars stacked */}
        {visibleMembers.length > 0 && (
          <div className="flex items-center -space-x-1.5 flex-shrink-0">
            {visibleMembers.map((m) => (
              <span
                key={m.user_id}
                title={m.name ?? 'Membro'}
                className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none"
              >
                {m.name ? getInitials(m.name) : '??'}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[8px] font-bold text-[var(--mtech-text-subtle)] select-none">
                +{overflowCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Row 4: Metadata line */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tasks counter */}
        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--mtech-text-subtle)]">
          <CheckCircle2 className="h-3 w-3" />
          <span data-mono>
            {project.task_count - project.pending_task_count}/{project.task_count}
          </span>
        </span>

        {/* Deadline */}
        {deadline && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium"
            style={{ color: deadline.urgent ? 'var(--mtech-danger)' : 'var(--mtech-text-subtle)' }}
          >
            <Clock className="h-3 w-3" />
            {deadline.label}
          </span>
        )}

        {/* Priority badge */}
        {showPriorityBadge && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider select-none"
            style={{ color: priority.color, backgroundColor: priority.bg }}
          >
            {project.priority === 'critical' && <AlertTriangle className="h-2.5 w-2.5" />}
            {priority.label}
          </span>
        )}

        {/* Client name */}
        {project.client_name && project.type === 'client' && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--mtech-text-subtle)] truncate max-w-[120px]">
            {project.client_name}
          </span>
        )}
      </div>
    </motion.div>
  );
}
