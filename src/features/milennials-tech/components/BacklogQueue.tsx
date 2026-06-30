import { useMemo } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { Inbox, ListFilter, Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IssueRow } from './IssueRow';
import { BacklogEpicSection } from './BacklogEpicSection';
import { sectionKey, type EpicSection } from '../lib/groupByEpic';
import type { StoryPointValue } from '../lib/issueSystem';
import type { BacklogIssue } from './backlogTypes';

// ---------------------------------------------------------------------------
// BacklogQueue — the ordered, drag-to-reorder backlog.
//
// One flat list of IssueRow across every project (the #152 "lar único"). Rank
// is owned upstream; this component just emits the intended move and lets the
// data layer compute the new rank. DnD uses @hello-pangea/dnd — the same lib
// the projects kanban already runs, so there is one drag vocabulary in the app.
//
// States: loading skeleton · empty (cold) · empty (filtered) · populated.
// Pure presentational: zero fetching, callbacks out.
// ---------------------------------------------------------------------------

export interface BacklogQueueProps {
  issues: BacklogIssue[];
  isLoading?: boolean;
  /** True when filters/search are active — changes the empty-state copy. */
  isFiltered?: boolean;
  /** Highlighted row id (keyboard j/k navigation). */
  selectedId?: string | null;
  /** Fired on drop. `targetIndex` is the new position in the *current* list. */
  onReorder: (movedId: string, targetIndex: number) => void;
  onIssueClick?: (id: string) => void;
  /** Inline-estimate a row from its points pill. */
  onEstimate?: (issueId: string, points: StoryPointValue) => void;
  /** Cold empty-state CTA. */
  onCreateClick?: () => void;
  /** Filtered empty-state CTA. */
  onClearFilters?: () => void;
  /** Group the queue into collapsible Epic sections (#170). */
  grouped?: boolean;
  /** Precomputed sections (from groupIssuesByEpic). Required when `grouped`. */
  sections?: EpicSection[];
  /** Collapsed section keys (epic id or NO_EPIC_KEY). */
  collapsedEpicIds?: Set<string>;
  /** Toggle a section's collapse by its key. */
  onToggleCollapse?: (key: string) => void;
  className?: string;
}

const DROPPABLE_ID = 'mtech-backlog-queue';

// --- chrome -----------------------------------------------------------------

function QueueHeader({ count, points }: { count: number; points: number }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]/40 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)]">
        <Layers className="h-3.5 w-3.5" aria-hidden />
        {count} {count === 1 ? 'issue' : 'issues'}
      </span>
      {points > 0 && (
        <span
          data-mono
          title="Soma de story points estimados"
          className="inline-flex items-center rounded-full border border-[var(--mtech-border)] bg-[var(--mtech-surface)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--mtech-text-muted)]"
        >
          {points} pts
        </span>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div role="status" aria-label="Carregando backlog" className="divide-y divide-[var(--mtech-border)]">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex h-10 items-center gap-2.5 pl-3 pr-3">
          <div className="h-4 w-4 flex-shrink-0 rounded-[3px] bg-[var(--mtech-surface-elev)] animate-pulse" />
          <div className="h-3.5 w-12 flex-shrink-0 rounded bg-[var(--mtech-surface-elev)] animate-pulse" />
          <div
            className="h-3.5 rounded bg-[var(--mtech-surface-elev)] animate-pulse"
            style={{ width: `${42 + ((i * 11) % 38)}%` }}
          />
          <div className="ml-auto flex items-center gap-2.5">
            <div className="hidden h-4 w-14 rounded-full bg-[var(--mtech-surface-elev)] animate-pulse md:block" />
            <div className="h-4 w-16 rounded-full bg-[var(--mtech-surface-elev)] animate-pulse" />
            <div className="h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ColdEmpty({ onCreateClick }: { onCreateClick?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]">
        <Inbox className="h-5 w-5 text-[var(--mtech-text-subtle)]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--mtech-text)]">O backlog está limpo</h3>
      <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-[var(--mtech-text-subtle)]">
        Toda issue de todo projeto cai aqui primeiro. Crie a primeira e priorize
        arrastando para o topo.
      </p>
      {onCreateClick && (
        <Button
          size="sm"
          onClick={onCreateClick}
          className="mt-5 gap-1.5 bg-[var(--mtech-accent)] font-semibold text-black hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Criar issue
        </Button>
      )}
    </div>
  );
}

