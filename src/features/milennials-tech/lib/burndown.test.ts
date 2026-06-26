import { describe, it, expect } from 'vitest';
import { computeBurndown, type BurndownEvent, type BurndownInput } from './burndown';

// ---------------------------------------------------------------------------
// Burndown series — pure arithmetic spec (#162).
//
// Range is always a 5-day window 2026-06-01..2026-06-05 unless stated, so the
// ideal line reads as clean halves: committed 10 -> [10, 7.5, 5, 2.5, 0].
// All dates are UTC calendar days; no Date-local drift is allowed to leak in.
// ---------------------------------------------------------------------------

const D1 = '2026-06-01';
const D2 = '2026-06-02';
const D3 = '2026-06-03';
const D4 = '2026-06-04';
const D5 = '2026-06-05';

const base = (over: Partial<BurndownInput> = {}): BurndownInput => ({
  committedPoints: 10,
  startDate: D1,
  endDate: D5,
  asOf: D5,
  events: [],
  ...over,
});

const scopeAdd = (date: string, points: number): BurndownEvent => ({
  date,
  type: 'SCOPE_ADD',
  points,
});
const complete = (date: string, points: number): BurndownEvent => ({
  date,
  type: 'COMPLETE',
  points,
});

const remainingOf = (s: ReturnType<typeof computeBurndown>) => s.points.map((p) => p.remaining);
const scopeOf = (s: ReturnType<typeof computeBurndown>) => s.points.map((p) => p.scope);
const idealOf = (s: ReturnType<typeof computeBurndown>) => s.points.map((p) => p.ideal);
const datesOf = (s: ReturnType<typeof computeBurndown>) => s.points.map((p) => p.date);

describe('computeBurndown', () => {
  it('enumerates every calendar day start..end inclusive (UTC, no drift)', () => {
    const s = computeBurndown(base());
    expect(datesOf(s)).toEqual([D1, D2, D3, D4, D5]);
  });

  it('no events — remaining flat at committed, ideal descends to 0', () => {
    const s = computeBurndown(base());
    expect(remainingOf(s)).toEqual([10, 10, 10, 10, 10]);
    expect(scopeOf(s)).toEqual([10, 10, 10, 10, 10]);
    expect(idealOf(s)).toEqual([10, 7.5, 5, 2.5, 0]);
    expect(s.deliveredPoints).toBe(0);
    expect(s.addedPoints).toBe(0);
    expect(s.committedPoints).toBe(10);
  });

  it('one COMPLETE — remaining drops on the completion day and holds', () => {
    const s = computeBurndown(base({ events: [complete(D3, 3)] }));
    expect(remainingOf(s)).toEqual([10, 10, 7, 7, 7]);
    expect(scopeOf(s)).toEqual([10, 10, 10, 10, 10]);
    expect(s.deliveredPoints).toBe(3);
    expect(s.addedPoints).toBe(0);
  });

  it('one SCOPE_ADD — remaining AND scope step up on the add day', () => {
    const s = computeBurndown(base({ events: [scopeAdd(D3, 4)] }));
    expect(remainingOf(s)).toEqual([10, 10, 14, 14, 14]);
    expect(scopeOf(s)).toEqual([10, 10, 14, 14, 14]);
    expect(s.addedPoints).toBe(4);
    expect(s.deliveredPoints).toBe(0);
  });

  it('add mid-sprint then complete it later — delivered counts the added work', () => {
    const s = computeBurndown(base({ events: [scopeAdd(D2, 5), complete(D4, 5)] }));
    // up to 15 on D2 (the add), back to 10 on D4 (the completion).
    expect(remainingOf(s)).toEqual([10, 15, 15, 10, 10]);
    expect(scopeOf(s)).toEqual([10, 15, 15, 15, 15]);
    expect(s.deliveredPoints).toBe(5);
    expect(s.addedPoints).toBe(5);
  });

  it('asOf mid-sprint — future days are null for remaining and scope, ideal stays filled', () => {
    const s = computeBurndown(base({ asOf: D3 }));
    expect(remainingOf(s)).toEqual([10, 10, 10, null, null]);
    expect(scopeOf(s)).toEqual([10, 10, 10, null, null]);
    expect(idealOf(s)).toEqual([10, 7.5, 5, 2.5, 0]);
  });

  it('N==1 guard — single day, ideal is just [committed]', () => {
    const s = computeBurndown(base({ startDate: D1, endDate: D1, asOf: D1 }));
    expect(datesOf(s)).toEqual([D1]);
    expect(idealOf(s)).toEqual([10]);
    expect(remainingOf(s)).toEqual([10]);
    expect(scopeOf(s)).toEqual([10]);
  });

  it('committed 0 — ideal all zero, remaining tracks events from 0', () => {
    const s = computeBurndown(base({ committedPoints: 0, startDate: D1, endDate: D3, asOf: D3 }));
    expect(idealOf(s)).toEqual([0, 0, 0]);
    expect(remainingOf(s)).toEqual([0, 0, 0]);
    expect(scopeOf(s)).toEqual([0, 0, 0]);
  });

  it('events on the same day — order does not matter, sums net correctly', () => {
    const forward = computeBurndown(base({ events: [scopeAdd(D2, 3), complete(D2, 2)] }));
    const reversed = computeBurndown(base({ events: [complete(D2, 2), scopeAdd(D2, 3)] }));
    // D2: 10 + 3 - 2 = 11.
    expect(remainingOf(forward)).toEqual([10, 11, 11, 11, 11]);
    expect(remainingOf(forward)).toEqual(remainingOf(reversed));
    expect(scopeOf(forward)).toEqual([10, 13, 13, 13, 13]);
  });

  it('event dated before startDate counts from the very first day', () => {
    const s = computeBurndown(base({ events: [complete('2026-05-30', 4)] }));
    // The completion predates the window, so the burn is already reflected on D1.
    expect(remainingOf(s)).toEqual([6, 6, 6, 6, 6]);
    expect(s.deliveredPoints).toBe(4);
  });

  it('event after asOf counts in totals but never on a visible day (no line leak)', () => {
    // asOf is mid-sprint; a completion dated after it must not draw into the past,
    // yet it still belongs to the delivered total.
    const s = computeBurndown(base({ asOf: D3, events: [complete(D5, 6)] }));
    expect(remainingOf(s)).toEqual([10, 10, 10, null, null]);
    expect(s.deliveredPoints).toBe(6);
  });

  it('events on the boundary days (startDate and endDate) are included', () => {
    const s = computeBurndown(base({ events: [scopeAdd(D1, 2), complete(D5, 4)] }));
    expect(remainingOf(s)).toEqual([12, 12, 12, 12, 8]);
    expect(scopeOf(s)).toEqual([12, 12, 12, 12, 12]);
    expect(s.addedPoints).toBe(2);
    expect(s.deliveredPoints).toBe(4);
  });
});
