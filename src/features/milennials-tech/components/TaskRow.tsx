import { Bug, Sparkles, Flame, Wrench, FolderKanban } from 'lucide-react';
import type { TechTask, TechTaskType } from '../types';
import { TYPE_LABEL, STATUS_LABEL_PT, PRIORITY_LABEL } from '../lib/statusLabels';
import { useProfileMap, getInitials } from '../hooks/useProfiles';
import { useProjectNameMap } from '../hooks/useTechProjects';
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
  const profileMap = useProfileMap();
  const projectNameMap = useProjectNameMap();
  const TypeIcon = TYPE_ICON[task.type];

  // project_id exists in DB but not in generated TS types yet — suppress until types regenerated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectId = (task as any).project_id as string | null;
  const projectName = projectId ? projectNameMap[projectId] ?? null : null;

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

      {/* Project badge */}
      {projectName && (
        <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-[var(--mtech-accent)] bg-[var(--mtech-accent-muted)] border border-[var(--mtech-accent)]/15 select-none truncate max-w-[100px] flex-shrink-0">
          <FolderKanban className="h-2.5 w-2.5 flex-shrink-0" />
          {projectName}
        </span>
      )}

      {/* Title */}
      <span className="flex-1 truncate text-sm font-medium text-[var(--mtech-text)]">
        {task.title}
      </span>

      {/* Creator + assignee */}
      <span className="w-28 flex items-center justify-end gap-1.5 text-xs text-[var(--mtech-text-muted)] flex-shrink-0">
        {(() => {
          const creatorName = profileMap[task.created_by] ?? null;
          const creatorInitials = creatorName ? getInitials(creatorName) : '??';
          const creatorTooltip = creatorName ? `Criada por ${creatorName}` : 'Criador indisponível';
          const assigneeName = task.assignee_id ? profileMap[task.assignee_id] ?? null : null;
          const assigneeInitials = task.assignee_id ? (assigneeName ? getInitials(assigneeName) : '??') : null;
          const assigneeTooltip = assigneeName ? `Responsável: ${assigneeName}` : 'Responsável: usuário removido';
          const selfAssignedTooltip = assigneeName
            ? `Criada por ${assigneeName} (responsável)`
            : 'Criada pelo responsável (usuário removido)';
          const isSelfAssigned = !!task.assignee_id && task.assignee_id === task.created_by;
          const assigneeDisplayName = assigneeName ?? (task.assignee_id ? '—' : null);

          if (isSelfAssigned) {
            return (
              <>
                <span
                  title={selfAssignedTooltip}
                  className="relative flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold select-none"
                >
                  {assigneeInitials}
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full"
                    style={{ background: 'var(--mtech-accent)', boxShadow: '0 0 0 1.5px var(--mtech-bg)' }}
                  />
                </span>
                <span className="truncate">{assigneeDisplayName}</span>
              </>
            );
          }
          if (task.assignee_id) {
            return (
              <>
                <span className="flex items-center -space-x-2">
                  <span
                    title={creatorTooltip}
                    className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold select-none"
                  >
                    {creatorInitials}
                  </span>
                  <span
                    title={assigneeTooltip}
                    className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold select-none"
                  >
                    {assigneeInitials}
                  </span>
                </span>
                <span className="truncate">{assigneeDisplayName}</span>
              </>
            );
          }
          return (
            <>
              <span
                title={creatorTooltip}
                className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold select-none"
              >
                {creatorInitials}
              </span>
              <span className="truncate text-[var(--mtech-text-subtle)]">por {creatorName ?? 'removido'}</span>
            </>
          );
        })()}
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
