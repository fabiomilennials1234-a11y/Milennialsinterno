import { getInitials } from '../hooks/useProfiles';
import { ISSUE_STATUS_CONFIG, type IssueStatus, type IssueType } from '../lib/issueSystem';
import { IssueTypeBadge } from './IssueTypeBadge';
import { IssueStateBadges } from './IssueStateBadges';
import { StoryPoints } from './StoryPoints';
import { SubtaskIndicator } from './SubtaskIndicator';

// ---------------------------------------------------------------------------
// EpicIssueRow — one child issue inside the epic view, as a dense Jira line.
//
// Lighter than the backlog IssueRow on purpose: inside an epic every row shares
// the same project + epic, so the project/client/grip columns are noise. What a
// reader scans here is narrower —
//
//   [type] KEY  Title……………  [states] [↳subtasks] [pts] [status] [who]
//    ↑what ↑id   ↑the work     ↑flags    ↑breakdown  ↑est   ↑where   ↑owner
//
// The whole row is the click target (open issue). Pure presentational.
// Engineer pairs against EpicChildIssue / EpicIssueRowProps.
// ---------------------------------------------------------------------------

export interface EpicChildIssue {
  id: string;
  /** "AGS-12" — rendered mono. */
  key: string;
  title: string;
  type: IssueType;
  status: IssueStatus;
  storyPoints?: number | null;
  assigneeName?: string | null;
  assigneeAvatar?: string | null;
  isBlocked?: boolean;
  blockerReason?: string | null;
  /** Sub-tasks this issue owns. */
  subtaskCount?: number | null;
  subtaskDoneCount?: number | null;
}

export interface EpicIssueRowProps {
  issue: EpicChildIssue;
  onClick?: (id: string) => void;
  isSelected?: boolean;
  className?: string;
}

function StatusPill({ status }: { status: IssueStatus }) {
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
      <span className="hidden sm:inline">{cfg.label}</span>
    </span>
  );
}

function Assignee({ name, avatarUrl }: { name?: string | null; avatarUrl?: string | null }) {
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

export function EpicIssueRow({
  issue,
  onClick,
  isSelected = false,
  className = '',
}: EpicIssueRowProps) {
  const clickable = !!onClick;
  const ownsSubtasks = !!issue.subtaskCount && issue.subtaskCount > 0;

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
      className={`group/erow relative flex h-10 items-center gap-2.5 px-3 text-left ${
        isSelected
          ? 'bg-[var(--mtech-accent-muted)]'
          : 'bg-transparent hover:bg-[var(--mtech-surface-elev)]'
      } ${
        clickable
          ? 'cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-[var(--mtech-surface-elev)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]'
          : ''
      } ${className}`}
    >
      {isSelected && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 w-[2px] rounded-r-full bg-[var(--mtech-accent)]"
        />
      )}

      {/* Type glyph */}
      <IssueTypeBadge type={issue.type} size="sm" />

      {/* Key */}
      <span
        data-mono
        className="w-[64px] flex-shrink-0 truncate text-[11px] font-semibold tracking-[0.06em] text-[var(--mtech-text-muted)] select-none"
      >
        {issue.key}
      </span>

      {/* Title — leads the line */}
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--mtech-text)]">
        {issue.title}
      </span>

      {/* Meta cluster — right aligned */}
      <div className="flex flex-shrink-0 items-center gap-2.5">
        {issue.isBlocked && (
          <span className="hidden sm:inline-flex">
            <IssueStateBadges
              isBlocked
              blockerReason={issue.blockerReason}
              size="sm"
              reason="tooltip"
            />
          </span>
        )}

        {ownsSubtasks && (
          <span className="hidden md:inline-flex">
            <SubtaskIndicator
              variant="has-subtasks"
              total={issue.subtaskCount as number}
              done={issue.subtaskDoneCount ?? undefined}
              size="sm"
            />
          </span>
        )}

        <StoryPoints points={issue.storyPoints} size="sm" emptyAs="dash" />
        <StatusPill status={issue.status} />
        <Assignee name={issue.assigneeName} avatarUrl={issue.assigneeAvatar} />
      </div>
    </div>
  );
}
