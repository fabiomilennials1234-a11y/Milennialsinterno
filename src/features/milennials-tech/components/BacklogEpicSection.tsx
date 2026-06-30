import { useId } from 'react';
import { ChevronRight } from 'lucide-react';
import { IssueRow } from './IssueRow';
import { epicColorFromKey } from '../lib/issueSystem';
import type { StoryPointValue } from '../lib/issueSystem';
import type { EpicSection } from '../lib/groupByEpic';

// ---------------------------------------------------------------------------
// BacklogEpicSection (#170) — one collapsible Epic group in the grouped backlog.
//
// Identity is quiet: a 2px color rail on the left + an 8px dot in the header,
// never a filled banner. The header is one full-width button (the whole bar
// toggles), title carries weight not color, and the rollup sits right-aligned.
// "Sem Epic" uses the same anatomy in a neutral tone. Pure presentational —
// collapse state and row callbacks are owned by the backlog container.
// ---------------------------------------------------------------------------

export interface BacklogEpicSectionProps {
  section: EpicSection;
  collapsed: boolean;
  onToggle: () => void;
  selectedId?: string | null;
  onIssueClick?: (id: string) => void;
  onEstimate?: (issueId: string, points: StoryPointValue) => void;
}

export function BacklogEpicSection({
  section,
  collapsed,
  onToggle,
  selectedId = null,
  onIssueClick,
  onEstimate,
}: BacklogEpicSectionProps) {
  const bodyId = useId();
  const { epic, issues, rollup } = section;

  const isNoEpic = epic === null;
  const title = epic?.title ?? 'Sem Epic';
  const accent = isNoEpic ? 'var(--mtech-border)' : epicColorFromKey(epic.id);
  const dotColor = isNoEpic ? 'var(--mtech-text-subtle)' : accent;
  const rollupLabel = `${rollup.totalPoints} pts · ${rollup.issueCount} ${
    rollup.issueCount === 1 ? 'issue' : 'issues'
  }`;

  return (
    <section className="relative">
      {/* Color rail — quiet identity, never a filled background */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{ backgroundColor: accent, opacity: isNoEpic ? 0.6 : 0.4 }}
      />

      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={onToggle}
        className="flex h-9 w-full items-center gap-2 px-2 text-left transition-colors hover:bg-[var(--mtech-surface-elev)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--mtech-input-focus)]"
      >
        <ChevronRight
          aria-hidden
          className="h-4 w-4 flex-shrink-0 text-[var(--mtech-text-subtle)] transition-transform duration-150"
          style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
        />
        <span
          aria-hidden
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--mtech-text)]">
          {title}
        </span>
        <span
          data-mono
          className="ml-auto flex-shrink-0 pl-2 text-[11px] tabular-nums text-[var(--mtech-text-muted)]"
        >
          {rollupLabel}
        </span>
      </button>

      {!collapsed && (
        <div id={bodyId} className="divide-y divide-[var(--mtech-border)] pl-7">
          {issues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              onClick={onIssueClick}
              onEstimate={onEstimate}
              isSelected={selectedId === issue.id}
              showEpicChip={false}
            />
          ))}
        </div>
      )}
    </section>
  );
}
