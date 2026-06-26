import { describe, it, expect } from 'vitest';
import { computeReorderNeighbors } from './backlogRanking';

// Helper: a backlog already sorted by rank ascending.
const list = (...ids: string[]) =>
  ids.map((id) => ({ id, rank: id })); // rank value irrelevant to neighbor logic; use id for readability

describe('computeReorderNeighbors', () => {
  it('moves an item to the top (prev=null, next=first remaining)', () => {
    const ordered = list('a', 'b', 'c');
    expect(computeReorderNeighbors(ordered, 'c', 0)).toEqual({
      prevRank: null,
      nextRank: 'a',
    });
  });

  it('moves an item to the end (prev=last remaining, next=null)', () => {
    const ordered = list('a', 'b', 'c');
    expect(computeReorderNeighbors(ordered, 'a', 2)).toEqual({
      prevRank: 'c',
      nextRank: null,
    });
  });

  it('moves an item into the middle (brackets the destination after removal)', () => {
    const ordered = list('a', 'b', 'c', 'd');
    // remove 'a' -> [b, c, d]; target index 2 -> between c and d
    expect(computeReorderNeighbors(ordered, 'a', 2)).toEqual({
      prevRank: 'c',
      nextRank: 'd',
    });
  });

  it('treats a same-position drop as a stable no-op (neighbors bracket original spot)', () => {
    const ordered = list('a', 'b', 'c');
    // remove 'b' -> [a, c]; target index 1 -> between a and c (its original neighbors)
    expect(computeReorderNeighbors(ordered, 'b', 1)).toEqual({
      prevRank: 'a',
      nextRank: 'c',
    });
  });

  it('handles a single-item list (both neighbors null)', () => {
    const ordered = list('a');
    expect(computeReorderNeighbors(ordered, 'a', 0)).toEqual({
      prevRank: null,
      nextRank: null,
    });
  });

  it('clamps a target index below zero to the top', () => {
    const ordered = list('a', 'b', 'c');
    expect(computeReorderNeighbors(ordered, 'c', -5)).toEqual({
      prevRank: null,
      nextRank: 'a',
    });
  });

  it('clamps a target index past the end to the bottom', () => {
    const ordered = list('a', 'b', 'c');
    expect(computeReorderNeighbors(ordered, 'a', 99)).toEqual({
      prevRank: 'c',
      nextRank: null,
    });
  });

  it('uses real lexorank values, not ids', () => {
    const ordered = [
      { id: 'i1', rank: 'F' },
      { id: 'i2', rank: 'V' },
      { id: 'i3', rank: 'k' },
    ];
    // move i3 between i1 and i2: remove i3 -> [i1(F), i2(V)]; index 1 -> prev F, next V
    expect(computeReorderNeighbors(ordered, 'i3', 1)).toEqual({
      prevRank: 'F',
      nextRank: 'V',
    });
  });

  it('returns the moved item unchanged-position neighbors when target equals current index', () => {
    const ordered = list('a', 'b', 'c', 'd');
    // 'c' is at index 2; remove -> [a, b, d]; target index 2 -> between b and d
    expect(computeReorderNeighbors(ordered, 'c', 2)).toEqual({
      prevRank: 'b',
      nextRank: 'd',
    });
  });

  it('is a no-op-safe identity when the moved id is absent (degrades gracefully)', () => {
    const ordered = list('a', 'b', 'c');
    expect(computeReorderNeighbors(ordered, 'zzz', 1)).toEqual({
      prevRank: 'a',
      nextRank: 'b',
    });
  });
});
