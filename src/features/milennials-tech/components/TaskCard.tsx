import { motion } from 'framer-motion';
import { Bug, Sparkles, Flame, Wrench, Lock } from 'lucide-react';
import type { TechTask, TechTaskType, TechTaskPriority } from '../types';
import { TYPE_LABEL_FRIENDLY } from '../lib/statusLabels';
import { useProfileMap, getInitials } from '../hooks/useProfiles';
import { TimerButton } from './TimerButton';

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

  const assigneeName = task.assignee_id ? profileMap[task.assignee_id] : null;
  const initials = assigneeName ? getInitials(assigneeName) : null;

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

      {/* Row 3: assignee + timer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {initials && (
            <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none">
              {initials}
            </span>
          )}
          {assigneeName && (
            <span className="truncate text-[11px] text-[var(--mtech-text-muted)]">
              {assigneeName}
            </span>
          )}
        </div>
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <TimerButton taskId={task.id} />
        </span>
      </div>
    </motion.div>
  );
}
