import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ISSUE_STATUS_CONFIG, type IssueStatus } from '../lib/issueSystem';

// ---------------------------------------------------------------------------
// BoardColumn — a single status lane on the board.
//
// Header echoes the project kanban: uppercase 11px tracking-widest label, a
// status dot, and a right-aligned tabular count. Optional WIP limit renders as
// "count/limit" and turns danger-red when exceeded — the only time the count
// raises its voice. `children` is the card list (caller owns drag/drop).
//
// Pure presentational. Engineer pairs against BoardColumnProps.
// ---------------------------------------------------------------------------

export interface BoardColumnProps {
  status: IssueStatus;
  /** Override the default status label (rarely needed). */
  label?: string;
  count: number;
  /** Optional WIP limit. Count turns danger when count > wipLimit. */
  wipLimit?: number;
  /** Highlight while a draggable hovers the lane. */
  isDraggingOver?: boolean;
  /** Right-aligned header slot (e.g. an add button). */
  headerActions?: ReactNode;
  /** The card list — caller wires the droppable. */
  children?: ReactNode;
  className?: string;
}

export function BoardColumn({
  status,
  label,
  count,
  wipLimit,
  isDraggingOver = false,
  headerActions,
  children,
  className = '',
}: BoardColumnProps) {
  const cfg = ISSUE_STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const overLimit = wipLimit !== undefined && count > wipLimit;

  return (
    <section
      className={`flex w-[300px] flex-shrink-0 flex-col ${className}`}
      aria-label={label ?? cfg.label}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2 border-b border-[var(--mtech-border)] pb-3">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: cfg.color }} aria-hidden />
        <span className="truncate text-[11px] font-semibold uppercase tracking-widest text-[var(--mtech-text-muted)]">
          {label ?? cfg.label}
        </span>
        <span
          data-mono
          className="ml-auto text-[11px] tabular-nums"
          style={{ color: overLimit ? 'var(--mtech-danger)' : 'var(--mtech-text-subtle)' }}
          title={
            wipLimit !== undefined
              ? overLimit
                ? `Acima do limite de ${wipLimit}`
                : `${count} de ${wipLimit}`
              : undefined
          }
        >
          {wipLimit !== undefined ? `${count}/${wipLimit}` : count}
        </span>
        {headerActions}
      </div>

      {/* Lane */}
      <div
        className="flex flex-1 flex-col gap-2 rounded-[var(--mtech-radius-md)] p-1 transition-colors"
        style={{
          minHeight: 120,
          background: isDraggingOver ? `${cfg.color}10` : 'transparent',
        }}
      >
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// BoardSwimlane — a collapsible squad grouping that wraps a row of columns.
//
// Used when the board is grouped by squad (front/back). The header spans the
// full board width; the chevron toggles the lane. `accentColor` tints the
// squad dot (pass epicColorFromKey(squad) or a fixed token for consistency).
// ---------------------------------------------------------------------------

export interface BoardSwimlaneProps {
  /** Squad name, e.g. "Frontend". */
  label: string;
  /** Total issue count across the lane's columns. */
  count?: number;
  /** Dot color for the squad. Defaults to muted text. */
  accentColor?: string;
  /** Controlled collapsed state. Omit for uncontrolled (defaults open). */
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  /** The row of BoardColumns. */
  children?: ReactNode;
  className?: string;
}

export function BoardSwimlane({
  label,
  count,
  accentColor = 'var(--mtech-text-subtle)',
  collapsed,
  onToggle,
  children,
  className = '',
}: BoardSwimlaneProps) {
  const isControlled = collapsed !== undefined;
  const [internal, setInternal] = useState(false);
  const isCollapsed = isControlled ? collapsed : internal;

  const toggle = () => {
    const next = !isCollapsed;
    if (!isControlled) setInternal(next);
    onToggle?.(next);
  };

  const Chevron = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div className={`flex flex-col ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!isCollapsed}
        className="sticky left-0 flex w-full items-center gap-2 rounded-[var(--mtech-radius-sm)] border border-[var(--mtech-swimlane-header-border)] bg-[var(--mtech-swimlane-header-bg)] px-3 py-2 text-left transition-colors hover:bg-[var(--mtech-surface-elev)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]"
      >
        <Chevron className="h-3.5 w-3.5 flex-shrink-0 text-[var(--mtech-text-subtle)]" aria-hidden />
        <span
          aria-hidden
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mtech-text-muted)]">
          {label}
        </span>
        {count !== undefined && (
          <span data-mono className="text-[11px] tabular-nums text-[var(--mtech-text-subtle)]">
            {count}
          </span>
        )}
      </button>

      {!isCollapsed && <div className="flex gap-4 pt-4">{children}</div>}
    </div>
  );
}
