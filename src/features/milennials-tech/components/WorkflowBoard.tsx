import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  DragDropContext,
  Droppable,
  type DropResult,
  type DragStart,
  type ResponderProvided,
} from '@hello-pangea/dnd';
import {
  ISSUE_STATUS_CONFIG,
  BOARD_STATUS_ORDER,
  type IssueStatus,
} from '../lib/issueSystem';
import { BoardColumn } from './BoardColumn';
import type { IssueCardData } from './IssueCard';
import { WorkflowCard } from './WorkflowCard';
import type { WorkflowBoardProps } from './workflowBoardContract';

// ---------------------------------------------------------------------------
// WorkflowBoard — the presentational transition board (slice #157).
//
// Renders the fixed workflow (BOARD_STATUS_ORDER) as horizontal lanes and turns
// drag-and-drop into a *transition*: the moment a card is lifted, every legal
// destination lights up in its own status hue and every illegal one dims to a
// no-drop ghost. Legality is never computed here — it is read, per target, from
// the injected `isLegalTarget` predicate, so the engineer owns the rules and
// this layer owns the read of them.
//
// The same predicate drives the keyboard path: illegal lanes are flagged
// `isDropDisabled`, which makes rbd's accessible keyboard sensor skip them when
// a lifted card is arrowed across columns. One source of truth, two inputs.
//
// Zero data, zero query, zero supabase. Every effect is a callback out.
// The container (WorkflowBoardContainer) wires this against WorkflowBoardProps.
// ---------------------------------------------------------------------------

type LaneState = 'idle' | 'source' | 'legal' | 'illegal';

const REJECTABLE: ReadonlySet<IssueStatus> = new Set<IssueStatus>([
  'REVIEW',
  'AWAITING_APPROVAL',
]);

// ---------------------------------------------------------------------------
// Lane drop-zone styling — the central drag affordance.
//   legal + over   → status hue fill, 70% inset ring (the live target)
//   legal + armed  → faint 6% fill, 28% inset ring (reachable, not hovered)
//   source + over  → neutral ring (snap-back)
// illegal dimming is a className concern (opacity), handled at the call site.
// ---------------------------------------------------------------------------

