import { ISSUE_EXCEPTION_CONFIG, type IssueExceptionState } from '../lib/issueSystem';

// ---------------------------------------------------------------------------
// IssueStateBadges — exception-state markers that stack on an issue.
//
// These are orthogonal to workflow status: an issue can be IN_PROGRESS and
// also BLOCKED. Rendered in a fixed priority order (blocked first, it is the
// most urgent signal). On the card, use size="sm" and reason="tooltip".
// On the issue-view, use size="md" and reason="inline" so the blocker reason
// reads in full.
//
// Pure presentational. Engineer pairs against IssueStateBadgesProps.
// ---------------------------------------------------------------------------

export interface IssueStateBadgesProps {
  isBlocked?: boolean;
  blockerReason?: string | null;
  changesRequested?: boolean;
  awaitingApproval?: boolean;
  size?: 'sm' | 'md';
  /** How to surface the blocker reason. 'tooltip' (card) | 'inline' (issue-view). */
  reason?: 'tooltip' | 'inline';
  className?: string;
}

const SIZE = {
  sm: { pill: 'h-[18px] px-1.5 text-[10px] gap-1', icon: 'h-2.5 w-2.5' },
  md: { pill: 'h-6 px-2 text-[11px] gap-1.5', icon: 'h-3 w-3' },
} as const;

function StateBadge({
  state,
  size,
  reason,
  reasonText,
}: {
  state: IssueExceptionState;
  size: 'sm' | 'md';
  reason: 'tooltip' | 'inline';
  reasonText?: string | null;
}) {
  const cfg = ISSUE_EXCEPTION_CONFIG[state];
  const Icon = cfg.icon;
  const s = SIZE[size];
  const showInline = reason === 'inline' && state === 'BLOCKED' && !!reasonText;
  const tooltip =
    state === 'BLOCKED' && reasonText ? `${cfg.label}: ${reasonText}` : cfg.label;

  return (
    <span
      title={reason === 'tooltip' ? tooltip : undefined}
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide select-none ${s.pill}`}
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <Icon className={s.icon} strokeWidth={2.5} aria-hidden />
      {cfg.label}
      {showInline && (
        <span className="font-normal normal-case tracking-normal text-[var(--mtech-text-muted)]">
          · {reasonText}
        </span>
      )}
    </span>
  );
}

export function IssueStateBadges({
  isBlocked = false,
  blockerReason,
  changesRequested = false,
  awaitingApproval = false,
  size = 'sm',
  reason = 'tooltip',
  className = '',
}: IssueStateBadgesProps) {
  if (!isBlocked && !changesRequested && !awaitingApproval) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {isBlocked && (
        <StateBadge state="BLOCKED" size={size} reason={reason} reasonText={blockerReason} />
      )}
      {changesRequested && (
        <StateBadge state="CHANGES_REQUESTED" size={size} reason={reason} />
      )}
      {awaitingApproval && (
        <StateBadge state="AWAITING_APPROVAL" size={size} reason={reason} />
      )}
    </div>
  );
}
