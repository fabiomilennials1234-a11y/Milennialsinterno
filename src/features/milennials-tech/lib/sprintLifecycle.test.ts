import { describe, it, expect } from 'vitest';
import type { IssueStatus } from './issueSystem';
import {
  computeCommittedPoints,
  computePlannedPoints,
  computeDonePoints,
  partitionOnClose,
} from './sprintLifecycle';

// ---------------------------------------------------------------------------
// Sprint lifecycle pure helpers (#161). Mirrors the workflow.test discipline:
// the DB owns the authoritative snapshot / partition on the RPC path; these
// pure functions are the CLIENT-SIDE display + preview re-encoding (committed
// preview before start, done/planned for the commitment bar, partition for the
// close modal counts). Tests cover null points, empty, and every status bucket.
// ---------------------------------------------------------------------------

type Issue = { storyPoints: number | null; status: IssueStatus };

function issue(status: IssueStatus, storyPoints: number | null): Issue {
  return { status, storyPoints };
}

const ALL_STATUSES: IssueStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'AWAITING_APPROVAL',
  'CHANGES_REQUESTED',
  'DONE',
];

describe('computeCommittedPoints', () => {
  it('sums story points', () => {
    expect(computeCommittedPoints([{ storyPoints: 1 }, { storyPoints: 5 }, { storyPoints: 8 }])).toBe(14);
  });
  it('treats null as 0', () => {
    expect(computeCommittedPoints([{ storyPoints: 3 }, { storyPoints: null }, { storyPoints: 2 }])).toBe(5);
  });
  it('all null ⇒ 0', () => {
    expect(computeCommittedPoints([{ storyPoints: null }, { storyPoints: null }])).toBe(0);
  });
  it('empty ⇒ 0', () => {
    expect(computeCommittedPoints([])).toBe(0);
  });
});

describe('computePlannedPoints', () => {
  it('sums every issue regardless of status, null = 0', () => {
    const issues = [
      issue('TODO', 3),
      issue('DONE', 5),
      issue('IN_PROGRESS', null),
      issue('BACKLOG', 2),
    ];
    expect(computePlannedPoints(issues)).toBe(10);
  });
  it('empty ⇒ 0', () => {
    expect(computePlannedPoints([])).toBe(0);
  });
});

describe('computeDonePoints', () => {
  it('sums only DONE issues, null = 0', () => {
    const issues = [
      issue('DONE', 5),
      issue('DONE', null),
      issue('TODO', 3),
      issue('REVIEW', 8),
      issue('DONE', 2),
    ];
    expect(computeDonePoints(issues)).toBe(7);
  });
  it('no DONE ⇒ 0', () => {
    expect(computeDonePoints([issue('TODO', 3), issue('IN_PROGRESS', 5)])).toBe(0);
  });
  it('empty ⇒ 0', () => {
    expect(computeDonePoints([])).toBe(0);
  });
  it('done points never exceed planned points', () => {
    const issues = ALL_STATUSES.map((s, i) => issue(s, i + 1));
    expect(computeDonePoints(issues)).toBeLessThanOrEqual(computePlannedPoints(issues));
  });
});

describe('partitionOnClose', () => {
  it('completed = DONE, incomplete = everything else', () => {
    const issues = [
      { id: 'a', status: 'DONE' as IssueStatus },
      { id: 'b', status: 'TODO' as IssueStatus },
      { id: 'c', status: 'IN_PROGRESS' as IssueStatus },
      { id: 'd', status: 'DONE' as IssueStatus },
      { id: 'e', status: 'REVIEW' as IssueStatus },
    ];
    const { completed, incomplete } = partitionOnClose(issues);
    expect(completed.map((i) => i.id)).toEqual(['a', 'd']);
    expect(incomplete.map((i) => i.id)).toEqual(['b', 'c', 'e']);
  });

  it('every non-DONE status lands in incomplete', () => {
    const issues = ALL_STATUSES.map((status) => ({ status }));
    const { completed, incomplete } = partitionOnClose(issues);
    expect(completed).toEqual([{ status: 'DONE' }]);
    expect(incomplete.map((i) => i.status)).toEqual(
      ALL_STATUSES.filter((s) => s !== 'DONE'),
    );
  });

  it('partition is exhaustive and disjoint', () => {
    const issues = ALL_STATUSES.map((status, i) => ({ status, n: i }));
    const { completed, incomplete } = partitionOnClose(issues);
    expect(completed.length + incomplete.length).toBe(issues.length);
  });

  it('empty ⇒ both empty', () => {
    const { completed, incomplete } = partitionOnClose([]);
    expect(completed).toEqual([]);
    expect(incomplete).toEqual([]);
  });

  it('all DONE ⇒ incomplete empty', () => {
    const issues = [{ status: 'DONE' as IssueStatus }, { status: 'DONE' as IssueStatus }];
    const { completed, incomplete } = partitionOnClose(issues);
    expect(completed.length).toBe(2);
    expect(incomplete).toEqual([]);
  });

  it('preserves element identity (no copies)', () => {
    const a = { status: 'DONE' as IssueStatus };
    const b = { status: 'TODO' as IssueStatus };
    const { completed, incomplete } = partitionOnClose([a, b]);
    expect(completed[0]).toBe(a);
    expect(incomplete[0]).toBe(b);
  });
});
