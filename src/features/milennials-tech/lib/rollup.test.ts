import { describe, it, expect } from 'vitest';
import { computeEpicRollup, type RollupIssue } from './rollup';

// Helpers — concise constructors so each test reads as a spec.
const top = (story_points: number | null, status: RollupIssue['status'] = 'BACKLOG'): RollupIssue => ({
  parent_id: null,
  story_points,
  status,
});
const sub = (status: RollupIssue['status'] = 'BACKLOG'): RollupIssue => ({
  // DB CHECK forbids points/epic on sub-tasks; mirror that here.
  parent_id: 'some-parent',
  story_points: null,
  status,
});

describe('computeEpicRollup', () => {
  it('empty input -> everything zero', () => {
    expect(computeEpicRollup([])).toEqual({
      totalPoints: 0,
      donePoints: 0,
      progressPct: 0,
      issueCount: 0,
      doneCount: 0,
    });
  });

  it('only sub-tasks -> ignored entirely (zero)', () => {
    const out = computeEpicRollup([sub('DONE'), sub('IN_PROGRESS'), sub('BACKLOG')]);
    expect(out).toEqual({
      totalPoints: 0,
      donePoints: 0,
      progressPct: 0,
      issueCount: 0,
      doneCount: 0,
    });
  });

  it('counts top-level issues only; sub-tasks add nothing to points or progress', () => {
    const out = computeEpicRollup([
      top(5, 'DONE'),
      top(3, 'IN_PROGRESS'),
      sub('DONE'), // must not count toward done, points, or denominator
    ]);
    expect(out).toEqual({
      totalPoints: 8,
      donePoints: 5,
      progressPct: 50, // 1 done of 2 top-level
      issueCount: 2,
      doneCount: 1,
    });
  });

  it('all top-level DONE -> 100%', () => {
    const out = computeEpicRollup([top(2, 'DONE'), top(3, 'DONE')]);
    expect(out.progressPct).toBe(100);
    expect(out.doneCount).toBe(2);
    expect(out.donePoints).toBe(5);
  });

  it('null story_points treated as 0 in sums', () => {
    const out = computeEpicRollup([top(null, 'DONE'), top(8, 'BACKLOG')]);
    expect(out.totalPoints).toBe(8);
    expect(out.donePoints).toBe(0);
    expect(out.issueCount).toBe(2);
    expect(out.doneCount).toBe(1);
    expect(out.progressPct).toBe(50);
  });

  it('progress is count-based, not points-weighted', () => {
    // 1 of 2 issues done, but the done one carries most of the points.
    const out = computeEpicRollup([top(13, 'DONE'), top(1, 'BACKLOG')]);
    expect(out.progressPct).toBe(50); // count-based: 1/2
    expect(out.donePoints).toBe(13);
    expect(out.totalPoints).toBe(14);
  });

  it('rounds progress (1 of 3 -> 33)', () => {
    const out = computeEpicRollup([top(1, 'DONE'), top(1, 'BACKLOG'), top(1, 'BACKLOG')]);
    expect(out.progressPct).toBe(33);
  });

  it('rounds progress (2 of 3 -> 67)', () => {
    const out = computeEpicRollup([top(1, 'DONE'), top(1, 'DONE'), top(1, 'BACKLOG')]);
    expect(out.progressPct).toBe(67);
  });
});
