import { describe, it, expect } from 'vitest';
import { groupIssuesByEpic, type GroupEpic } from './groupByEpic';
import type { EpicRollup } from './rollup';
import type { BacklogIssue } from '../components/backlogTypes';

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
  projectName: 'Agros',
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

const epics: GroupEpic[] = [
  { id: 'e1', title: 'Checkout', key: 'AGS-E1' },
  { id: 'e2', title: 'Onboarding', key: 'AGS-E2' },
];

const rollup = (over: Partial<EpicRollup>): EpicRollup => ({
  totalPoints: 0,
  donePoints: 0,
  progressPct: 0,
  issueCount: 0,
  doneCount: 0,
  ...over,
});

const rollups = new Map<string, EpicRollup>([
  ['e1', rollup({ totalPoints: 8, issueCount: 3, doneCount: 1, donePoints: 2, progressPct: 33 })],
  ['e2', rollup({ totalPoints: 5, issueCount: 2 })],
]);

describe('groupIssuesByEpic', () => {
  it('buckets issues under their epic, in epics-list order, preserving rank within a section', () => {
    const issues = [
      makeIssue({ id: 'a', rank: 'A', epicId: 'e1' }),
      makeIssue({ id: 'b', rank: 'B', epicId: 'e2' }),
      makeIssue({ id: 'c', rank: 'C', epicId: 'e1' }),
    ];
    const sections = groupIssuesByEpic(issues, epics, rollups);

    expect(sections.map((s) => s.epic?.id ?? null)).toEqual(['e1', 'e2']);
    expect(sections[0].issues.map((i) => i.id)).toEqual(['a', 'c']); // rank order kept
    expect(sections[1].issues.map((i) => i.id)).toEqual(['b']);
  });

  it('always places the "Sem Epic" section (epic null) last', () => {
    const issues = [
      makeIssue({ id: 'loose', epicId: null }),
      makeIssue({ id: 'a', epicId: 'e1' }),
    ];
    const sections = groupIssuesByEpic(issues, epics, rollups);

    expect(sections[sections.length - 1].epic).toBeNull();
    expect(sections[sections.length - 1].issues.map((i) => i.id)).toEqual(['loose']);
  });

  it('uses the provided rollup for an epic section', () => {
    const sections = groupIssuesByEpic([makeIssue({ id: 'a', epicId: 'e1' })], epics, rollups);
    expect(sections[0].rollup).toEqual(rollups.get('e1'));
  });

  it('derives the "Sem Epic" rollup from its own issues (count-based)', () => {
    const issues = [
      makeIssue({ id: 'l1', epicId: null, storyPoints: 3, status: 'DONE' }),
      makeIssue({ id: 'l2', epicId: null, storyPoints: 2, status: 'TODO' }),
    ];
    const sections = groupIssuesByEpic(issues, [], rollups);
    expect(sections).toHaveLength(1);
    expect(sections[0].epic).toBeNull();
    expect(sections[0].rollup).toMatchObject({ totalPoints: 5, issueCount: 2, doneCount: 1, donePoints: 3 });
  });

  it('hides an epic that has no issues in the current view', () => {
    const sections = groupIssuesByEpic([makeIssue({ id: 'a', epicId: 'e1' })], epics, rollups);
    expect(sections.map((s) => s.epic?.id)).toEqual(['e1']); // e2 absent
  });

  it('returns no sections for an empty issue list', () => {
    expect(groupIssuesByEpic([], epics, rollups)).toEqual([]);
  });
});
