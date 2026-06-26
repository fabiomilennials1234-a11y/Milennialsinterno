// ---------------------------------------------------------------------------
// Burndown series (#162) — PURE arithmetic, no React, no Supabase.
//
// The DB (tech_sprint_burndown_events) emits the raw event stream: one SCOPE_ADD
// per issue that joined the sprint after it started, one COMPLETE per DONE issue
// on the day it last reached DONE. This module folds that stream over the sprint
// calendar into the three lines the chart draws:
//
//   ideal     — the straight committed -> 0 plan. Reference, every day filled.
//   remaining — committed + scope adds so far - completions so far. Steps UP on
//               an add, DROPS on a completion. null for days after `asOf` so the
//               line stops at today instead of lying its way to zero.
//   scope     — committed + scope adds so far. The envelope ceiling. null after
//               `asOf`.
//
// All dates are UTC calendar days ("YYYY-MM-DD"). We never construct a local
// Date from a day string for arithmetic — that drifts across timezones. We parse
// to a UTC epoch, step by whole days, and compare day strings lexicographically
// (valid because the format is zero-padded ISO). `null` points count as 0 at the
// source, so every event already carries an integer.
// ---------------------------------------------------------------------------

export interface BurndownEvent {
  /** ISO day "YYYY-MM-DD". */
  date: string;
  type: 'SCOPE_ADD' | 'COMPLETE';
  points: number;
}

export interface BurndownInput {
  /** Frozen commitment baseline (committed_points_snapshot). */
  committedPoints: number;
  /** Sprint start day (started_at ?? start_date), ISO "YYYY-MM-DD". */
  startDate: string;
  /** Sprint end day, ISO "YYYY-MM-DD". */
  endDate: string;
  /** Last day with real data — min(today, endDate). Days after are projected null. */
  asOf: string;
  events: BurndownEvent[];
}

export interface BurndownPoint {
  date: string;
  ideal: number;
  remaining: number | null;
  scope: number | null;
}

export interface BurndownSeries {
  points: BurndownPoint[];
  committedPoints: number;
  deliveredPoints: number;
  addedPoints: number;
}

const MS_PER_DAY = 86_400_000;

/** "2026-06-01" (or "2026-06-01T..") -> UTC midnight epoch ms. */
function dayToUtc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** UTC epoch ms -> "YYYY-MM-DD". */
function utcToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Normalize any incoming day-ish string to a bare "YYYY-MM-DD" for comparison. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Every calendar day from start to end inclusive, as ISO day strings. */
function eachDay(startDate: string, endDate: string): string[] {
  const start = dayToUtc(startDate);
  const end = dayToUtc(endDate);
  const days: string[] = [];
  for (let t = start; t <= end; t += MS_PER_DAY) days.push(utcToDay(t));
  return days;
}

/** Ideal remaining on a straight committed -> 0 line, rounded to cents. */
function idealAt(committed: number, index: number, count: number): number {
  if (committed <= 0) return 0;
  if (count <= 1) return committed;
  const value = committed * (1 - index / (count - 1));
  return Math.round(value * 100) / 100;
}

export function computeBurndown(input: BurndownInput): BurndownSeries {
  const { committedPoints, startDate, endDate, asOf, events } = input;

  const days = eachDay(startDate, endDate);
  const asOfKey = dayKey(asOf);

  let deliveredPoints = 0;
  let addedPoints = 0;
  for (const ev of events) {
    if (ev.type === 'COMPLETE') deliveredPoints += ev.points;
    else addedPoints += ev.points;
  }

  const points: BurndownPoint[] = days.map((date, index) => {
    const ideal = idealAt(committedPoints, index, days.length);

    if (dayKey(date) > asOfKey) {
      return { date, ideal, remaining: null, scope: null };
    }

    let addedSoFar = 0;
    let doneSoFar = 0;
    for (const ev of events) {
      if (dayKey(ev.date) > dayKey(date)) continue;
      if (ev.type === 'SCOPE_ADD') addedSoFar += ev.points;
      else doneSoFar += ev.points;
    }

    return {
      date,
      ideal,
      remaining: committedPoints + addedSoFar - doneSoFar,
      scope: committedPoints + addedSoFar,
    };
  });

  return { points, committedPoints, deliveredPoints, addedPoints };
}