function laneStyle(state: LaneState, isOver: boolean, color: string, bg: string) {
  if (state === 'legal') {
    return isOver
      ? {
          background: bg,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 70%, transparent)`,
        }
      : {
          background: `color-mix(in srgb, ${color} 6%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 28%, transparent)`,
        };
  }
  if (state === 'source' && isOver) {
    return { boxShadow: 'inset 0 0 0 1px var(--mtech-border-strong)' };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Keyboard legend — always-on, subtle. Teaches the model without a modal.
// ---------------------------------------------------------------------------

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      data-mono
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] px-1 text-[10px] leading-none text-[var(--mtech-text-muted)]"
    >
      {children}
    </kbd>
  );
}

function KeyboardLegend() {
  const items: Array<{ keys: ReactNode; label: string }> = [
    { keys: <Kbd>Espaço</Kbd>, label: 'pegar / soltar' },
    {
      keys: (
        <span className="flex items-center gap-0.5">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
        </span>
      ),
      label: 'mover (só destinos válidos)',
    },
    { keys: <Kbd>Enter</Kbd>, label: 'abrir' },
    { keys: <Kbd>B</Kbd>, label: 'bloquear' },
    { keys: <Kbd>R</Kbd>, label: 'reprovar' },
    { keys: <Kbd>Esc</Kbd>, label: 'cancelar' },
  ];
  return (
    <div
      role="note"
      aria-label="Atalhos de teclado do board"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--mtech-border)] px-1 pt-3"
    >
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {it.keys}
          <span className="text-[11px] text-[var(--mtech-text-subtle)]">{it.label}</span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty board — only when there are no lanes at all to render.
// ---------------------------------------------------------------------------

function BoardEmpty() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[var(--mtech-radius-lg)] border border-dashed border-[var(--mtech-border)] text-center">
      <p className="text-[13px] font-medium text-[var(--mtech-text-muted)]">
        Nenhuma issue neste sprint
      </p>
      <p className="mt-1 text-[12px] text-[var(--mtech-text-subtle)]">
        Puxe issues do backlog para começar o fluxo
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export function WorkflowBoard({
  columns,
  isLegalTarget,
  onMove,
  onReject,
  onToggleBlocked,
  onOpenCard,
  hideKeyboardLegend = false,
}: WorkflowBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<IssueStatus | null>(null);

  const columnByStatus = useMemo(() => {
    const map = new Map<IssueStatus, IssueCardData[]>();
    for (const c of columns) map.set(c.status, c.issues);
    return map;
  }, [columns]);

  const hasAnyLegalTarget = useCallback(
    (id: string) => BOARD_STATUS_ORDER.some((s) => isLegalTarget(id, s)),
    [isLegalTarget],
  );

  const laneStateFor = useCallback(
    (status: IssueStatus): LaneState => {
      if (!activeId) return 'idle';
      if (status === activeSource) return 'source';
      return isLegalTarget(activeId, status) ? 'legal' : 'illegal';
    },
    [activeId, activeSource, isLegalTarget],
  );

  const onDragStart = useCallback((start: DragStart, provided: ResponderProvided) => {
    setActiveId(start.draggableId);
    setActiveSource(start.source.droppableId as IssueStatus);
    provided.announce(
      'Issue levantada. Setas movem entre colunas válidas, espaço solta, Esc cancela.',
    );
  }, []);

  const onDragEnd = useCallback(
    (result: DropResult, provided: ResponderProvided) => {
      setActiveId(null);
      setActiveSource(null);

      const { draggableId, source, destination } = result;
      if (!destination) {
        provided.announce('Movimento cancelado.');
        return;
      }
      const to = destination.droppableId as IssueStatus;
      if (to === source.droppableId) {
        provided.announce('Issue mantida na mesma coluna.');
        return;
      }
      // Defense in depth: isDropDisabled already blocks illegal lanes.
      if (!isLegalTarget(draggableId, to)) {
        provided.announce('Transição inválida. Issue retornada.');
        return;
      }
      onMove(draggableId, to);
      provided.announce(`Movida para ${ISSUE_STATUS_CONFIG[to].label}.`);
    },
    [isLegalTarget, onMove],
  );

  if (columns.length === 0) {
    return <BoardEmpty />;
  }

  return (
    <div className="flex flex-col gap-3">
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="relative">
          {/* Edge fades — signal horizontal overflow without stealing a control. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[var(--mtech-bg)] to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[var(--mtech-bg)] to-transparent"
          />

          <div
            className="overflow-x-auto pb-2 scrollbar-apple"
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="flex gap-4 px-1" style={{ minWidth: 'max-content' }}>
              {BOARD_STATUS_ORDER.map((status) => {
                const issues = columnByStatus.get(status) ?? [];
                const cfg = ISSUE_STATUS_CONFIG[status];
                const state = laneStateFor(status);
                const rejectable = REJECTABLE.has(status);

                return (
                  <BoardColumn key={status} status={status} count={issues.length}>
                    <Droppable droppableId={status} isDropDisabled={state === 'illegal'}>
                      {(provided, snapshot) => {
                        const isOver = snapshot.isDraggingOver;
                        return (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            data-lane-state={state}
                            className={`flex min-h-[120px] flex-1 flex-col gap-2 rounded-[var(--mtech-radius-md)] p-1 transition-[background,box-shadow] duration-150 ease-out motion-reduce:transition-none ${
                              state === 'illegal' ? 'cursor-not-allowed opacity-40' : ''
                            }`}
                            style={laneStyle(state, isOver, cfg.color, cfg.bg)}
                          >
                            {/* Drop hint — only the lane being hovered. */}
                            {state === 'legal' && isOver && (
                              <div
                                className="flex items-center justify-center rounded-[var(--mtech-radius-sm)] py-1 text-[10px] font-semibold uppercase tracking-widest"
                                style={{ color: cfg.color }}
                              >
                                Soltar para {cfg.label}
                              </div>
                            )}

                            {issues.map((issue, i) => (
                              <WorkflowCard
                                key={issue.id}
                                issue={issue}
                                index={i}
                                canReject={rejectable}
                                draggable={hasAnyLegalTarget(issue.id)}
                                isAnyDragActive={activeId !== null}
                                onOpenCard={onOpenCard}
                                onReject={onReject}
                                onToggleBlocked={onToggleBlocked}
                              />
                            ))}

                            {provided.placeholder}

                            {/* Empty-lane affordances */}
                            {issues.length === 0 && (
                              <div className="flex flex-1 items-center justify-center py-6">
                                {state === 'legal' ? (
                                  <span
                                    className="rounded-[var(--mtech-radius-sm)] border border-dashed px-3 py-2 text-[11px] font-medium"
                                    style={{
                                      color: cfg.color,
                                      borderColor: `color-mix(in srgb, ${cfg.color} 45%, transparent)`,
                                    }}
                                  >
                                    Soltar aqui
                                  </span>
                                ) : (
                                  !activeId && (
                                    <span className="text-[11px] text-[var(--mtech-text-subtle)]">
                                      Sem issues
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    </Droppable>
                  </BoardColumn>
                );
              })}
            </div>
          </div>
        </div>
      </DragDropContext>

      {!hideKeyboardLegend && <KeyboardLegend />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkflowBoardSkeleton — coherent loading state for the container to render
// while the first page of issues resolves. Mirrors the lane rhythm exactly.
// ---------------------------------------------------------------------------

export function WorkflowBoardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="Carregando board">
      <div className="overflow-hidden pb-2">
        <div className="flex gap-4 px-1" style={{ minWidth: 'max-content' }}>
          {BOARD_STATUS_ORDER.map((status, col) => {
            const cfg = ISSUE_STATUS_CONFIG[status];
            return (
              <section key={status} className="flex w-[300px] flex-shrink-0 flex-col">
                <div className="mb-3 flex items-center gap-2 border-b border-[var(--mtech-border)] pb-3">
                  <span
                    className="h-3.5 w-3.5 flex-shrink-0 rounded-full opacity-40"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="h-2.5 w-20 rounded bg-[var(--mtech-surface-elev)]" />
                </div>
                <div className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none">
                  {Array.from({ length: ((col + 2) % 3) + 1 }).map((_, j) => (
                    <div
                      key={j}
                      className="space-y-2.5 rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)] py-2.5 pl-3.5 pr-3"
                    >
                      <div className="h-3 w-3/4 rounded bg-[var(--mtech-surface-elev)]" />
                      <div className="h-3 w-1/2 rounded bg-[var(--mtech-surface-elev)]" />
                      <div className="flex items-center justify-between pt-1">
                        <div className="h-3.5 w-10 rounded bg-[var(--mtech-surface-elev)]" />
                        <div className="h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)]" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
