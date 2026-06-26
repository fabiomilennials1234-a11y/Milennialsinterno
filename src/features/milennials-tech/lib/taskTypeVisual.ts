import { Bug, Sparkles, Flame, Wrench, Bookmark, SquareCheck, CircleHelp, type LucideIcon } from 'lucide-react';
import type { TechTaskType } from '../types';

// ---------------------------------------------------------------------------
// Task-type visual config — single source of truth for the LEGACY kanban
// cards (TaskCard / TaskRow / TaskDetailModal / ProjectDetailModal).
//
// The `tech_task_type` DB enum grew past the original 4 values
// (BUG/FEATURE/HOTFIX/CHORE) to include STORY + TASK. The local per-component
// lookup maps never got the new keys, so any STORY/TASK row destructured
// `undefined` and white-screened the board. tsc does NOT guard this
// (strictNullChecks is off → indexed access is typed non-undefined), so the
// runtime fallback below is the real protection against future enum growth.
//
// STORY/TASK reuse the canonical issue-system marks (Bookmark / SquareCheck)
// and color tokens so legacy cards read identically to the new IssueTypeBadge.
// ---------------------------------------------------------------------------

/**
 * Canonical runtime list of every `tech_task_type` value. MUST mirror the DB
 * enum. Tests iterate this to assert each value resolves a defined visual —
 * the next enum expansion breaks the TEST, not production.
 */
export const TECH_TASK_TYPES = ['BUG', 'FEATURE', 'HOTFIX', 'CHORE', 'STORY', 'TASK'] as const;

export interface TaskTypeVisual {
  icon: LucideIcon;
  /** Solid color (hex for legacy types, CSS var for STORY/TASK). */
  color: string;
  /** Tinted background. Pair with `color` — never string-append alpha to `color`. */
  bg: string;
}

const VISUAL: Record<TechTaskType, TaskTypeVisual> = {
  BUG: { icon: Bug, color: '#E5484D', bg: 'rgba(229,72,77,0.12)' },
  FEATURE: { icon: Sparkles, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  HOTFIX: { icon: Flame, color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  CHORE: { icon: Wrench, color: '#8A8A95', bg: 'rgba(138,138,149,0.12)' },
  STORY: { icon: Bookmark, color: 'var(--mtech-type-story)', bg: 'var(--mtech-type-story-bg)' },
  TASK: { icon: SquareCheck, color: 'var(--mtech-type-task)', bg: 'var(--mtech-type-task-bg)' },
};

/** Neutral mark for any unmapped/unknown enum value. Never crashes the board. */
export const DEFAULT_TASK_TYPE_VISUAL: TaskTypeVisual = {
  icon: CircleHelp,
  color: '#8A8A95',
  bg: 'rgba(138,138,149,0.12)',
};

export function getTaskTypeVisual(type: string | null | undefined): TaskTypeVisual {
  if (!type) return DEFAULT_TASK_TYPE_VISUAL;
  return VISUAL[type as TechTaskType] ?? DEFAULT_TASK_TYPE_VISUAL;
}
