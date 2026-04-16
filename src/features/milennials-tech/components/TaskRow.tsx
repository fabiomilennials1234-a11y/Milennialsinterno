import { Bug, Sparkles, Flame, Wrench } from 'lucide-react';
import type { TechTask, TechTaskType } from '../types';
import { TYPE_LABEL, STATUS_LABEL_PT, PRIORITY_LABEL } from '../lib/statusLabels';
import { TimerButton } from './TimerButton';

interface TaskRowProps {
  task: TechTask;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TYPE_ICON: Record<TechTaskType, typeof Bug> = {
  BUG: Bug,
  FEATURE: Sparkles,
  HOTFIX: Flame,
  CHORE: Wrench,
};

const TYPE_COLOR: Record<TechTaskType, string> = {
  BUG: '#E5484D',
  FEATURE: '#3B82F6',
  HOTFIX: '#F97316',
  CHORE: '#8A8A95',
};

const TYPE_BG: Record<TechTaskType, string> = {
  BUG: 'rgba(229,72,77,0.12)',
  FEATURE: 'rgba(59,130,246,0.12)',
  HOTFIX: 'rgba(249,115,22,0.12)',
  CHORE: 'rgba(138,138,149,0.12)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskRow({ task, onClick }: TaskRowProps) {
  const TypeIcon = TYPE_ICON[task.type];

  const deadlineStr = task.deadline
    ? new Date(task.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group flex items-center gap-3 h-10 px-3 border-b border-[var(--mtech-border)] cursor-pointer transition-colors hover:bg-[var(--mtech-surface-elev)]"
    >
      {/* Type badge */}
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none flex-shrink-0"
        style={{ color: TYPE_COLOR[task.type], backgroundColor: TYPE_BG[task.type] }}
      >
        <TypeIcon className="h-3 w-3" />
        {TYPE_LABEL[task.type]}
      </span>

      {/* Title */}
      <span className="flex-1 truncate text-sm font-medium text-[var(--mtech-text)]">
        {task.title}
      </span>

      {/* Assignee placeholder */}
      <span className="w-20 truncate text-xs text-[var(--mtech-text-muted)] text-right flex-shrink-0">
        {task.assignee_id ? task.assignee_id.slice(0, 8) : '--'}
      </span>

      {/* Sprint badge */}
      <span className="w-16 text-xs text-[var(--mtech-text-subtle)] text-center flex-shrink-0 truncate">
        {task.sprint_id ? 'Sprint' : '--'}
      </span>

      {/* Deadline */}
      <span className="w-16 text-xs text-[var(--mtech-text-muted)] text-center flex-shrink-0" data-mono>
        {deadlineStr ?? '--'}
      </span>

      {/* Status badge */}
      <span className="flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide select-none border border-[var(--mtech-border)] bg-[var(--mtech-surface)] text-[var(--mtech-text-muted)]">
        {STATUS_LABEL_PT[task.status]}
      </span>

      {/* Priority */}
      <span className="w-14 text-[10px] font-medium text-[var(--mtech-text-muted)] text-center flex-shrink-0 uppercase">
        {PRIORITY_LABEL[task.priority]}
      </span>

      {/* Timer */}
      <span className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <TimerButton taskId={task.id} />
      </span>
    </div>
  );
}
