import { ArrowDown, ChevronsUp, ChevronUp, Equal, type LucideIcon } from 'lucide-react';
import type { IssueStatus, IssueType } from '../lib/issueSystem';

// ---------------------------------------------------------------------------
// Backlog contract types (#156) — the single cross-project backlog surface.
//
// These are the shapes the engineer maps Supabase rows INTO at the data-layer
// border. The presentational components (IssueRow / BacklogQueue /
// BacklogFilterBar / IssueCreateModal) never see a raw row. Reuses the #154
// issue system (IssueType / IssueStatus) verbatim — no parallel vocabulary.
// ---------------------------------------------------------------------------

export type IssuePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** DB enum `tech_squad` is UPPERCASE. Display is title-case ("Front"/"Back"). */
export type IssueSquad = 'FRONT' | 'BACK';

/** A single backlog issue, flattened across every project into one queue. */
export interface BacklogIssue {
  id: string;
  /** "AGS-12" — rendered mono. */
  key: string;
  title: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  squad: IssueSquad | null;
  storyPoints: number | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  /** Lexorank string. Sort key for the queue; opaque to the UI. */
  rank: string;
  projectId: string;
  projectName: string;
  /** Issue-key prefix, e.g. "AGS". Drives the deterministic project color. */
  projectPrefix: string;
  clientId: string | null;
  clientName: string | null;
  epicId: string | null;
  /** Sprint the issue is assigned to, or null when unassigned (#161). */
  sprintId: string | null;
  /** Blocked flag — DB invariant (#157). When true, no status move is legal. */
  blocked: boolean;
  blockerReason: string | null;
  /** True when the issue joined its sprint after that sprint went ACTIVE (#162). */
  addedAfterStart: boolean;
}

/** Active filter state. Empty arrays / empty string = no constraint. */
export interface BacklogFilters {
  projectIds: string[];
  clientIds: string[];
  squads: IssueSquad[];
  assigneeIds: string[];
  types: IssueType[];
  statuses: IssueStatus[];
  search: string;
}

export const EMPTY_BACKLOG_FILTERS: BacklogFilters = {
  projectIds: [],
  clientIds: [],
  squads: [],
  assigneeIds: [],
  types: [],
  statuses: [],
  search: '',
};

/** Count of dimensions actively constraining the queue (search excluded). */
export function activeFilterCount(f: BacklogFilters): number {
  return (
    f.projectIds.length +
    f.clientIds.length +
    f.squads.length +
    f.assigneeIds.length +
    f.types.length +
    f.statuses.length
  );
}

export function hasAnyFilter(f: BacklogFilters): boolean {
  return activeFilterCount(f) > 0 || f.search.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Option shapes — the lists the filter bar / create modal pick from.
// ---------------------------------------------------------------------------

export interface ProjectOption {
  id: string;
  name: string;
  /** Issue-key prefix, e.g. "AGS". */
  prefix: string;
}

export interface ClientOption {
  id: string;
  name: string;
}

export interface AssigneeOption {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Priority — Jira-convention arrows. Color carries urgency, glyph + label
// carry meaning (never color alone). Tokens only, no raw hex.
// ---------------------------------------------------------------------------

export interface IssuePriorityConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

export const PRIORITY_CONFIG: Record<IssuePriority, IssuePriorityConfig> = {
  CRITICAL: { label: 'Crítica', icon: ChevronsUp, color: 'var(--mtech-danger)' },
  HIGH: { label: 'Alta', icon: ChevronUp, color: 'var(--mtech-status-changes)' },
  MEDIUM: { label: 'Média', icon: Equal, color: 'var(--mtech-text-muted)' },
  LOW: { label: 'Baixa', icon: ArrowDown, color: 'var(--mtech-text-subtle)' },
};

/** High-to-low, for selectors that want the urgent option first. */
export const PRIORITY_ORDER: IssuePriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// ---------------------------------------------------------------------------
// Squad — DB value is UPPERCASE; label is title-case. Dot color is fixed
// (frontend reads blue, backend reads violet) and pulled from epic tokens.
// ---------------------------------------------------------------------------

export interface IssueSquadConfig {
  label: string;
  /** Dot color (CSS var). */
  color: string;
}

export const SQUAD_CONFIG: Record<IssueSquad, IssueSquadConfig> = {
  FRONT: { label: 'Front', color: 'var(--mtech-epic-1)' },
  BACK: { label: 'Back', color: 'var(--mtech-epic-3)' },
};

export const SQUAD_ORDER: IssueSquad[] = ['FRONT', 'BACK'];
