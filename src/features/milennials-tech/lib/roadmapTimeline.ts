// ---------------------------------------------------------------------------
// Roadmap timeline geometry (#166) — PURE projection of an epic onto a time
// window. Zero React, zero dates-as-Date-objects across boundaries: everything
// in/out is an ISO 'YYYY-MM-DD' string or a percent number. This is the unit
// the timeline gantt renders from, and the drag math (deltaDays -> new dates).
//
// All arithmetic runs in UTC day-numbers (epoch days). Parsing 'YYYY-MM-DD' with
// Date.UTC sidesteps timezone drift — a date is a calendar point, never an
// instant in the user's local zone.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

const MONTHS_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

export interface DateWindow {
  start: string;
  end: string;
}

export interface EpicDates {
  startDate: string | null;
  deadline: string | null;
}

export interface EpicBar {
  /** Left offset as a percent (0..100) of the window. */
  x: number;
  /** Width as a percent (0..100) of the window. */
  width: number;
  /** True when the epic has neither start nor deadline — nothing to place. */
  isPlaceholder: boolean;
  /** True when the real start is before the window (clipped) or unknown. */
  isOpenStart: boolean;
  /** True when the real deadline is after the window (clipped) or unknown. */
  isOpenEnd: boolean;
  /** False when the epic falls entirely outside the window (or is undated). */
  visible: boolean;
}

export interface AxisTick {
  label: string;
  x: number;
}

// --- date <-> day-number helpers --------------------------------------------

function toDays(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

function fromDays(days: number): string {
  const date = new Date(days * MS_PER_DAY);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(iso: string, delta: number): string {
  return fromDays(toDays(iso) + delta);
}

// ---------------------------------------------------------------------------
// projectEpicBar — geometry of one epic's bar within the window.
// ---------------------------------------------------------------------------

export function projectEpicBar(epic: EpicDates, window: DateWindow): EpicBar {
  const hasStart = epic.startDate != null;
  const hasEnd = epic.deadline != null;

  if (!hasStart && !hasEnd) {
    return { x: 0, width: 0, isPlaceholder: true, isOpenStart: false, isOpenEnd: false, visible: false };
  }

  const ws = toDays(window.start);
  const we = toDays(window.end);
  const span = we - ws;
  if (span <= 0) {
    return { x: 0, width: 0, isPlaceholder: false, isOpenStart: false, isOpenEnd: false, visible: false };
  }

  const rawStart = hasStart ? toDays(epic.startDate as string) : null;
  const rawEnd = hasEnd ? toDays(epic.deadline as string) : null;

  // Open sides anchor to the window edge; known sides use their real value.
  const segStart = rawStart ?? ws;
  const segEnd = rawEnd ?? we;

  // Entirely outside the window -> not rendered.
  if (segEnd < ws || segStart > we) {
    return { x: 0, width: 0, isPlaceholder: false, isOpenStart: false, isOpenEnd: false, visible: false };
  }

  const clippedStart = Math.max(segStart, ws);
  const clippedEnd = Math.min(segEnd, we);

  const isOpenStart = !hasStart || (rawStart as number) < ws;
  const isOpenEnd = !hasEnd || (rawEnd as number) > we;

  const x = ((clippedStart - ws) / span) * 100;
  const width = Math.max(0, ((clippedEnd - clippedStart) / span) * 100);

  return { x, width, isPlaceholder: false, isOpenStart, isOpenEnd, visible: true };
}

// ---------------------------------------------------------------------------
// buildTimeAxis — tick marks for the window. 'month' marks each month start;
// 'week' steps 7 days from the window start. Ticks are clamped to [0,100].
// ---------------------------------------------------------------------------

export function buildTimeAxis(window: DateWindow, granularity: 'month' | 'week'): AxisTick[] {
  const ws = toDays(window.start);
  const we = toDays(window.end);
  const span = we - ws;
  if (span <= 0) return [];

  const ticks: AxisTick[] = [];

  if (granularity === 'month') {
    const startDate = new Date(window.start);
    let y = startDate.getUTCFullYear();
    let m = startDate.getUTCMonth();
    // First month tick: clamp the window's opening month to x=0 so its label shows.
    let firstMonth = true;
    while (true) {
      const tickDay = Math.round(Date.UTC(y, m, 1) / MS_PER_DAY);
      if (tickDay > we) break;
      if (tickDay >= ws || firstMonth) {
        const x = Math.max(0, ((tickDay - ws) / span) * 100);
        ticks.push({ label: MONTHS_PT[m], x });
      }
      firstMonth = false;
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    return ticks;
  }

  for (let day = ws; day <= we; day += 7) {
    const iso = fromDays(day);
    const [, mm, dd] = iso.split('-');
    ticks.push({ label: `${dd}/${mm}`, x: ((day - ws) / span) * 100 });
  }
  return ticks;
}

// ---------------------------------------------------------------------------
// Drag math — both PURE, feed the optimistic date mutation.
// ---------------------------------------------------------------------------

/** Shift both ends by deltaDays, preserving duration. Null ends stay null. */
export function moveEpicDates(epic: EpicDates, deltaDays: number): EpicDates {
  return {
    startDate: epic.startDate ? addDays(epic.startDate, deltaDays) : null,
    deadline: epic.deadline ? addDays(epic.deadline, deltaDays) : null,
  };
}

/**
 * Move one edge to newDate. Clamps so the edge never crosses the opposite end
 * (a resize can shrink to a zero-length bar but never invert it).
 */
export function resizeEpicEdge(epic: EpicDates, edge: 'start' | 'end', newDate: string): EpicDates {
  if (edge === 'start') {
    const clamped =
      epic.deadline && toDays(newDate) > toDays(epic.deadline) ? epic.deadline : newDate;
    return { startDate: clamped, deadline: epic.deadline };
  }
  const clamped =
    epic.startDate && toDays(newDate) < toDays(epic.startDate) ? epic.startDate : newDate;
  return { startDate: epic.startDate, deadline: clamped };
}
