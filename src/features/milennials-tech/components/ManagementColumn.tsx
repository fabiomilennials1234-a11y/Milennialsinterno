import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ManagementColumnProps {
  title: string;
  icon: LucideIcon;
  count?: number;
  badge?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManagementColumn({
  title,
  icon: Icon,
  count,
  badge,
  headerRight,
  children,
}: ManagementColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] w-[280px] rounded-xl border border-[var(--mtech-border)] bg-[var(--mtech-bg)] overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--mtech-border)] bg-[var(--mtech-surface)]">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-3.5 w-3.5 text-[var(--mtech-accent)] flex-shrink-0" />
          <span className="text-[11px] font-semibold text-[var(--mtech-text)] uppercase tracking-wide truncate">
            {title}
          </span>
          {count !== undefined && (
            <span className="flex-shrink-0 text-[10px] font-medium text-[var(--mtech-text-subtle)] bg-[var(--mtech-surface-elev)] px-1.5 py-0.5 rounded-full tabular-nums">
              {count}
            </span>
          )}
          {badge}
        </div>
        {headerRight && <div className="flex-shrink-0">{headerRight}</div>}
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-apple">
        {children}
      </div>
    </div>
  );
}
