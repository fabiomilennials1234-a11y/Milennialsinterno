import { describe, it, expect } from 'vitest';
import {
  projectEpicBar,
  buildTimeAxis,
  moveEpicDates,
  resizeEpicEdge,
} from './roadmapTimeline';

// Q2-2026 window, exactly 91 days (Apr 1 -> Jun 30 inclusive endpoints as points,
// span = Jun30 - Apr1 = 90 days). Using endpoints as instants keeps math exact.
const WINDOW = { start: '2026-04-01', end: '2026-06-30' };
const SPAN = 90; // days between the two endpoints

function pctOf(days: number) {
  return (days / SPAN) * 100;
}

describe('projectEpicBar', () => {
  it('positions an epic fully inside the window proportionally', () => {
    // May 1 -> Jun 1. May1 is 30 days after Apr1; Jun1 is 61 days after Apr1.
    const bar = projectEpicBar({ startDate: '2026-05-01', deadline: '2026-06-01' }, WINDOW);
    expect(bar.visible).toBe(true);
    expect(bar.isPlaceholder).toBe(false);
    expect(bar.isOpenStart).toBe(false);
    expect(bar.isOpenEnd).toBe(false);
    expect(bar.x).toBeCloseTo(pctOf(30), 5);
    expect(bar.width).toBeCloseTo(pctOf(31), 5);
  });

  it('clips the left edge when the epic starts before the window', () => {
    const bar = projectEpicBar({ startDate: '2026-03-01', deadline: '2026-05-01' }, WINDOW);
    expect(bar.visible).toBe(true);
    expect(bar.isOpenStart).toBe(true);
    expect(bar.isOpenEnd).toBe(false);
    expect(bar.x).toBeCloseTo(0, 5);
    expect(bar.width).toBeCloseTo(pctOf(30), 5); // Apr1 -> May1 = 30 days
  });

  it('clips the right edge when the epic ends after the window', () => {
    const bar = projectEpicBar({ startDate: '2026-06-01', deadline: '2026-08-01' }, WINDOW);
    expect(bar.visible).toBe(true);
    expect(bar.isOpenStart).toBe(false);
    expect(bar.isOpenEnd).toBe(true);
    expect(bar.x).toBeCloseTo(pctOf(61), 5); // Jun1
    expect(bar.width).toBeCloseTo(pctOf(29), 5); // Jun1 -> Jun30 = 29 days
  });

  it('clips BOTH edges when the epic spans past the whole window', () => {
    const bar = projectEpicBar({ startDate: '2026-01-01', deadline: '2026-12-31' }, WINDOW);
    expect(bar.visible).toBe(true);
    expect(bar.isOpenStart).toBe(true);
    expect(bar.isOpenEnd).toBe(true);
    expect(bar.x).toBeCloseTo(0, 5);
    expect(bar.width).toBeCloseTo(100, 5);
  });

  it('opens to the right when there is no deadline', () => {
    const bar = projectEpicBar({ startDate: '2026-05-01', deadline: null }, WINDOW);
    expect(bar.visible).toBe(true);
    expect(bar.isOpenStart).toBe(false);
    expect(bar.isOpenEnd).toBe(true);
    expect(bar.x).toBeCloseTo(pctOf(30), 5);
    expect(bar.width).toBeCloseTo(pctOf(60), 5); // May1 -> Jun30 = 60 days
  });

  it('opens to the left when there is no start but has a deadline', () => {
    const bar = projectEpicBar({ startDate: null, deadline: '2026-05-01' }, WINDOW);
    expect(bar.visible).toBe(true);
    expect(bar.isOpenStart).toBe(true);
    expect(bar.isOpenEnd).toBe(false);
    expect(bar.isPlaceholder).toBe(false);
    expect(bar.x).toBeCloseTo(0, 5);
    expect(bar.width).toBeCloseTo(pctOf(30), 5);
  });

  it('marks a fully-undated epic as placeholder and not visible', () => {
    const bar = projectEpicBar({ startDate: null, deadline: null }, WINDOW);
    expect(bar.isPlaceholder).toBe(true);
    expect(bar.visible).toBe(false);
  });

  it('hides an epic entirely in the future', () => {
    const bar = projectEpicBar({ startDate: '2026-07-15', deadline: '2026-08-01' }, WINDOW);
    expect(bar.visible).toBe(false);
  });

  it('hides an epic entirely in the past', () => {
    const bar = projectEpicBar({ startDate: '2026-01-01', deadline: '2026-02-01' }, WINDOW);
    expect(bar.visible).toBe(false);
  });

  it('hides a no-start epic whose deadline is before the window', () => {
    const bar = projectEpicBar({ startDate: null, deadline: '2026-02-01' }, WINDOW);
    expect(bar.visible).toBe(false);
  });

  it('hides a no-deadline epic that starts after the window', () => {
    const bar = projectEpicBar({ startDate: '2026-08-01', deadline: null }, WINDOW);
    expect(bar.visible).toBe(false);
  });
});

