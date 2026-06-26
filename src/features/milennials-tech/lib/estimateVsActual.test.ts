import { describe, it, expect } from 'vitest';
import {
  computeIssueEstimates,
  computeProjectEstimateRollup,
  type EstimateIssue,
  type IssueEstimate,
} from './estimateVsActual';

// Concise constructors so each test reads as a spec.
const issue = (
  id: string,
  projectId: string,
  storyPoints: EstimateIssue['storyPoints'] = null,
): EstimateIssue => ({ id, projectId, storyPoints });

describe('computeIssueEstimates', () => {
  it('maps estimate + real seconds per issue', () => {
    const out = computeIssueEstimates(
      [issue('a', 'p1', 3), issue('b', 'p1', 8)],
      { a: 120, b: 3600 },
    );
    expect(out).toEqual<IssueEstimate[]>([
      { issueId: 'a', projectId: 'p1', estimatedPoints: 3, realSeconds: 120 },
      { issueId: 'b', projectId: 'p1', estimatedPoints: 8, realSeconds: 3600 },
    ]);
  });

  it('real = 0 when no timer entry for the issue', () => {
    const out = computeIssueEstimates([issue('a', 'p1', 5)], {});
    expect(out[0].realSeconds).toBe(0);
  });

  it('preserves estimatedPoints = null for unestimated issues', () => {
    const out = computeIssueEstimates([issue('a', 'p1', null)], { a: 90 });
    expect(out[0].estimatedPoints).toBeNull();
    expect(out[0].realSeconds).toBe(90);
  });

  it('does NOT roll sub-task time into parent by default (direct time only)', () => {
    const out = computeIssueEstimates([issue('a', 'p1', 3)], { a: 100, sub1: 500 });
    expect(out[0].realSeconds).toBe(100);
  });

  it('rolls sub-task timer seconds into the parent when childrenByParent is given', () => {
    const out = computeIssueEstimates(
      [issue('a', 'p1', 3)],
      { a: 100, sub1: 500, sub2: 50 },
      { childrenByParent: { a: ['sub1', 'sub2'] } },
    );
    expect(out[0].realSeconds).toBe(650);
  });

  it('child with no timer entry contributes zero to the parent rollup', () => {
    const out = computeIssueEstimates(
      [issue('a', 'p1', 3)],
      { a: 100 },
      { childrenByParent: { a: ['sub1'] } },
    );
    expect(out[0].realSeconds).toBe(100);
  });
});

describe('computeProjectEstimateRollup', () => {
  it('empty input -> empty array', () => {
    expect(computeProjectEstimateRollup([])).toEqual([]);
  });

  it('sums points and seconds per project, counting issues', () => {
    const estimates = computeIssueEstimates(
      [issue('a', 'p1', 3), issue('b', 'p1', 5)],
      { a: 120, b: 300 },
    );
    expect(computeProjectEstimateRollup(estimates)).toEqual([
      { projectId: 'p1', totalPoints: 8, totalSeconds: 420, issueCount: 2 },
    ]);
  });

  it('ignores null estimates in the points sum but still counts the issue', () => {
    const estimates = computeIssueEstimates(
      [issue('a', 'p1', null), issue('b', 'p1', 5)],
      { a: 60, b: 60 },
    );
    expect(computeProjectEstimateRollup(estimates)).toEqual([
      { projectId: 'p1', totalPoints: 5, totalSeconds: 120, issueCount: 2 },
    ]);
  });

  it('separates multiple projects into distinct rollups', () => {
    const estimates = computeIssueEstimates(
      [issue('a', 'p1', 3), issue('b', 'p2', 8), issue('c', 'p2', 2)],
      { a: 100, b: 200, c: 50 },
    );
    const out = computeProjectEstimateRollup(estimates);
    expect(out).toContainEqual({ projectId: 'p1', totalPoints: 3, totalSeconds: 100, issueCount: 1 });
    expect(out).toContainEqual({ projectId: 'p2', totalPoints: 10, totalSeconds: 250, issueCount: 2 });
    expect(out).toHaveLength(2);
  });
});
