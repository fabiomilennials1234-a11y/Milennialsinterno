import { GripVertical, Building2 } from 'lucide-react';
import { getInitials } from '../hooks/useProfiles';
import {
  ISSUE_STATUS_CONFIG,
  epicColorFromKey,
} from '../lib/issueSystem';
import { IssueTypeBadge } from './IssueTypeBadge';
import { SubtaskIndicator } from './SubtaskIndicator';
import { StoryPointsPicker } from './StoryPointsPicker';
import type { StoryPointValue } from '../lib/issueSystem';
import {
  PRIORITY_CONFIG,
  SQUAD_CONFIG,
  type BacklogIssue,
} from './backlogTypes';

// ---------------------------------------------------------------------------
// IssueRow — one dense backlog line, flattened across every project.
//
// This is the Jira *backlog* row (a line, not a card). It is scanned left to
// right by a dev triaging the queue:
//
//   [grip] [type] PREFIX-N  Title……………………  [prio] [project] [client] [squad] [pts] [status] [who]
//    ↑drag  ↑what  ↑id       ↑the work          ↑urgency  ↑grouping signals      ↑est  ↑where   ↑owner
//
// The grip is the only reorder affordance and stays hidden until hover/focus
// so a still queue reads clean. The whole row is the click target (open issue).
// Pure presentational — DnD wiring (innerRef/draggableProps) is owned by the
// parent BacklogQueue, which hands us `dragHandleProps` + `isDragging`.
// ---------------------------------------------------------------------------

type DragHandleProps = Record<string, unknown>;

export interface IssueRowProps {
  issue: BacklogIssue;
  onClick?: (id: string) => void;
  /** Inline-estimate this issue from the points pill. Omit to render read-only. */
  onEstimate?: (issueId: string, points: StoryPointValue) => void;
  /** Keyboard/selection highlight (j/k navigation). */
  isSelected?: boolean;
  /** True while this row is the one being dragged. */
  isDragging?: boolean;
  /** Spread onto the grip handle by the parent (from @hello-pangea/dnd). */
  dragHandleProps?: DragHandleProps;
  className?: string;
}

// --- sub-parts --------------------------------------------------------------

function PriorityMark({ priority }: { priority: BacklogIssue['priority'] }) {
  const cfg = PRIORITY_CONFIG[priority];
  const Icon = cfg.icon;
  return (
    <span
      title={`Prioridade: ${cfg.label}`}
      aria-label={`Prioridade ${cfg.label}`}
      className="flex h-4 w-4 flex-shrink-0 items-center justify-center"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: cfg.color }} aria-hidden />
    </span>
  );
}

function ProjectChip({ name, prefix }: { name: string; prefix: string }) {
  const color = epicColorFromKey(prefix);
  return (
    <span
      title={name}
      className="inline-flex max-w-[120px] items-center gap-1.5 rounded-full border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] py-0.5 pl-1.5 pr-2 select-none"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span
        data-mono
        className="truncate text-[10px] font-semibold tracking-[0.04em] text-[var(--mtech-text-muted)]"
      >
        {prefix}
      </span>
    </span>
  );
}

