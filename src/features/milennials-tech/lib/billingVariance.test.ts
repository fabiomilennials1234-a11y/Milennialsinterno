import { describe, it, expect } from 'vitest';
import {
  buildBillingVariance,
  computeIssueVariance,
  computeProjectVariance,
  type IssueVariance,
} from './billingVariance';
import { computeIssueEstimates, type EstimateIssue } from './estimateVsActual';

const issue = (
  id: string,
  projectId: string,
  storyPoints: EstimateIssue['storyPoints'] = null,
): EstimateIssue => ({ id, projectId, storyPoints });

describe('computeIssueVariance', () => {
  it('derives realHours and secondsPerPoint from estimate × actual', () => {
    const estimates = computeIssueEstimates([issue('a', 'p1', 2)], { a: 7200 });
    const [v] = computeIssueVariance(estimates);
    expect(v).toEqual<IssueVariance>({
      issueId: 'a',
      projectId: 'p1',
      estimatedPoints: 2,
      realSeconds: 7200,
      realHours: 2,
      secondsPerPoint: 3600,
      unestimated: false,
    });
  });

  it('flags unestimated (null points): secondsPerPoint null, unestimated true', () => {
    const estimates = computeIssueEstimates([issue('a', 'p1', null)], { a: 1800 });
    const [v] = computeIssueVariance(estimates);
    expect(v.unestimated).toBe(true);
    expect(v.secondsPerPoint).toBeNull();
    expect(v.realHours).toBe(0.5);
  });

  it('treats 0 points as unestimated (never divides by zero)', () => {
    const estimates = computeIssueEstimates([issue('a', 'p1', 0)], { a: 3600 });
    const [v] = computeIssueVariance(estimates);
    expect(v.unestimated).toBe(true);
    expect(v.secondsPerPoint).toBeNull();
  });

  it('zero real time -> secondsPerPoint 0 for an estimated issue', () => {
    const estimates = computeIssueEstimates([issue('a', 'p1', 5)], {});
    const [v] = computeIssueVariance(estimates);
    expect(v.realSeconds).toBe(0);
    expect(v.secondsPerPoint).toBe(0);
    expect(v.unestimated).toBe(false);
  });
});

describe('computeProjectVariance', () => {
  it('sums points/seconds, counts issues and unestimated, derives project secondsPerPoint', () => {
    const issues = computeIssueVariance(
      computeIssueEstimates(
        [issue('a', 'p1', 2), issue('b', 'p1', null)],
        { a: 7200, b: 3600 },
      ),
    );
    const [p] = computeProjectVariance(issues);
    expect(p).toEqual({
      projectId: 'p1',
      totalPoints: 2,
      totalSeconds: 10800,
      totalHours: 3,
      issueCount: 2,
      unestimatedCount: 1,
      // 10800s over 2 points = 5400s/pt
      secondsPerPoint: 5400,
    });
  });

  it('all-unestimated project -> secondsPerPoint null but still totals time', () => {
    const issues = computeIssueVariance(
      computeIssueEstimates([issue('a', 'p1', null), issue('b', 'p1', null)], { a: 60, b: 60 }),
    );
    const [p] = computeProjectVariance(issues);
    expect(p.totalPoints).toBe(0);
    expect(p.secondsPerPoint).toBeNull();
    expect(p.unestimatedCount).toBe(2);
    expect(p.totalSeconds).toBe(120);
  });

  it('empty input -> empty array', () => {
    expect(computeProjectVariance([])).toEqual([]);
  });

  it('separates projects into distinct rollups', () => {
    const issues = computeIssueVariance(
      computeIssueEstimates(
        [issue('a', 'p1', 1), issue('b', 'p2', 4)],
        { a: 3600, b: 3600 },
      ),
    );
    const out = computeProjectVariance(issues);
    expect(out).toHaveLength(2);
    expect(out.find((p) => p.projectId === 'p1')?.secondsPerPoint).toBe(3600);
    expect(out.find((p) => p.projectId === 'p2')?.secondsPerPoint).toBe(900);
  });
});

describe('buildBillingVariance', () => {
  it('composes base estimates -> issues + projects in one shot', () => {
    const out = buildBillingVariance(
      [issue('a', 'p1', 2), issue('b', 'p2', 4)],
      { a: 7200, b: 1800 },
    );
    expect(out.issues).toHaveLength(2);
    expect(out.projects).toHaveLength(2);
    expect(out.issues.find((i) => i.issueId === 'a')?.secondsPerPoint).toBe(3600);
    expect(out.projects.find((p) => p.projectId === 'p2')?.totalHours).toBe(0.5);
  });

  it('folds sub-task time into the parent when childrenByParent given (base option passthrough)', () => {
    const out = buildBillingVariance(
      [issue('a', 'p1', 2)],
      { a: 3600, sub1: 3600 },
      { childrenByParent: { a: ['sub1'] } },
    );
    expect(out.issues[0].realSeconds).toBe(7200);
    expect(out.issues[0].secondsPerPoint).toBe(3600);
  });
});
