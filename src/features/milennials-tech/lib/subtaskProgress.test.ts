import { describe, it, expect } from 'vitest';
import {
  computeSubtaskProgress,
  buildSubtaskProgressMap,
  type SubtaskRow,
} from './subtaskProgress';

const rows: SubtaskRow[] = [
  { parentId: 'a', status: 'DONE' },
  { parentId: 'a', status: 'IN_PROGRESS' },
  { parentId: 'a', status: 'DONE' },
  { parentId: 'b', status: 'TODO' },
  { parentId: 'c', status: 'DONE' },
];

describe('computeSubtaskProgress', () => {
  it('counts done (terminal DONE) out of the total for the parent', () => {
    expect(computeSubtaskProgress('a', rows)).toEqual({ done: 2, total: 3 });
  });

  it('reports zero done when no sub-task reached DONE', () => {
    expect(computeSubtaskProgress('b', rows)).toEqual({ done: 0, total: 1 });
  });

  it('reports all done when every sub-task is DONE', () => {
    expect(computeSubtaskProgress('c', rows)).toEqual({ done: 1, total: 1 });
  });

  it('returns total 0 for a parent with no sub-tasks', () => {
    expect(computeSubtaskProgress('missing', rows)).toEqual({ done: 0, total: 0 });
    expect(computeSubtaskProgress('a', [])).toEqual({ done: 0, total: 0 });
  });

  it('ignores sub-tasks of other parents', () => {
    expect(computeSubtaskProgress('a', rows).total).toBe(3);
  });
});

describe('buildSubtaskProgressMap', () => {
  it('aggregates every parent in a single pass', () => {
    const map = buildSubtaskProgressMap(rows);
    expect(map.get('a')).toEqual({ done: 2, total: 3 });
    expect(map.get('b')).toEqual({ done: 0, total: 1 });
    expect(map.get('c')).toEqual({ done: 1, total: 1 });
  });

  it('omits parents with no sub-tasks (absent key, not a zero entry)', () => {
    const map = buildSubtaskProgressMap(rows);
    expect(map.has('missing')).toBe(false);
    expect(map.size).toBe(3);
  });

  it('returns an empty map for no rows', () => {
    expect(buildSubtaskProgressMap([]).size).toBe(0);
  });
});