describe('buildTimeAxis', () => {
  it('emits one month tick per month start inside the window', () => {
    const ticks = buildTimeAxis(WINDOW, 'month');
    expect(ticks.map((t) => t.label)).toEqual(['abr', 'mai', 'jun']);
    expect(ticks[0].x).toBeCloseTo(0, 5);
    expect(ticks[1].x).toBeCloseTo(pctOf(30), 5); // May 1
    expect(ticks[2].x).toBeCloseTo(pctOf(61), 5); // Jun 1
  });

  it('emits week ticks stepping 7 days from the window start', () => {
    const ticks = buildTimeAxis(WINDOW, 'week');
    expect(ticks[0].x).toBeCloseTo(0, 5);
    expect(ticks[0].label).toBe('01/04');
    expect(ticks[1].label).toBe('08/04');
    expect(ticks[1].x).toBeCloseTo(pctOf(7), 5);
    // ticks stay within the window
    for (const t of ticks) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThanOrEqual(100);
    }
  });
});

describe('moveEpicDates', () => {
  it('shifts both ends preserving duration', () => {
    const moved = moveEpicDates({ startDate: '2026-05-01', deadline: '2026-05-11' }, 5);
    expect(moved.startDate).toBe('2026-05-06');
    expect(moved.deadline).toBe('2026-05-16');
  });

  it('shifts backwards with a negative delta', () => {
    const moved = moveEpicDates({ startDate: '2026-05-06', deadline: '2026-05-16' }, -5);
    expect(moved.startDate).toBe('2026-05-01');
    expect(moved.deadline).toBe('2026-05-11');
  });

  it('keeps a null end null while moving the start', () => {
    const moved = moveEpicDates({ startDate: '2026-05-01', deadline: null }, 3);
    expect(moved.startDate).toBe('2026-05-04');
    expect(moved.deadline).toBeNull();
  });

  it('is a no-op for a fully undated epic', () => {
    const moved = moveEpicDates({ startDate: null, deadline: null }, 10);
    expect(moved).toEqual({ startDate: null, deadline: null });
  });
});

describe('resizeEpicEdge', () => {
  it('moves the start edge', () => {
    const r = resizeEpicEdge({ startDate: '2026-05-01', deadline: '2026-06-01' }, 'start', '2026-05-10');
    expect(r).toEqual({ startDate: '2026-05-10', deadline: '2026-06-01' });
  });

  it('moves the end edge', () => {
    const r = resizeEpicEdge({ startDate: '2026-05-01', deadline: '2026-06-01' }, 'end', '2026-06-15');
    expect(r).toEqual({ startDate: '2026-05-01', deadline: '2026-06-15' });
  });

  it('clamps the start so it never crosses the deadline', () => {
    const r = resizeEpicEdge({ startDate: '2026-05-01', deadline: '2026-06-01' }, 'start', '2026-07-01');
    expect(r).toEqual({ startDate: '2026-06-01', deadline: '2026-06-01' });
  });

  it('clamps the end so it never crosses the start', () => {
    const r = resizeEpicEdge({ startDate: '2026-05-01', deadline: '2026-06-01' }, 'end', '2026-04-01');
    expect(r).toEqual({ startDate: '2026-05-01', deadline: '2026-05-01' });
  });

  it('sets the start on an epic that had none', () => {
    const r = resizeEpicEdge({ startDate: null, deadline: '2026-06-01' }, 'start', '2026-05-01');
    expect(r).toEqual({ startDate: '2026-05-01', deadline: '2026-06-01' });
  });
});
