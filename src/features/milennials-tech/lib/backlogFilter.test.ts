import { describe, it, expect } from 'vitest';
import { applyBacklogFilters } from './backlogFilter';
import { EMPTY_BACKLOG_FILTERS, type BacklogIssue, type BacklogFilters } from '../components/backlogTypes';

const makeIssue = (over: Partial<BacklogIssue>): BacklogIssue => ({
  id: 'id',
  key: 'AGS-1',
  title: 'Default',
  type: 'TASK',
  status: 'BACKLOG',
  priority: 'MEDIUM',
  squad: 'FRONT',
  storyPoints: null,
  assigneeId: null,
  assigneeName: null,
  assigneeAvatar: null,
  rank: 'V',
  projectId: 'p1',
  projectName: 'Agenda',
  projectPrefix: 'AGS',
  clientId: null,
  clientName: null,
  epicId: null,
  sprintId: null,
  blocked: false,
  blockerReason: null,
  addedAfterStart: false,
  ...over,
});

const filters = (over: Partial<BacklogFilters>): BacklogFilters => ({
  ...EMPTY_BACKLOG_FILTERS,
  ...over,
});

const issues: BacklogIssue[] = [
  makeIssue({ id: '1', key: 'AGS-1', title: 'Login bug', type: 'BUG', status: 'TODO', squad: 'FRONT', projectId: 'p1', clientId: 'c1', assigneeId: 'u1' }),
  makeIssue({ id: '2', key: 'AGS-2', title: 'Payment story', type: 'STORY', status: 'IN_PROGRESS', squad: 'BACK', projectId: 'p1', clientId: 'c1', assigneeId: 'u2' }),
  makeIssue({ id: '3', key: 'PAY-9', title: 'Refactor task', type: 'TASK', status: 'DONE', squad: 'BACK', projectId: 'p2', clientId: 'c2', assigneeId: 'u1' }),
  makeIssue({ id: '4', key: 'PAY-10', title: 'Internal CHORE', type: 'TASK', status: 'BACKLOG', squad: null, projectId: 'p2', clientId: null, assigneeId: null }),
];

const ids = (rs: BacklogIssue[]) => rs.map((r) => r.id).sort();

describe('applyBacklogFilters', () => {
  it('returns everything when no filter is active', () => {
    expect(applyBacklogFilters(issues, EMPTY_BACKLOG_FILTERS)).toHaveLength(4);
  });

  it('filters by projectIds (multi-select OR within dimension)', () => {
    expect(ids(applyBacklogFilters(issues, filters({ projectIds: ['p2'] })))).toEqual(['3', '4']);
    expect(ids(applyBacklogFilters(issues, filters({ projectIds: ['p1', 'p2'] })))).toEqual(['1', '2', '3', '4']);
  });

  it('filters by clientIds', () => {
    expect(ids(applyBacklogFilters(issues, filters({ clientIds: ['c1'] })))).toEqual(['1', '2']);
  });

  it('filters by squads (and excludes null squad unless asked)', () => {
    expect(ids(applyBacklogFilters(issues, filters({ squads: ['BACK'] })))).toEqual(['2', '3']);
    expect(ids(applyBacklogFilters(issues, filters({ squads: ['FRONT'] })))).toEqual(['1']);
  });

  it('filters by assigneeIds', () => {
    expect(ids(applyBacklogFilters(issues, filters({ assigneeIds: ['u1'] })))).toEqual(['1', '3']);
  });

  it('filters by types', () => {
    expect(ids(applyBacklogFilters(issues, filters({ types: ['STORY', 'BUG'] })))).toEqual(['1', '2']);
  });

  it('filters by statuses', () => {
    expect(ids(applyBacklogFilters(issues, filters({ statuses: ['DONE', 'BACKLOG'] })))).toEqual(['3', '4']);
  });

  it('combines dimensions with AND across dimensions', () => {
    // project p1 AND squad BACK -> only issue 2
    expect(ids(applyBacklogFilters(issues, filters({ projectIds: ['p1'], squads: ['BACK'] })))).toEqual(['2']);
  });

  it('searches title case-insensitively', () => {
    expect(ids(applyBacklogFilters(issues, filters({ search: 'PAYMENT' })))).toEqual(['2']);
  });

  it('searches key case-insensitively', () => {
    expect(ids(applyBacklogFilters(issues, filters({ search: 'pay-9' })))).toEqual(['3']);
  });

  it('trims whitespace-only search to no constraint', () => {
    expect(applyBacklogFilters(issues, filters({ search: '   ' }))).toHaveLength(4);
  });

  it('combines search with dimension filters', () => {
    expect(ids(applyBacklogFilters(issues, filters({ types: ['TASK'], search: 'refactor' })))).toEqual(['3']);
  });

  it('returns empty when nothing matches', () => {
    expect(applyBacklogFilters(issues, filters({ search: 'nonexistent-zzz' }))).toEqual([]);
  });
});
