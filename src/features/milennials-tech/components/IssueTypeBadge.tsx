import { ISSUE_TYPE_CONFIG, type IssueType } from '../lib/issueSystem';

// ---------------------------------------------------------------------------
// IssueTypeBadge — Jira-signature type marker.
//
// `variant="glyph"` (default): a solid color-filled square with a white glyph.
//   This is the unmistakable Jira type chip — use it on cards and dense rows.
// `variant="full"`: glyph + uppercase label pill — use it in the issue-view
//   header, filters, and anywhere the type needs to be spelled out.
//
// Pure presentational. No data lookups. Engineer pairs against IssueTypeBadgeProps.
// ---------------------------------------------------------------------------

export interface IssueTypeBadgeProps {
  type: IssueType;
  /** 'glyph' = solid square icon only. 'full' = icon + label pill. */
  variant?: 'glyph' | 'full';
  /** Optional mono issue key rendered to the right, e.g. "AGS-12". */
  issueKey?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const SQUARE_SIZE = { sm: 'h-4 w-4', md: 'h-[18px] w-[18px]' } as const;
const GLYPH_SIZE = { sm: 'h-2.5 w-2.5', md: 'h-3 w-3' } as const;

export function IssueTypeBadge({
  type,
  variant = 'glyph',
  issueKey,
  size = 'md',
  className = '',
}: IssueTypeBadgeProps) {
  const cfg = ISSUE_TYPE_CONFIG[type];
  const Icon = cfg.icon;

  const glyph = (
    <span
      aria-hidden
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-[3px] ${SQUARE_SIZE[size]}`}
      style={{ backgroundColor: cfg.color }}
    >
      <Icon className={`${GLYPH_SIZE[size]} text-black/85`} strokeWidth={2.5} />
    </span>
  );

  if (variant === 'glyph') {
    if (!issueKey) {
      return (
        <span className={`inline-flex ${className}`} title={cfg.label} aria-label={cfg.label}>
          {glyph}
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${className}`}
        aria-label={`${cfg.label} ${issueKey}`}
      >
        {glyph}
        <span
          data-mono
          className="text-[11px] font-semibold tracking-[0.08em] text-[var(--mtech-text-muted)] select-none"
        >
          {issueKey}
        </span>
      </span>
    );
  }

  // variant === 'full'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2 select-none ${className}`}
      style={{ backgroundColor: cfg.bg }}
      aria-label={cfg.label}
    >
      {glyph}
      <span
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: cfg.color }}
      >
        {cfg.label}
      </span>
      {issueKey && (
        <span
          data-mono
          className="text-[10px] font-semibold tracking-[0.08em] text-[var(--mtech-text-muted)]"
        >
          {issueKey}
        </span>
      )}
    </span>
  );
}
