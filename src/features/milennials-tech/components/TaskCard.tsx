import { motion } from 'framer-motion';
import { Bug, Sparkles, Flame, Wrench, Lock, FolderKanban } from 'lucide-react';
import type { TechTask, TechTaskType, TechTaskPriority } from '../types';
import { TYPE_LABEL_FRIENDLY } from '../lib/statusLabels';
import { useProfileMap, getInitials } from '../hooks/useProfiles';
import { useProjectNameMap } from '../hooks/useTechProjects';
import { TimerButton } from './TimerButton';
import { TaskTagBadges } from './TagPicker';
import { useTechTags, useTechTaskTags } from '../hooks/useTechTags';
import { useTechTimeTotals, formatTimeTotal } from '../hooks/useTechTimeTotals';

interface TaskCardProps {
  task: TechTask;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Type icon mapping
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<TechTaskType, { icon: typeof Bug; color: string; bg: string }> = {
  BUG: { icon: Bug, color: '#E5484D', bg: 'rgba(229,72,77,0.12)' },
  FEATURE: { icon: Sparkles, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  HOTFIX: { icon: Flame, color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  CHORE: { icon: Wrench, color: '#8A8A95', bg: 'rgba(138,138,149,0.12)' },
};

const PRIORITY_DOT_COLOR: Record<TechTaskPriority, string> = {
  CRITICAL: 'var(--mtech-accent)',
  HIGH: '#E5484D',
  MEDIUM: '#EAB308',
  LOW: '#5A5A66',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { icon: TypeIcon, color: typeColor, bg: typeBg } = TYPE_CONFIG[task.type];
  const dotColor = PRIORITY_DOT_COLOR[task.priority];
  const profileMap = useProfileMap();
  const projectNameMap = useProjectNameMap();
  const { data: allTags = [] } = useTechTags();
  const { data: allTaskTags = [] } = useTechTaskTags();
  const { data: timeTotals = {} } = useTechTimeTotals();
  const totalTime = formatTimeTotal(timeTotals[task.id] ?? 0);

  // project_id exists in DB row but not in TS types yet — suppress until types regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectId = (task as any).project_id as string | null;
  const projectName = projectId ? projectNameMap[projectId] ?? null : null;

  const assigneeName = task.assignee_id ? profileMap[task.assignee_id] ?? null : null;
  const assigneeInitials = task.assignee_id ? (assigneeName ? getInitials(assigneeName) : '??') : null;

  const creatorName = profileMap[task.created_by] ?? null;
  const creatorInitials = creatorName ? getInitials(creatorName) : '??';
  const creatorTooltip = creatorName ? `Criada por ${creatorName}` : 'Criador indisponível';
  const isSelfAssigned = !!task.assignee_id && task.assignee_id === task.created_by;
  const selfAssignedTooltip = assigneeName
    ? `Criada por ${assigneeName} (responsável)`
    : 'Criada pelo responsável (usuário removido)';
  const assigneeTooltip = assigneeName ? `Responsável: ${assigneeName}` : 'Responsável: usuário removido';

  return (
    <motion.div
      layout
      layoutId={`task-card-${task.id}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] p-3 transition-colors hover:border-[var(--mtech-border-strong)]"
      style={{ boxShadow: 'var(--mtech-shadow-card)', minHeight: 80 }}
    >
      {/* Row 1: type badge + blocked indicator */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none"
          style={{ color: typeColor, backgroundColor: typeBg }}
        >
          <TypeIcon className="h-3 w-3" />
          {TYPE_LABEL_FRIENDLY[task.type].label}
        </span>

        {task.is_blocked && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[var(--mtech-danger)]">
            <Lock className="h-3 w-3" />
            Bloqueada
          </span>
        )}
        {projectName && (
          <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-[var(--mtech-accent)] bg-[var(--mtech-accent-muted)] border border-[var(--mtech-accent)]/15 select-none truncate max-w-[120px]">
            <FolderKanban className="h-2.5 w-2.5 flex-shrink-0" />
            {projectName}
          </span>
        )}
        <TaskTagBadges taskId={task.id} allTags={allTags} taskTags={allTaskTags} />
      </div>

      {/* Row 2: title + priority */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="flex-shrink-0 rounded-full"
          style={{ width: 6, height: 6, backgroundColor: dotColor }}
          aria-label={`Prioridade ${task.priority}`}
        />
        <span className="flex-1 truncate text-sm font-medium text-[var(--mtech-text)]">
          {task.title}
        </span>
      </div>

      {/* Row 3: assignee + timer/time result */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isSelfAssigned ? (
            <span
              title={selfAssignedTooltip}
              className="relative flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none"
            >
              {assigneeInitials}
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full"
                style={{ background: 'var(--mtech-accent)', boxShadow: '0 0 0 1.5px var(--mtech-surface)' }}
              />
            </span>
          ) : task.assignee_id ? (
            <span className="flex items-center -space-x-2 flex-shrink-0">
              <span
                title={creatorTooltip}
                className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none"
              >
                {creatorInitials}
              </span>
              <span
                title={assigneeTooltip}
                className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none"
              >
                {assigneeInitials}
              </span>
            </span>
          ) : (
            <span
              title={creatorTooltip}
              className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none"
            >
              {creatorInitials}
            </span>
          )}
          {assigneeName ? (
            <span className="truncate text-[11px] text-[var(--mtech-text-muted)]">
              {assigneeName}
            </span>
          ) : (
            <span className="truncate text-[11px] text-[var(--mtech-text-subtle)]">
              por {creatorName ?? 'usuário removido'}
            </span>
          )}
        </div>

        {task.status === 'DONE' ? (
          /* Completed: show final time badge */
          totalTime ? (
            <span data-mono className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--mtech-success)]/15 text-[var(--mtech-success)] border border-[var(--mtech-success)]/20">
              ⏱ {totalTime}
            </span>
          ) : null
        ) : (
          /* In progress: show interactive timer */
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <TimerButton taskId={task.id} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
