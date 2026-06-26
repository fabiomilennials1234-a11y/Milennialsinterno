import { describe, it, expect } from 'vitest';
import { computeTeamThroughput, type TeamThroughputRow } from './teamThroughput';

// ---------------------------------------------------------------------------
// Team throughput — pure fold spec (#165).
//
// The RPC streams flat (dev × closed sprint) rows; the lib folds them into one
// series per dev: totals headline + closed_at ASC trail for the sparkline. Devs
// lead heaviest-first by totalPoints, tie-broken by assigneeId for stability.
// ---------------------------------------------------------------------------

const row = (
  assignee: string,
  sprintId: string,
  sprintName: string,
  closedAt: string,
  issues: number,
  points: number,
): TeamThroughputRow => ({
  assignee_id: assignee,
  sprint_id: sprintId,
  sprint_name: sprintName,
  closed_at: closedAt,
  issues_closed: issues,
  points_closed: points,
});

describe('computeTeamThroughput', () => {
  it('folds flat rows into one series per dev with summed totals', () => {
    const out = computeTeamThroughput([
      row('dev1', 's1', 'S1', '2026-01-10T00:00:00Z', 2, 8),
      row('dev1', 's2', 'S2', '2026-01-24T00:00:00Z', 1, 5),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].assigneeId).toBe('dev1');
    expect(out[0].totalIssues).toBe(3);
    expect(out[0].totalPoints).toBe(13);
    expect(out[0].perSprint.map((s) => s.sprintId)).toEqual(['s1', 's2']);
  });

  it('keeps per-sprint fields intact', () => {
    const out = computeTeamThroughput([
      row('dev1', 's1', 'Sprint One', '2026-01-10T00:00:00Z', 2, 8),
    ]);
    expect(out[0].perSprint[0]).toEqual({
      sprintId: 's1',
      sprintName: 'Sprint One',
      closedAt: '2026-01-10T00:00:00Z',
      issues: 2,
      points: 8,
    });
  });

  it('splits two devs on the same sprint into two distinct series', () => {
    const out = computeTeamThroughput([
      row('dev1', 's1', 'S1', '2026-01-10T00:00:00Z', 2, 8),
      row('dev2', 's1', 'S1', '2026-01-10T00:00:00Z', 1, 7),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((d) => d.assigneeId)).toEqual(['dev1', 'dev2']); // 8 > 7
  });

  it('orders devs by totalPoints DESC', () => {
    const out = computeTeamThroughput([
      row('low', 's1', 'S1', '2026-01-10T00:00:00Z', 1, 3),
      row('high', 's1', 'S1', '2026-01-10T00:00:00Z', 1, 20),
      row('mid', 's1', 'S1', '2026-01-10T00:00:00Z', 1, 10),
    ]);
    expect(out.map((d) => d.assigneeId)).toEqual(['high', 'mid', 'low']);
  });

  it('breaks a totalPoints tie by assigneeId for deterministic order', () => {
    const out = computeTeamThroughput([
      row('zeta', 's1', 'S1', '2026-01-10T00:00:00Z', 1, 5),
      row('alpha', 's1', 'S1', '2026-01-10T00:00:00Z', 1, 5),
    ]);
    expect(out.map((d) => d.assigneeId)).toEqual(['alpha', 'zeta']);
  });

  it('re-sorts each dev trail by closedAt ASC even when the feed is reversed', () => {
    const out = computeTeamThroughput([
      row('dev1', 's2', 'S2', '2026-01-24T00:00:00Z', 1, 5),
      row('dev1', 's1', 'S1', '2026-01-10T00:00:00Z', 2, 8),
    ]);
    expect(out[0].perSprint.map((s) => s.sprintId)).toEqual(['s1', 's2']);
    expect(out[0].perSprint.map((s) => s.points)).toEqual([8, 5]);
  });

  it('passes a zero-point sprint through (DONE parent, null points → 0)', () => {
    const out = computeTeamThroughput([
      row('dev1', 's1', 'S1', '2026-01-10T00:00:00Z', 1, 0),
    ]);
    expect(out[0].totalPoints).toBe(0);
    expect(out[0].totalIssues).toBe(1);
    expect(out[0].perSprint[0].points).toBe(0);
  });

  it('returns an empty array for an empty stream', () => {
    expect(computeTeamThroughput([])).toEqual([]);
  });
});