function FilteredEmpty({ onClearFilters }: { onClearFilters?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]">
        <ListFilter className="h-5 w-5 text-[var(--mtech-text-subtle)]" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--mtech-text)]">Nenhuma issue nesse recorte</h3>
      <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-[var(--mtech-text-subtle)]">
        Os filtros ativos não cruzam com nenhuma issue do backlog.
      </p>
      {onClearFilters && (
        <Button
          size="sm"
          variant="outline"
          onClick={onClearFilters}
          className="mt-5 gap-1.5 border-[var(--mtech-border)] text-[var(--mtech-text-muted)] hover:border-[var(--mtech-border-strong)] hover:text-[var(--mtech-text)]"
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

// --- component --------------------------------------------------------------

export function BacklogQueue({
  issues,
  isLoading = false,
  isFiltered = false,
  selectedId = null,
  onReorder,
  onIssueClick,
  onEstimate,
  onCreateClick,
  onClearFilters,
  grouped = false,
  sections = [],
  collapsedEpicIds,
  onToggleCollapse,
  className = '',
}: BacklogQueueProps) {
  const totalPoints = useMemo(
    () => issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
    [issues],
  );

  const shell = `mtech-scope overflow-hidden rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] ${className}`;

  if (isLoading) {
    return (
      <div className={shell} style={{ boxShadow: 'var(--mtech-shadow-card)' }}>
        <SkeletonRows />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className={shell} style={{ boxShadow: 'var(--mtech-shadow-card)' }}>
        {isFiltered ? (
          <FilteredEmpty onClearFilters={onClearFilters} />
        ) : (
          <ColdEmpty onCreateClick={onCreateClick} />
        )}
      </div>
    );
  }

  // Grouped view (#170): collapsible Epic sections. Drag-to-reorder is a flat
  // list affordance — grouping is a triage lens, so sections render statically.
  if (grouped) {
    return (
      <div className={shell} style={{ boxShadow: 'var(--mtech-shadow-card)' }}>
        <QueueHeader count={issues.length} points={totalPoints} />
        <div className="space-y-1 py-1">
          {sections.map((section) => {
            const key = sectionKey(section);
            return (
              <BacklogEpicSection
                key={key}
                section={section}
                collapsed={collapsedEpicIds?.has(key) ?? false}
                onToggle={() => onToggleCollapse?.(key)}
                selectedId={selectedId}
                onIssueClick={onIssueClick}
                onEstimate={onEstimate}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.index === source.index) return;
    onReorder(draggableId, destination.index);
  };

  return (
    <div className={shell} style={{ boxShadow: 'var(--mtech-shadow-card)' }}>
      <QueueHeader count={issues.length} points={totalPoints} />

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={DROPPABLE_ID}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[120px] divide-y divide-[var(--mtech-border)] transition-colors ${
                snapshot.isDraggingOver ? 'bg-[var(--mtech-accent-muted)]/20' : ''
              }`}
            >
              {issues.map((issue, index) => (
                <Draggable key={issue.id} draggableId={issue.id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      style={dragProvided.draggableProps.style}
                    >
                      <IssueRow
                        issue={issue}
                        onClick={onIssueClick}
                        onEstimate={onEstimate}
                        isSelected={selectedId === issue.id}
                        isDragging={dragSnapshot.isDragging}
                        dragHandleProps={dragProvided.dragHandleProps ?? undefined}
                        showEpicChip
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
