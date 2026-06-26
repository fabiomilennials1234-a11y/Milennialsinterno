import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { epicColorFromKey } from '../lib/issueSystem';
import {
  projectEpicBar,
  buildTimeAxis,
  moveEpicDates,
  resizeEpicEdge,
  type DateWindow,
  type EpicDates,
} from '../lib/roadmapTimeline';
import type { EpicRollup } from '../lib/rollup';
import type { TechEpicRow } from '../hooks/useTechEpics';

// ---------------------------------------------------------------------------
// RoadmapTimeline (#166) — lightweight gantt of epics across a 3-month window.
//
// Drag is NATIVE pointer math, not @hello-pangea/dnd: dragging a bar means
// translating PIXELS into CALENDAR DAYS along the window scale, which pangea's
// list-reorder model can't express. The bar BODY moves both dates (preserving
// duration); the two EDGE handles resize one side. The pure geometry lives in
// lib/roadmapTimeline (projectEpicBar / moveEpicDates / resizeEpicEdge); this
// component is the wiring + the optimistic preview while a drag is in flight.
//
// Craft notes: month gridlines anchor the eye to the axis; a live date pill
// floats over the bar mid-drag so re-planning is read, not guessed; the today
// marker carries a cap dot so it reads as "now" and not a stray rule.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;
const LABEL_COL = 200; // px reserved for the epic title column

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function isoDays(iso: string): number {
  return Math.round(Date.parse(iso) / MS_PER_DAY);
}

