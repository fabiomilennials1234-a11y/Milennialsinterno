import { describe, it, expect } from 'vitest';
import { computeVelocity, type VelocitySprintInput } from './velocity';

// ---------------------------------------------------------------------------
// Velocity series — pure arithmetic spec (#163).
//
// One bar per CLOSED sprint, oldest → newest, with a trailing rolling average
// laid over it. The RPC already orders by closed_at ASC; the lib re-sorts
// defensively so a mis-ordered feed never warps the rolling window. delivered
// is the same Σ DONE parent points the burndown counts (#162 consistency) —
// the lib just receives it per sprint and folds the average.
// ---------------------------------------------------------------------------

const sprint = (
  name: string,
  committed: number,
  delivered: number,
  closedAt: string,
): VelocitySprintInput => ({
  sprintId: name,
  name,
  committedPoints: committed,
  deliveredPoints: delivered,
  closedAt,
});

const deliveredOf = (s: ReturnType<typeof computeVelocity>) => s.points.map((p) => p.delivered);
const committedOf = (s: ReturnType<typeof computeVelocity>) => s.points.map((p) => p.committed);
const rollingOf = (s: ReturnType<typeof computeVelocity>) => s.points.map((p) => p.rollingAverage);
const namesOf = (s: ReturnType<typeof computeVelocity>) => s.points.map((p) => p.name);

describe('computeVelocity', () => {
  it('(a) maps delivered → velocity bar per sprint, oldest → newest', () => {
    const s = computeVelocity([
      sprint('S1', 20, 18, '2026-01-10T00:00:00Z'),
      sprint('S2', 20, 22, '2026-01-24T00:00:00Z'),
    ]);
    expect(namesOf(s)).toEqual(['S1', 'S2']);
    expect(deliveredOf(s)).toEqual([18, 22]);
    expect(committedOf(s)).toEqual([20, 20]);
    expect(s.sprintCount).toBe(2);
  });

  it('(b) full rolling window (>=3 sprints) averages the trailing N', () => {
    const s = computeVelocity(
      [
        sprint('S1', 10, 10, '2026-01-01T00:00:00Z'),
        sprint('S2', 20, 20, '2026-01-15T00:00:00Z'),
        sprint('S3', 30, 30, '2026-01-29T00:00:00Z'),
        sprint('S4', 40, 40, '2026-02-12T00:00:00Z'),
      ],
      3,
    );
    // rolling: [10, 15, 20, 30] — trailing 3 on the tail.
    expect(rollingOf(s)).toEqual([10, 15, 20, 30]);
    expect(s.averageVelocity).toBe(30);
    expect(s.window).toBe(3);
    expect(s.sprintCount).toBe(4);
  });

  it('(c) partial window — single sprint averages just itself', () => {
    const s = computeVelocity([sprint('S1', 10, 7, '2026-01-01T00:00:00Z')], 3);
    expect(rollingOf(s)).toEqual([7]);
    expect(s.averageVelocity).toBe(7);
    expect(s.window).toBe(1); // effective window clamps to the sprints available
    expect(s.sprintCount).toBe(1);
  });

  it('(c) partial window — two sprints average both, window clamps to 2', () => {
    const s = computeVelocity(
      [
        sprint('S1', 10, 10, '2026-01-01T00:00:00Z'),
        sprint('S2', 20, 15, '2026-01-15T00:00:00Z'),
      ],
      3,
    );
    expect(rollingOf(s)).toEqual([10, 12.5]);
    expect(s.averageVelocity).toBe(12.5);
    expect(s.window).toBe(2);
  });

  it('(d) shortfall sprint keeps real delivered, never the commitment', () => {
    const s = computeVelocity([sprint('S1', 30, 12, '2026-01-01T00:00:00Z')]);
    expect(deliveredOf(s)).toEqual([12]);
    expect(committedOf(s)).toEqual([30]);
    expect(s.averageVelocity).toBe(12);
  });

  it('(e) empty series — zeros, no points, window preserved as 0', () => {
    const s = computeVelocity([], 3);
    expect(s.points).toEqual([]);
    expect(s.averageVelocity).toBe(0);
    expect(s.sprintCount).toBe(0);
    expect(s.window).toBe(0);
  });

  it('rounds rolling/average to a single decimal', () => {
    const s = computeVelocity(
      [
        sprint('S1', 5, 5, '2026-01-01T00:00:00Z'),
        sprint('S2', 5, 5, '2026-01-15T00:00:00Z'),
        sprint('S3', 5, 4, '2026-01-29T00:00:00Z'),
      ],
      3,
    );
    // (5+5+4)/3 = 4.6666… → 4.7
    expect(rollingOf(s)).toEqual([5, 5, 4.7]);
    expect(s.averageVelocity).toBe(4.7);
  });

  it('re-sorts defensively by closedAt even when the feed is reversed', () => {
    const s = computeVelocity([
      sprint('S2', 20, 20, '2026-01-15T00:00:00Z'),
      sprint('S1', 10, 10, '2026-01-01T00:00:00Z'),
    ]);
    expect(namesOf(s)).toEqual(['S1', 'S2']);
    expect(deliveredOf(s)).toEqual([10, 20]);
  });

  it('default window is 3 when omitted', () => {
    const s = computeVelocity([
      sprint('S1', 10, 9, '2026-01-01T00:00:00Z'),
      sprint('S2', 10, 12, '2026-01-15T00:00:00Z'),
      sprint('S3', 10, 15, '2026-01-29T00:00:00Z'),
      sprint('S4', 10, 21, '2026-02-12T00:00:00Z'),
    ]);
    // trailing 3 of the tail: (12+15+21)/3 = 16
    expect(s.window).toBe(3);
    expect(s.averageVelocity).toBe(16);
  });
});
