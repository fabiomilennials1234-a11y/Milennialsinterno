import {
  Bookmark,
  CircleDot,
  SquareCheck,
  Ban,
  Undo2,
  Hourglass,
  CircleDashed,
  ListTodo,
  CircleDotDashed,
  Eye,
  Stamp,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Issue system — canonical config for the #154 visual system.
//
// Domain model per PRD #152. This is the SINGLE source of truth for the
// presentational layer: types, status flow, colors (CSS vars), icons, labels.
// The legacy TaskCard model (BUG/FEATURE/HOTFIX/CHORE + priority) is obsolete
// for this surface and intentionally NOT referenced here.
// ---------------------------------------------------------------------------

export type IssueType = 'STORY' | 'BUG' | 'TASK';

/** Fixed workflow. Order is the canonical left-to-right board order. */
export type IssueStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'AWAITING_APPROVAL'
  | 'CHANGES_REQUESTED'
  | 'DONE';

export type Squad = 'front' | 'back' | (string & {});

/** Allowed estimate scale. `null` = unestimated. */
export const FIBONACCI = [1, 2, 3, 5, 8, 13] as const;
export type StoryPointValue = (typeof FIBONACCI)[number];

// ---------------------------------------------------------------------------
// Type config — Jira convention. Solid color fills the glyph chip.
// ---------------------------------------------------------------------------

export interface IssueTypeConfig {
  label: string;
  icon: LucideIcon;
  /** Solid brand color (CSS var ref). Used for the glyph chip + full pill text. */
  color: string;
  /** Tinted background (CSS var ref). Used for the full pill background. */
  bg: string;
}

export const ISSUE_TYPE_CONFIG: Record<IssueType, IssueTypeConfig> = {
  STORY: {
    label: 'Story',
    icon: Bookmark,
    color: 'var(--mtech-type-story)',
    bg: 'var(--mtech-type-story-bg)',
  },
  BUG: {
    label: 'Bug',
    icon: CircleDot,
    color: 'var(--mtech-type-bug)',
    bg: 'var(--mtech-type-bug-bg)',
  },
  TASK: {
    label: 'Task',
    icon: SquareCheck,
    color: 'var(--mtech-type-task)',
    bg: 'var(--mtech-type-task-bg)',
  },
};

// ---------------------------------------------------------------------------
// Status config — the 7-state workflow. `order` drives board column order.
// ---------------------------------------------------------------------------

export interface IssueStatusConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  order: number;
}

export const ISSUE_STATUS_CONFIG: Record<IssueStatus, IssueStatusConfig> = {
  BACKLOG: {
    label: 'Backlog',
    icon: CircleDashed,
    color: 'var(--mtech-status-backlog)',
    bg: 'var(--mtech-status-backlog-bg)',
    order: 0,
  },
  TODO: {
    label: 'A fazer',
    icon: ListTodo,
    color: 'var(--mtech-status-todo)',
    bg: 'var(--mtech-status-todo-bg)',
    order: 1,
  },
  IN_PROGRESS: {
    label: 'Em progresso',
    icon: CircleDotDashed,
    color: 'var(--mtech-status-in-progress)',
    bg: 'var(--mtech-status-in-progress-bg)',
    order: 2,
  },
  REVIEW: {
    label: 'Review',
    icon: Eye,
    color: 'var(--mtech-status-review)',
    bg: 'var(--mtech-status-review-bg)',
    order: 3,
  },
  AWAITING_APPROVAL: {
    label: 'Aguardando aprovação',
    icon: Stamp,
    color: 'var(--mtech-status-awaiting)',
    bg: 'var(--mtech-status-awaiting-bg)',
    order: 4,
  },
  CHANGES_REQUESTED: {
    label: 'Alterações pedidas',
    icon: Undo2,
    color: 'var(--mtech-status-changes)',
    bg: 'var(--mtech-status-changes-bg)',
    order: 5,
  },
  DONE: {
    label: 'Concluído',
    icon: CheckCircle2,
    color: 'var(--mtech-status-done)',
    bg: 'var(--mtech-status-done-bg)',
    order: 6,
  },
};

/** Canonical board column order (excludes BACKLOG — that lives in the backlog view). */
export const BOARD_STATUS_ORDER: IssueStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'AWAITING_APPROVAL',
  'CHANGES_REQUESTED',
  'DONE',
];

// ---------------------------------------------------------------------------
// Exception-state config — orthogonal flags that can stack on any issue.
// ---------------------------------------------------------------------------

export type IssueExceptionState = 'BLOCKED' | 'CHANGES_REQUESTED' | 'AWAITING_APPROVAL';

export interface IssueExceptionConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

export const ISSUE_EXCEPTION_CONFIG: Record<IssueExceptionState, IssueExceptionConfig> = {
  BLOCKED: {
    label: 'Bloqueado',
    icon: Ban,
    color: 'var(--mtech-state-blocked)',
    bg: 'var(--mtech-state-blocked-bg)',
  },
  CHANGES_REQUESTED: {
    label: 'Alterações',
    icon: Undo2,
    color: 'var(--mtech-state-changes)',
    bg: 'var(--mtech-state-changes-bg)',
  },
  AWAITING_APPROVAL: {
    label: 'Aprovação',
    icon: Hourglass,
    color: 'var(--mtech-state-awaiting)',
    bg: 'var(--mtech-state-awaiting-bg)',
  },
};

// ---------------------------------------------------------------------------
// Epic / Project categorical color — deterministic hue from a stable key.
// ---------------------------------------------------------------------------

export const EPIC_PALETTE: string[] = [
  'var(--mtech-epic-1)',
  'var(--mtech-epic-2)',
  'var(--mtech-epic-3)',
  'var(--mtech-epic-4)',
  'var(--mtech-epic-5)',
  'var(--mtech-epic-6)',
  'var(--mtech-epic-7)',
  'var(--mtech-epic-8)',
];

/**
 * Maps a stable key (epic id, epic key, project prefix) to a palette color.
 * Deterministic so the same epic always reads the same hue across views.
 */
export function epicColorFromKey(key: string | null | undefined): string {
  if (!key) return 'var(--mtech-epic-8)';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return EPIC_PALETTE[Math.abs(hash) % EPIC_PALETTE.length];
}
