import { Plus } from 'lucide-react';
import { getInitials } from '../hooks/useProfiles';
import { type IssueType } from '../lib/issueSystem';
import { IssueTypeBadge } from './IssueTypeBadge';
import { IssueStateBadges } from './IssueStateBadges';
import { StoryPoints } from './StoryPoints';
import { SubtaskIndicator } from './SubtaskIndicator';

// ---------------------------------------------------------------------------
// IssueCard — the board card.
//
// Reading order, top to bottom (matches how a dev scans a board):
//   1. summary  — what the work is, leads the card (2-line clamp)
//   2. states   — blocked / changes / awaiting, only when present
//   3. epic     — colored chip, only when the card belongs to an epic
//   4. footer   — type glyph + key (left) · assignee + points (right)
//
// An optional 2px epic rail runs down the left edge to group cards by epic at
// a glance without spending a whole row. Pure presentational, fills its column.
// Engineer pairs against IssueCardData / IssueCardProps.
// ---------------------------------------------------------------------------

export interface IssueCardAssignee {
  name: string | null;
  avatarUrl?: string | null;
}

export interface IssueCardData {
  id: string;
  /** "AGS-12" — rendered mono. */
  key: string;
  title: string;
  type: IssueType;
  storyPoints?: number | null;
  assignee?: IssueCardAssignee | null;
  /** Epic accent (CSS color). Drives the left rail + chip dot. */
  epicColor?: string | null;
  epicLabel?: string | null;
  isBlocked?: boolean;
  blockerReason?: string | null;
  changesRequested?: boolean;
  awaitingApproval?: boolean;
  /** Optional flat labels, e.g. ["frontend", "regression"]. */
  labels?: string[];
  /**
   * Parent issue key when this card IS a sub-task. Renders a parent breadcrumb
   * above the summary (the Jira sub-task signal). Sub-tasks never carry points.
   */
  parentKey?: string | null;
  /** Count of sub-tasks this issue OWNS. Renders a tree glyph + fraction. */
  subtaskCount?: number | null;
  /** Completed sub-tasks (pairs with subtaskCount to render "done/total"). */
  subtaskDoneCount?: number | null;
  /**
   * True when this issue entered the sprint AFTER it started — i.e. scope that
   * crept in mid-flight. Surfaces a discreet gold "Escopo" marker so the board
   * reads which work was part of the original commitment and which was added.
   * Orthogonal to the exception states; it is context, not an alarm.
   */
  addedAfterStart?: boolean;
}

export interface IssueCardProps {
  issue: IssueCardData;
  onClick?: (id: string) => void;
  /** Jump to the parent issue from a sub-task card's breadcrumb. */
  onParentClick?: (parentKey: string) => void;
  /** Set true while the card is mid-drag to suppress hover transitions. */
  isDragging?: boolean;
  className?: string;
}

function Assignee({ assignee }: { assignee?: IssueCardAssignee | null }) {
  if (!assignee?.name) {
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
      title={assignee.name}
      aria-label={`Responsável: ${assignee.name}`}
      className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--mtech-accent)]/30 bg-[var(--mtech-accent-muted)] text-[9px] font-bold text-[var(--mtech-accent)] select-none"
    >
      {assignee.avatarUrl ? (
        <img src={assignee.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(assignee.name)
      )}
    </span>
  );
}

/** Scope-creep marker — this card joined the sprint after it started. */
function ScopeChangeBadge() {
  return (
    <span
      title="Adicionado após o início da sprint"
      aria-label="Adicionado após o início da sprint"
      className="inline-flex h-[18px] items-center gap-1 rounded-full bg-[var(--mtech-accent-muted)] px-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--mtech-accent)] select-none"
    >
      <Plus className="h-2.5 w-2.5" strokeWidth={2.75} aria-hidden />
      Escopo
    </span>
  );
}

export function IssueCard({
  issue,
  onClick,
  onParentClick,
  isDragging = false,
  className = '',
}: IssueCardProps) {
  const clickable = !!onClick;
  const hasStates = issue.isBlocked || issue.changesRequested || issue.awaitingApproval;
  const showMarkers = hasStates || issue.addedAfterStart;
  const isSubtask = !!issue.parentKey;
  const ownsSubtasks = !!issue.subtaskCount && issue.subtaskCount > 0;

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
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
      className={`group relative w-full overflow-hidden rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] py-2.5 pl-3.5 pr-3 text-left ${
        isDragging ? '' : 'transition-colors'
      } ${
        clickable
          ? 'cursor-pointer hover:border-[var(--mtech-border-strong)] hover:bg-[var(--mtech-surface-elev)] focus-visible:outline-none focus-visible:border-[var(--mtech-border-strong)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]'
          : ''
      } ${className}`}
      style={
        isDragging
          ? { boxShadow: 'var(--mtech-shadow-card)', borderColor: 'var(--mtech-border-strong)' }
          : undefined
      }
    >
      {/* Epic rail */}
      {issue.epicColor && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[2px] rounded-r-full"
          style={{ backgroundColor: issue.epicColor }}
        />
      )}

      {/* 0 · Parent breadcrumb — only when this card is a sub-task */}
      {isSubtask && (
        <div className="mb-1.5">
          <SubtaskIndicator
            variant="is-subtask"
            parentKey={issue.parentKey as string}
            onParentClick={
              onParentClick ? () => onParentClick(issue.parentKey as string) : undefined
            }
            size="sm"
          />
        </div>
      )}

      {/* 1 · Summary */}
      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--mtech-text)]">
        {issue.title}
      </p>

      {/* 2 · Exception states + scope-creep marker (states urgent, scope context) */}
      {showMarkers && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <IssueStateBadges
            isBlocked={issue.isBlocked}
            blockerReason={issue.blockerReason}
            changesRequested={issue.changesRequested}
            awaitingApproval={issue.awaitingApproval}
            size="sm"
            reason="tooltip"
          />
          {issue.addedAfterStart && <ScopeChangeBadge />}
        </div>
      )}

      {/* 3 · Epic chip */}
      {issue.epicLabel && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: issue.epicColor ?? 'var(--mtech-text-subtle)' }}
          />
          <span className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--mtech-text-subtle)]">
            {issue.epicLabel}
          </span>
        </div>
      )}

      {/* 4 · Footer */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <IssueTypeBadge type={issue.type} issueKey={issue.key} size="sm" />
        <div className="flex flex-shrink-0 items-center gap-2">
          {ownsSubtasks && (
            <SubtaskIndicator
              variant="has-subtasks"
              total={issue.subtaskCount as number}
              done={issue.subtaskDoneCount ?? undefined}
              size="sm"
            />
          )}
          {/* Sub-tasks don't point — suppress the estimate pill on a sub-task card. */}
          {!isSubtask && <StoryPoints points={issue.storyPoints} size="sm" />}
          <Assignee assignee={issue.assignee} />
        </div>
      </div>
    </div>
  );
}