/** "12 mar" — compact day label for the drag pill. */
function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS_PT[d.getUTCMonth()]}`;
}

/** Human range for the at-rest tooltip — covers every open/undated state. */
function fmtRange(dates: EpicDates): string {
  if (!dates.startDate && !dates.deadline) return 'sem datas';
  if (dates.startDate && dates.deadline) return `${fmtDay(dates.startDate)} – ${fmtDay(dates.deadline)}`;
  if (dates.startDate) return `${fmtDay(dates.startDate)} · sem prazo`;
  return `início aberto · ${fmtDay(dates.deadline)}`;
}

/** 3-month window anchored on the current quarter, shifted by `offsetMonths`. */
function quarterWindow(offsetMonths: number): DateWindow {
  const now = new Date();
  const qStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  const start = new Date(Date.UTC(now.getUTCFullYear(), qStartMonth + offsetMonths, 1));
  // end = last day of the 3rd month (first-of-next minus one day)
  const endExclusive = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
  const end = new Date(endExclusive.getTime() - MS_PER_DAY);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function windowLabel(win: DateWindow): string {
  const s = new Date(win.start);
  const e = new Date(win.end);
  return `${MONTHS_PT[s.getUTCMonth()]} – ${MONTHS_PT[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
}

interface DragState {
  epicId: string;
  mode: 'move' | 'start' | 'end';
  startClientX: number;
  pxPerDay: number;
  orig: EpicDates;
  preview: EpicDates;
}

export interface RoadmapTimelineProps {
  epics: TechEpicRow[];
  rollups: Map<string, EpicRollup>;
  onCommitDates: (input: { id: string; startDate: string | null; deadline: string | null }) => void;
  onEpicClick?: (id: string) => void;
}

export function RoadmapTimeline({ epics, rollups, onCommitDates, onEpicClick }: RoadmapTimelineProps) {
  const [offsetMonths, setOffsetMonths] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const win = useMemo(() => quarterWindow(offsetMonths), [offsetMonths]);
  const spanDays = useMemo(() => isoDays(win.end) - isoDays(win.start), [win]);
  const axis = useMemo(() => buildTimeAxis(win, 'month'), [win]);

  const todayBar = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const x = ((isoDays(today) - isoDays(win.start)) / spanDays) * 100;
    return x >= 0 && x <= 100 ? x : null;
  }, [win, spanDays]);

  const ordered = useMemo(
    () =>
      [...epics].sort((a, b) => {
        const as = a.startDate ?? a.deadline ?? '9999';
        const bs = b.startDate ?? b.deadline ?? '9999';
        return as.localeCompare(bs) || a.title.localeCompare(b.title);
      }),
    [epics],
  );

  const beginDrag = useCallback(
    (epic: TechEpicRow, mode: DragState['mode'], clientX: number) => {
      const trackWidth = trackRef.current?.getBoundingClientRect().width ?? 0;
      if (trackWidth <= 0 || spanDays <= 0) return;
      const orig: EpicDates = { startDate: epic.startDate, deadline: epic.deadline };
      setDrag({
        epicId: epic.id,
        mode,
        startClientX: clientX,
        pxPerDay: trackWidth / spanDays,
        orig,
        preview: orig,
      });
    },
    [spanDays],
  );

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const deltaDays = Math.round((e.clientX - drag.startClientX) / drag.pxPerDay);
      let preview: EpicDates;
      if (drag.mode === 'move') {
        preview = moveEpicDates(drag.orig, deltaDays);
      } else {
        const anchorIso = drag.mode === 'start' ? drag.orig.startDate : drag.orig.deadline;
        if (!anchorIso) {
          preview = drag.orig;
        } else {
          const newIso = new Date((isoDays(anchorIso) + deltaDays) * MS_PER_DAY).toISOString().slice(0, 10);
          preview = resizeEpicEdge(drag.orig, drag.mode, newIso);
        }
      }
      setDrag((prev) => (prev ? { ...prev, preview } : prev));
    };

    const onUp = () => {
      setDrag((prev) => {
        if (prev) {
          const changed =
            prev.preview.startDate !== prev.orig.startDate ||
            prev.preview.deadline !== prev.orig.deadline;
          if (changed) {
            onCommitDates({
              id: prev.epicId,
              startDate: prev.preview.startDate,
              deadline: prev.preview.deadline,
            });
          }
        }
        return null;
      });
    };

    globalThis.addEventListener('pointermove', onMove);
    globalThis.addEventListener('pointerup', onUp);
    return () => {
      globalThis.removeEventListener('pointermove', onMove);
      globalThis.removeEventListener('pointerup', onUp);
    };
  }, [drag, onCommitDates]);

  return (
    <div
      className="overflow-hidden rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface)]"
      style={{ boxShadow: 'var(--mtech-shadow-card)' }}
    >
      <div className="flex items-center justify-between border-b border-[var(--mtech-border)] px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]">
            Trimestre
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--mtech-text)]">
            {windowLabel(win)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border)] bg-[var(--mtech-bg)] p-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-[var(--mtech-text-muted)] hover:bg-[var(--mtech-surface-elev)] hover:text-[var(--mtech-text)]"
            onClick={() => setOffsetMonths((o) => o - 1)}
            aria-label="Trimestre anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={offsetMonths === 0}
            className="h-7 px-2.5 text-[11px] font-medium text-[var(--mtech-text-muted)] hover:bg-[var(--mtech-surface-elev)] hover:text-[var(--mtech-text)] disabled:opacity-40"
            onClick={() => setOffsetMonths(0)}
          >
            Hoje
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-[var(--mtech-text-muted)] hover:bg-[var(--mtech-surface-elev)] hover:text-[var(--mtech-text)]"
            onClick={() => setOffsetMonths((o) => o + 1)}
            aria-label="Próximo trimestre"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Axis */}
      <div className="flex border-b border-[var(--mtech-border)] bg-[var(--mtech-bg)]/40">
        <div
          className="flex items-center px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]"
          style={{ width: LABEL_COL, minWidth: LABEL_COL }}
        >
          Epic
        </div>
        <div className="relative h-8 flex-1">
          {axis.map((tick) => (
            <span
              key={tick.label + tick.x}
              className="absolute top-2 pl-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mtech-text-subtle)]"
              style={{ left: `${tick.x}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="relative">
        {ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--mtech-radius-lg)] border border-[var(--mtech-border)] bg-[var(--mtech-surface-elev)]">
              <CalendarRange className="h-5 w-5 text-[var(--mtech-text-subtle)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--mtech-text)]">Nada no radar ainda</h3>
            <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-[var(--mtech-text-subtle)]">
              Defina início e prazo nos epics e eles aparecem aqui, posicionados no
              trimestre. Arraste para remarcar.
            </p>
          </div>
        ) : (
          <>
            {/* month gridlines — anchor bars to the axis, painted behind the rows */}
            <div className="pointer-events-none absolute inset-y-0 right-0 z-0" style={{ left: LABEL_COL }} aria-hidden>
              {axis.map((tick) =>
                tick.x > 0 ? (
                  <div
                    key={`grid-${tick.label}-${tick.x}`}
                    className="absolute inset-y-0 w-px bg-[var(--mtech-border)]/50"
                    style={{ left: `${tick.x}%` }}
                  />
                ) : null,
              )}
            </div>

            <div className="relative z-10">
              {ordered.map((epic) => {
                const isThisDragging = drag?.epicId === epic.id;
                const live: EpicDates = isThisDragging
                  ? (drag as DragState).preview
                  : { startDate: epic.startDate, deadline: epic.deadline };
                const bar = projectEpicBar(live, win);
                const color = epicColorFromKey(epic.projectId);
                const pct = rollups.get(epic.id)?.progressPct ?? 0;

                return (
                  <div
                    key={epic.id}
                    className="flex items-center border-b border-[var(--mtech-border)]/60 transition-colors last:border-0 hover:bg-[var(--mtech-surface-elev)]/30"
                  >
                    <button
                      type="button"
                      onClick={() => onEpicClick?.(epic.id)}
                      className="flex items-center gap-2.5 truncate px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--mtech-accent)]/60"
                      style={{ width: LABEL_COL, minWidth: LABEL_COL }}
                    >
                      <span
                        className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 self-start rounded-[3px]"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] leading-tight text-[var(--mtech-text)]">
                          {epic.title}
                        </span>
                        {epic.key && (
                          <span
                            data-mono
                            className="block truncate text-[10px] uppercase tracking-wide text-[var(--mtech-text-subtle)]"
                          >
                            {epic.key}
                          </span>
                        )}
                      </span>
                    </button>

                    <div
                      ref={epic === ordered[0] ? trackRef : undefined}
                      className="relative h-9 flex-1"
                    >
                      {bar.visible ? (
                        <div
                          className={`group absolute top-1.5 flex h-6 items-center rounded-[6px] border transition-shadow ${
                            isThisDragging
                              ? 'z-20 ring-1 ring-[var(--mtech-accent)]'
                              : 'z-0 hover:shadow-[0_4px_14px_rgba(0,0,0,0.35)]'
                          }`}
                          style={{
                            left: `${bar.x}%`,
                            width: `max(${bar.width}%, 14px)`,
                            backgroundColor: `color-mix(in srgb, ${color} 20%, var(--mtech-surface-elev))`,
                            backgroundImage:
                              'linear-gradient(to bottom, rgba(255,255,255,0.07), rgba(0,0,0,0.07))',
                            borderColor: `color-mix(in srgb, ${color} 42%, transparent)`,
                            borderLeftWidth: bar.isOpenStart ? 0 : undefined,
                            borderRightWidth: bar.isOpenEnd ? 0 : undefined,
                            boxShadow: isThisDragging ? 'var(--mtech-shadow-card)' : undefined,
                          }}
                        >
                          {/* progress fill */}
                          <div
                            className="absolute inset-y-0 left-0 rounded-l-[5px]"
                            style={{
                              width: `${pct}%`,
                              backgroundImage: `linear-gradient(to right, color-mix(in srgb, ${color} 88%, transparent), color-mix(in srgb, ${color} 58%, transparent))`,
                            }}
                            aria-hidden
                          />

                          {/* open-edge feathers — the bar continues past the window */}
                          {bar.isOpenStart && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-y-0 left-0 w-5"
                              style={{ background: 'linear-gradient(to right, var(--mtech-surface), transparent)' }}
                            />
                          )}
                          {bar.isOpenEnd && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-y-0 right-0 w-5"
                              style={{ background: 'linear-gradient(to left, var(--mtech-surface), transparent)' }}
                            />
                          )}

                          {/* live date pill — only while this bar is being dragged */}
                          {isThisDragging && (
                            <div
                              data-mono
                              className="pointer-events-none absolute -top-1.5 left-0 z-30 -translate-y-full whitespace-nowrap rounded-[6px] border border-[var(--mtech-border-strong)] bg-[var(--mtech-surface-elev)] px-2 py-1 text-[10px] font-semibold tabular-nums text-[var(--mtech-text)]"
                              style={{ boxShadow: 'var(--mtech-shadow-card)' }}
                            >
                              {fmtDay(live.startDate)} → {fmtDay(live.deadline)}
                            </div>
                          )}

                          {/* at-rest tooltip — surfaces title + range + progress on hover */}
                          {!isThisDragging && (
                            <div
                              role="tooltip"
                              className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none"
                            >
                              <div
                                className="whitespace-nowrap rounded-[var(--mtech-radius-md)] border border-[var(--mtech-border-strong)] bg-[var(--mtech-surface-elev)] px-2.5 py-1.5"
                                style={{ boxShadow: 'var(--mtech-shadow-card)' }}
                              >
                                <div className="text-[11px] font-medium text-[var(--mtech-text)]">{epic.title}</div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--mtech-text-muted)]">
                                  <span data-mono>{fmtRange(live)}</span>
                                  <span className="text-[var(--mtech-text-subtle)]">·</span>
                                  <span className="tabular-nums">{pct}%</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* resize: start */}
                          <span
                            role="separator"
                            aria-label="Mover início"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              beginDrag(epic, 'start', e.clientX);
                            }}
                            className="absolute left-0 z-10 flex h-full w-2.5 cursor-ew-resize items-center justify-start rounded-l-[6px] opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <span className="ml-[3px] h-3 w-0.5 rounded-full bg-[var(--mtech-text)]/55" aria-hidden />
                          </span>
                          {/* body move */}
                          <span
                            onPointerDown={(e) => beginDrag(epic, 'move', e.clientX)}
                            className="relative z-0 h-full flex-1 cursor-grab active:cursor-grabbing"
                          />
                          {/* resize: end */}
                          <span
                            role="separator"
                            aria-label="Mover fim"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              beginDrag(epic, 'end', e.clientX);
                            }}
                            className="absolute right-0 z-10 flex h-full w-2.5 cursor-ew-resize items-center justify-end rounded-r-[6px] opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <span className="mr-[3px] h-3 w-0.5 rounded-full bg-[var(--mtech-text)]/55" aria-hidden />
                          </span>
                        </div>
                      ) : (
                        <span className="absolute left-3 top-2.5 text-[11px] text-[var(--mtech-text-subtle)]">
                          {bar.isPlaceholder ? 'sem datas' : 'fora da janela'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* today marker — overlay scoped to the track region (right of the label col) */}
            {todayBar !== null && (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-30" style={{ left: LABEL_COL }} aria-hidden>
                <div className="absolute inset-y-0 w-px bg-[var(--mtech-accent)]" style={{ left: `${todayBar}%` }}>
                  <span className="absolute -left-[2.5px] -top-px h-[5px] w-[5px] rounded-full bg-[var(--mtech-accent)]" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