function ClientChip({ name }: { name: string }) {
  return (
    <span
      title={`Cliente: ${name}`}
      className="inline-flex max-w-[120px] items-center gap-1 text-[11px] text-[var(--mtech-text-subtle)] select-none"
    >
      <Building2 className="h-3 w-3 flex-shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}

function SquadPill({ squad }: { squad: NonNullable<BacklogIssue['squad']> }) {
  const cfg = SQUAD_CONFIG[squad];
  return (
    <span
      title={`Squad ${cfg.label}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)] py-0.5 pl-1.5 pr-2 text-[10px] font-medium text-[var(--mtech-text-muted)] select-none"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}

function StatusPill({ status }: { status: BacklogIssue['status'] }) {
  const cfg = ISSUE_STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      title={cfg.label}
      aria-label={`Status: ${cfg.label}`}
      className="inline-flex h-[20px] items-center gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide select-none"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <Icon className="h-2.5 w-2.5 flex-shrink-0" strokeWidth={2.5} aria-hidden />
      <span className="hidden lg:inline">{cfg.label}</span>
    </span>
  );
}

function Assignee({
  name,
  avatarUrl,
}: {
  name: string | null;
  avatarUrl: string | null;
}) {
  if (!name) {
    return (
      <span
        title="Sem responsável"
        aria-label="Sem responsável"
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--mtech-border-strong)] bg-transparent text-[9px] text-[var(--mtech-text-subtle)] select-none"
      >
        ?
      </span>
    );
  }
  return (
    <span
      title={name}
      aria-label={`Responsável: ${name}`}
      className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--mtech-accent)]/30 bg-[var(--mtech-accent-muted)] text-[9px] font-bold text-[var(--mtech-accent)] select-none"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

// --- component --------------------------------------------------------------

export function IssueRow({
  issue,
  onClick,
  onEstimate,
  isSelected = false,
  isDragging = false,
  dragHandleProps,
  className = '',
}: IssueRowProps) {
  const clickable = !!onClick;

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={`${issue.key} ${issue.title}`}
      onClick={clickable ? () => onClick(issue.id) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(issue.id);
              }
            }
          : undefined
      }
      data-selected={isSelected || undefined}
      data-dragging={isDragging || undefined}
      className={`group/row relative flex h-10 items-center gap-2.5 pl-1.5 pr-3 text-left ${
        isDragging ? '' : 'transition-colors'
      } ${
        isSelected
          ? 'bg-[var(--mtech-accent-muted)]'
          : 'bg-[var(--mtech-surface)] hover:bg-[var(--mtech-surface-elev)]'
      } ${
        clickable
          ? 'cursor-pointer focus-visible:outline-none focus-visible:bg-[var(--mtech-surface-elev)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]'
          : ''
      } ${className}`}
      style={
        isDragging
          ? {
              boxShadow: 'var(--mtech-shadow-card)',
              borderRadius: 'var(--mtech-radius-md)',
              backgroundColor: 'var(--mtech-surface-elev)',
            }
          : undefined
      }
    >
      {/* Selection rail */}
      {isSelected && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 w-[2px] rounded-r-full bg-[var(--mtech-accent)]"
        />
      )}

      {/* Drag handle — affordance only on hover/focus */}
      <span
        {...dragHandleProps}
        aria-label="Reordenar issue"
        className={`flex h-6 w-4 flex-shrink-0 cursor-grab items-center justify-center text-[var(--mtech-text-subtle)] opacity-0 transition-opacity hover:text-[var(--mtech-text-muted)] focus-visible:opacity-100 group-hover/row:opacity-100 active:cursor-grabbing ${
          isDragging ? 'opacity-100' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </span>

      {/* Type glyph */}
      <IssueTypeBadge type={issue.type} size="sm" />

      {/* Key */}
      <span
        data-mono
        className="w-[68px] flex-shrink-0 truncate text-[11px] font-semibold tracking-[0.06em] text-[var(--mtech-text-muted)] select-none"
      >
        {issue.key}
      </span>

      {/* Title — leads the line */}
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--mtech-text)]">
        {issue.title}
      </span>

      {/* Meta cluster — right aligned, progressively revealed by width */}
      <div className="flex flex-shrink-0 items-center gap-2.5">
        <PriorityMark priority={issue.priority} />

        <span className="hidden md:inline-flex">
          <ProjectChip name={issue.projectName} prefix={issue.projectPrefix} />
        </span>

        {issue.clientName && (
          <span className="hidden xl:inline-flex">
            <ClientChip name={issue.clientName} />
          </span>
        )}

        {issue.squad && (
          <span className="hidden lg:inline-flex">
            <SquadPill squad={issue.squad} />
          </span>
        )}

        {issue.subtaskProgress && issue.subtaskProgress.total > 0 && (
          <span className="hidden sm:inline-flex">
            <SubtaskIndicator
              variant="has-subtasks"
              total={issue.subtaskProgress.total}
              done={issue.subtaskProgress.done}
            />
          </span>
        )}

        <StoryPointsPicker
          value={issue.storyPoints ?? null}
          onChange={(v) => onEstimate?.(issue.id, v)}
          size="sm"
          triggerClassName="flex-shrink-0"
        />

        <StatusPill status={issue.status} />

        <Assignee name={issue.assigneeName} avatarUrl={issue.assigneeAvatar} />
      </div>
    </div>
  );
}
