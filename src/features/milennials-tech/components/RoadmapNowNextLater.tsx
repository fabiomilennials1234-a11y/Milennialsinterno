import { useMemo } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { epicColorFromKey } from '../lib/issueSystem';
import { computeReorderNeighbors } from '../lib/backlogRanking';
import { EpicProgressBar } from './EpicProgressBar';
import type { EpicRollup } from '../lib/rollup';
import type { RoadmapBucket, TechEpicRow } from '../hooks/useTechEpics';

// ---------------------------------------------------------------------------
// RoadmapNowNextLater (#166) — strategic prioritisation board. Three buckets
// (NOW / NEXT / LATER) plus a "Sem direção" source strip of epics that haven't
// entered the roadmap yet. Drag an epic between buckets (or back to the strip to
// remove it). Same DnD vocabulary as the backlog (@hello-pangea/dnd). Pure
// presentational: rank/bucket are owned upstream; we only emit the intent.
//
// The three buckets carry a deliberate URGENCY GRADIENT — Now reads hottest
// (gold pip), Later coolest (subtle pip) — so the eye sorts priority before it
// reads a single word. Cards reuse EpicProgressBar so an epic's completion is
// the same material here as on its header and in the backlog.
// ---------------------------------------------------------------------------

const BUCKETS: {
  id: RoadmapBucket;
  label: string;
  hint: string;
  /** Urgency pip color — hot (Now) to cool (Later). */
  pip: string;
  /** Top-rail opacity — reinforces the urgency gradient at column scale. */
  rail: number;
  /** Tailored empty line, so an idle bucket still speaks. */
  empty: string;
}[] = [
  { id: 'NOW', label: 'Now', hint: 'Em foco agora', pip: 'var(--mtech-accent)', rail: 0.9, empty: 'Nada em foco' },
  { id: 'NEXT', label: 'Next', hint: 'A seguir', pip: 'var(--mtech-text-muted)', rail: 0.45, empty: 'Fila vazia' },
  { id: 'LATER', label: 'Later', hint: 'No horizonte', pip: 'var(--mtech-text-subtle)', rail: 0.22, empty: 'Sem planos distantes' },
];

const SOURCE_DROPPABLE = 'roadmap-source';

const ZERO_ROLLUP: EpicRollup = {
  totalPoints: 0,
  donePoints: 0,
  progressPct: 0,
  issueCount: 0,
  doneCount: 0,
};

export interface RoadmapNowNextLaterProps {
  epics: TechEpicRow[];
  rollups: Map<string, EpicRollup>;
  onMove: (input: {
    id: string;
    bucket: RoadmapBucket | null;
    prevRank: string | null;
    nextRank: string | null;
  }) => void;
  onEpicClick?: (id: string) => void;
}

function byRank(a: TechEpicRow, b: TechEpicRow): number {
  return (a.roadmapRank ?? '').localeCompare(b.roadmapRank ?? '');
}

