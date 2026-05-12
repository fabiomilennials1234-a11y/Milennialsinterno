import { useCallback } from 'react';
import { X } from 'lucide-react';
import type { TechTaskType, TechTaskPriority, TechTaskStatus } from '../types';
import { TYPE_LABEL_FRIENDLY, PRIORITY_LABEL } from '../lib/statusLabels';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BacklogFilters {
  types: TechTaskType[];
  priorities: TechTaskPriority[];
  statuses: TechTaskStatus[];
}

export const EMPTY_FILTERS: BacklogFilters = {
  types: [],
  priorities: [],
  statuses: [],
};

interface BacklogFilterBarProps {
  filters: BacklogFilters;
  onChange: (filters: BacklogFilters) => void;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: { key: TechTaskType; label: string; color: string; bg: string }[] = [
  { key: 'BUG', label: TYPE_LABEL_FRIENDLY.BUG.label, color: '#E5484D', bg: 'rgba(229,72,77,0.12)' },
  { key: 'FEATURE', label: TYPE_LABEL_FRIENDLY.FEATURE.label, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  { key: 'HOTFIX', label: TYPE_LABEL_FRIENDLY.HOTFIX.label, color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  { key: 'CHORE', label: TYPE_LABEL_FRIENDLY.CHORE.label, color: '#8A8A95', bg: 'rgba(138,138,149,0.12)' },
];

const PRIORITY_OPTIONS: { key: TechTaskPriority; label: string; color: string; bg: string }[] = [
  { key: 'CRITICAL', label: PRIORITY_LABEL.CRITICAL, color: '#E5484D', bg: 'rgba(229,72,77,0.10)' },
  { key: 'HIGH', label: PRIORITY_LABEL.HIGH, color: '#F97316', bg: 'rgba(249,115,22,0.10)' },
  { key: 'MEDIUM', label: PRIORITY_LABEL.MEDIUM, color: '#EAB308', bg: 'rgba(234,179,8,0.10)' },
  { key: 'LOW', label: PRIORITY_LABEL.LOW, color: '#8A8A95', bg: 'rgba(138,138,149,0.10)' },
];

const STATUS_OPTIONS: { key: TechTaskStatus; label: string }[] = [
  { key: 'BACKLOG', label: 'Backlog' },
  { key: 'TODO', label: 'A fazer' },
  { key: 'IN_PROGRESS', label: 'Fazendo' },
  { key: 'REVIEW', label: 'Review' },
  { key: 'DONE', label: 'Feito' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toggleInArray<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BacklogFilterBar({ filters, onChange }: BacklogFilterBarProps) {
  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.priorities.length > 0 ||
    filters.statuses.length > 0;

  const handleClearAll = useCallback(() => {
    onChange(EMPTY_FILTERS);
  }, [onChange]);

  return (
    <div className="flex flex-col gap-3">
      {/* Type chips */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)] w-16 flex-shrink-0">
          Tipo
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_OPTIONS.map((opt) => {
            const active = filters.types.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() =>
                  onChange({ ...filters, types: toggleInArray(filters.types, opt.key) })
                }
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all select-none"
                style={{
                  color: active ? opt.color : 'var(--mtech-text-muted)',
                  backgroundColor: active ? opt.bg : 'transparent',
                  border: active
                    ? `1px solid ${opt.color}33`
                    : '1px solid var(--mtech-border)',
                  opacity: active ? 1 : 0.7,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Priority chips */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)] w-16 flex-shrink-0">
          Prio
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {PRIORITY_OPTIONS.map((opt) => {
            const active = filters.priorities.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    priorities: toggleInArray(filters.priorities, opt.key),
                  })
                }
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all select-none"
                style={{
                  color: active ? opt.color : 'var(--mtech-text-muted)',
                  backgroundColor: active ? opt.bg : 'transparent',
                  border: active
                    ? `1px solid ${opt.color}33`
                    : '1px solid var(--mtech-border)',
                  opacity: active ? 1 : 0.7,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status chips */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)] w-16 flex-shrink-0">
          Status
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((opt) => {
            const active = filters.statuses.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    statuses: toggleInArray(filters.statuses, opt.key),
                  })
                }
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all select-none"
                style={{
                  color: active
                    ? 'var(--mtech-accent)'
                    : 'var(--mtech-text-muted)',
                  backgroundColor: active
                    ? 'var(--mtech-accent-muted)'
                    : 'transparent',
                  border: active
                    ? '1px solid var(--mtech-accent)33'
                    : '1px solid var(--mtech-border)',
                  opacity: active ? 1 : 0.7,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearAll}
          className="inline-flex items-center gap-1 self-start text-[11px] text-[var(--mtech-text-subtle)] hover:text-[var(--mtech-accent)] transition-colors"
        >
          <X className="h-3 w-3" />
          Limpar filtros
        </button>
      )}
    </div>
  );
}
