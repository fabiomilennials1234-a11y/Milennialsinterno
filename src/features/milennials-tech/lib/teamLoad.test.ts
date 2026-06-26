import { describe, it, expect } from 'vitest';
import { computeLoadDistribution, type TeamLoadRow } from './teamLoad';

// ---------------------------------------------------------------------------
// Team load distribution — pure overload spec (#165).
//
// Honest median (even count → mean of two central). Overload fires only on a
// real signal: above the median AND ≥3 devs AND non-zero. The single heaviest
// dev is the peak whenever they carry load, independent of the overload quorum.
// ---------------------------------------------------------------------------

const row = (assignee: string, issues: number, points: number): TeamLoadRow => ({
  assignee_id: assignee,
  open_issues: issues,
  open_points: points,
});

describe('computeLoadDistribution', () => {
  it('0 devs — empty, median 0, no rows', () => {
    const out = computeLoadDistribution([]);
    expect(out.devs).toEqual([]);
    expect(out.median).toBe(0);
    expect(out.devCount).toBe(0);
  });

  it('1 dev — peak when carrying load, never overloaded (insufficient signal)', () => {
    const out = computeLoadDistribution([row('dev1', 3, 12)]);
    expect(out.devCount).toBe(1);
    expect(out.median).toBe(12);
    expect(out.devs[0].isPeak).toBe(true);
    expect(out.devs[0].isOverloaded).toBe(false);
  });

  it('2 devs — heavier is peak but NOBODY overloaded (< 3 devs)', () => {
    const out = computeLoadDistribution([row('light', 1, 4), row('heavy', 5, 20)]);
    expect(out.devs.map((d) => d.assignee_id)).toEqual(['heavy', 'light']);
    expect(out.devs[0].isPeak).toBe(true);
    expect(out.devs.every((d) => !d.isOverloaded)).toBe(true);
  });

  it('3 devs — above-median dev is overloaded and is the peak', () => {
    const out = computeLoadDistribution([
      row('a', 5, 20),
      row('b', 2, 8),
      row('c', 1, 2),
    ]);
    // sorted desc: a(20) b(8) c(2); median 8
    expect(out.median).toBe(8);
    const a = out.devs.find((d) => d.assignee_id === 'a')!;
    const b = out.devs.find((d) => d.assignee_id === 'b')!;
    const c = out.devs.find((d) => d.assignee_id === 'c')!;
    expect(a.isOverloaded).toBe(true);
    expect(a.isPeak).toBe(true);
    expect(b.isOverloaded).toBe(false); // exactly at median → balanced
    expect(c.isOverloaded).toBe(false);
  });

  it('even dev count — median is the mean of the two central values', () => {
    const out = computeLoadDistribution([
      row('a', 4, 10),
      row('b', 2, 4),
      row('c', 1, 2),
      row('d', 0, 0),
    ]);
    // sorted desc: 10,4,2,0 → central 4 and 2 → median 3
    expect(out.median).toBe(3);
    const overloaded = out.devs.filter((d) => d.isOverloaded).map((d) => d.assignee_id);
    expect(overloaded).toEqual(['a', 'b']); // 10>3 and 4>3
  });

  it('tie at the median — nobody above it, nobody overloaded', () => {
    const out = computeLoadDistribution([
      row('a', 2, 5),
      row('b', 2, 5),
      row('c', 2, 5),
    ]);
    expect(out.median).toBe(5);
    expect(out.devs.every((d) => !d.isOverloaded)).toBe(true);
    expect(out.devs[0].isPeak).toBe(true); // one peak only
    expect(out.devs.filter((d) => d.isPeak)).toHaveLength(1);
  });

  it('all zero load — no peak, no overload', () => {
    const out = computeLoadDistribution([
      row('a', 0, 0),
      row('b', 0, 0),
      row('c', 0, 0),
    ]);
    expect(out.median).toBe(0);
    expect(out.devs.every((d) => !d.isPeak)).toBe(true);
    expect(out.devs.every((d) => !d.isOverloaded)).toBe(true);
  });

  it('re-sorts a reversed feed by open_points DESC', () => {
    const out = computeLoadDistribution([
      row('low', 1, 2),
      row('high', 5, 20),
      row('mid', 2, 8),
    ]);
    expect(out.devs.map((d) => d.assignee_id)).toEqual(['high', 'mid', 'low']);
    expect(out.devs[0].isPeak).toBe(true);
  });

  it('passes open_issues/open_points through unchanged', () => {
    const out = computeLoadDistribution([row('dev1', 7, 13)]);
    expect(out.devs[0].open_issues).toBe(7);
    expect(out.devs[0].open_points).toBe(13);
  });
});