function EpicCard({
  epic,
  rollup,
  onClick,
  isDragging,
}: {
  epic: TechEpicRow;
  rollup?: EpicRollup;
  onClick?: (id: string) => void;
  isDragging: boolean;
}) {
  const color = epicColorFromKey(epic.projectId);

  return (
    <button
      type="button"
      onClick={() => onClick?.(epic.id)}
      className={`group relative block w-full cursor-grab overflow-hidden rounded-[var(--mtech-radius-md)] border bg-[var(--mtech-surface-elev)] py-3 pl-3.5 pr-3 text-left transition-[border-color,box-shadow] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--mtech-accent)]/60 ${
        isDragging
          ? 'border-[var(--mtech-accent)] ring-1 ring-[var(--mtech-accent)]'
          : 'border-[var(--mtech-border)] hover:border-[var(--mtech-border-strong)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.3)]'
      }`}
      style={isDragging ? { boxShadow: 'var(--mtech-shadow-card)' } : undefined}
    >
      {/* project-color lateral accent */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="block text-[13px] font-medium leading-snug text-[var(--mtech-text)]">
        {epic.title}
      </span>
      <div className="mt-2.5 flex items-center gap-2">
        {epic.key && (
          <span
            data-mono
            className="flex-shrink-0 rounded border border-[var(--mtech-border)] bg-[var(--mtech-surface)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--mtech-text-muted)]"
          >
            {epic.key}
          </span>
        )}
        <EpicProgressBar
          rollup={rollup ?? ZERO_ROLLUP}
          color={color}
          size="sm"
          className="flex-1"
        />
      </div>
    </button>
  );
}

export function RoadmapNowNextLater({
  epics,
  rollups,
  onMove,
  onEpicClick,
}: RoadmapNowNextLaterProps) {
  const { source, byBucket } = useMemo(() => {
    const src: TechEpicRow[] = [];
    const buckets: Record<RoadmapBucket, TechEpicRow[]> = { NOW: [], NEXT: [], LATER: [] };
    for (const e of epics) {
      if (e.roadmapBucket) buckets[e.roadmapBucket].push(e);
      else src.push(e);
    }
    (Object.keys(buckets) as RoadmapBucket[]).forEach((k) => buckets[k].sort(byRank));
    src.sort((a, b) => a.title.localeCompare(b.title));
    return { source: src, byBucket: buckets };
  }, [epics]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, draggableId, source: from } = result;
    if (!destination) return;
    if (destination.droppableId === from.droppableId && destination.index === from.index) return;

    if (destination.droppableId === SOURCE_DROPPABLE) {
      onMove({ id: draggableId, bucket: null, prevRank: null, nextRank: null });
      return;
    }

    const bucket = destination.droppableId as RoadmapBucket;
    const ordered = byBucket[bucket].map((e) => ({ id: e.id, rank: e.roadmapRank ?? '' }));
    const { prevRank, nextRank } = computeReorderNeighbors(ordered, draggableId, destination.index);
    onMove({ id: draggableId, bucket, prevRank, nextRank });
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <Droppable droppableId={SOURCE_DROPPABLE} direction="horizontal">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex min-h-[64px] flex-wrap gap-2 rounded-[var(--mtech-radius-md)] border border-dashed p-2.5 transition-colors ${
                snapshot.isDraggingOver
                  ? 'border-[var(--mtech-accent)]/60 bg-[var(--mtech-accent-muted)]/15'
                  : 'border-[var(--mtech-border)]'
              }`}
            >
              <span className="w-full px-1 pb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--mtech-text-subtle)]">
                Sem direção · arraste para priorizar
              </span>
              {source.length === 0 && (
                <span className="px-1 text-[12px] text-[var(--mtech-text-subtle)]">
                  Todos os epics estão no roadmap.
                </span>
              )}
              {source.map((epic, index) => (
                <Draggable key={epic.id} draggableId={epic.id} index={index}>
                  {(dp, ds) => (
                    <div
                      ref={dp.innerRef}
                      {...dp.draggableProps}
                      {...dp.dragHandleProps}
                      style={dp.draggableProps.style}
                      className="w-[220px]"
                    >
                      <EpicCard
                        epic={epic}
                        rollup={rollups.get(epic.id)}
                        onClick={onEpicClick}
                        isDragging={ds.isDragging}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {BUCKETS.map((bucket) => {
            const count = byBucket[bucket.id].length;
            return (
              <div
                key={bucket.id}
                className="relative flex flex-col overflow-hidden rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)]"
                style={{ boxShadow: 'var(--mtech-shadow-card)' }}
              >
                {/* urgency rail — column-scale heat cue */}
                <span
                  className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
                  style={{
                    background: `linear-gradient(to right, transparent, ${bucket.pip}, transparent)`,
                    opacity: bucket.rail,
                  }}
                  aria-hidden
                />
                <div className="flex items-baseline justify-between border-b border-[var(--mtech-border)] px-3 py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="h-2 w-2 flex-shrink-0 translate-y-[-1px] rounded-full"
                      style={{ backgroundColor: bucket.pip }}
                      aria-hidden
                    />
                    <span className="text-sm font-semibold text-[var(--mtech-text)]">{bucket.label}</span>
                    {count > 0 && (
                      <span
                        data-mono
                        className="text-[11px] font-semibold tabular-nums text-[var(--mtech-text-subtle)]"
                      >
                        {count}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--mtech-text-subtle)]">{bucket.hint}</span>
                </div>
                <Droppable droppableId={bucket.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex min-h-[180px] flex-1 flex-col gap-2 p-2.5 transition-colors ${
                        snapshot.isDraggingOver
                          ? 'bg-[var(--mtech-accent-muted)]/25 shadow-[inset_0_0_0_1px_var(--mtech-accent)]'
                          : ''
                      }`}
                    >
                      {count === 0 && !snapshot.isDraggingOver && (
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                          <span
                            className="h-1.5 w-1.5 rounded-full opacity-60"
                            style={{ backgroundColor: bucket.pip }}
                            aria-hidden
                          />
                          <span className="text-[11px] text-[var(--mtech-text-subtle)]">{bucket.empty}</span>
                        </div>
                      )}
                      {byBucket[bucket.id].map((epic, index) => (
                        <Draggable key={epic.id} draggableId={epic.id} index={index}>
                          {(dp, ds) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              {...dp.dragHandleProps}
                              style={dp.draggableProps.style}
                            >
                              <EpicCard
                                epic={epic}
                                rollup={rollups.get(epic.id)}
                                onClick={onEpicClick}
                                isDragging={ds.isDragging}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
