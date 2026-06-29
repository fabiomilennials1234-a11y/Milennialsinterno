import { describe, it, expect } from 'vitest';
import { buildBoardColumns, buildSquadLanes, isLegalTarget } from './boardModel';
import { toIssueCardData } from './issueCardAdapter';
import { BOARD_STATUS_ORDER } from './issueSystem';
import type { BacklogIssue } from '../components/backlogTypes';

const makeIssue = (over: Partial<BacklogIssue>): BacklogIssue => ({
  id: 'id',
  key: 'AGS-1',
  title: 'Default',
  type: 'TASK',
  status: 'TODO',
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

describe('buildBoardColumns', () => {
  it('returns exactly the board columns, in order, excluding BACKLOG', () => {
    const cols = buildBoardColumns([]);
    expect(cols.map((c) => c.status)).toEqual(BOARD_STATUS_ORDER);
    expect(cols.map((c) => c.status)).not.toContain('BACKLOG');
  });

  it('buckets issues into their status column and drops BACKLOG issues', () => {
    const cols = buildBoardColumns([
      makeIssue({ id: '1', status: 'TODO' }),
      makeIssue({ id: '2', status: 'IN_PROGRESS' }),
      makeIssue({ id: '3', status: 'TODO' }),
      makeIssue({ id: '4', status: 'BACKLOG' }),
    ]);
    const find = (s: string) => cols.find((c) => c.status === s)!;
    expect(find('TODO').issues.map((i) => i.id)).toEqual(['1', '3']);
    expect(find('IN_PROGRESS').issues.map((i) => i.id)).toEqual(['2']);
    // BACKLOG issue never lands on the board
    expect(cols.flatMap((c) => c.issues).map((i) => i.id)).not.toContain('4');
  });

  it('preserves incoming order within a column', () => {
    const cols = buildBoardColumns([
      makeIssue({ id: 'b', status: 'REVIEW' }),
      makeIssue({ id: 'a', status: 'REVIEW' }),
    ]);
    expect(cols.find((c) => c.status === 'REVIEW')!.issues.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('toIssueCardData', () => {
  it('derives changesRequested / awaitingApproval from status', () => {
    expect(toIssueCardData(makeIssue({ status: 'CHANGES_REQUESTED' })).changesRequested).toBe(true);
    expect(toIssueCardData(makeIssue({ status: 'CHANGES_REQUESTED' })).awaitingApproval).toBe(false);
    expect(toIssueCardData(makeIssue({ status: 'AWAITING_APPROVAL' })).awaitingApproval).toBe(true);
    expect(toIssueCardData(makeIssue({ status: 'AWAITING_APPROVAL' })).changesRequested).toBe(false);
    expect(toIssueCardData(makeIssue({ status: 'TODO' })).changesRequested).toBe(false);
    expect(toIssueCardData(makeIssue({ status: 'TODO' })).awaitingApproval).toBe(false);
  });

  it('passes blocked + reason straight through', () => {
    const card = toIssueCardData(makeIssue({ blocked: true, blockerReason: 'waiting on API' }));
    expect(card.isBlocked).toBe(true);
    expect(card.blockerReason).toBe('waiting on API');
  });
});

describe('buildSquadLanes', () => {
  it('emits lanes in fixed order: FRONT, BACK, then null', () => {
    const lanes = buildSquadLanes([]);
    expect(lanes.map((l) => l.squad)).toEqual(['FRONT', 'BACK', null]);
  });

  it('routes squad=null issues into the null lane with the right count', () => {
    const lanes = buildSquadLanes([
      makeIssue({ id: 'f', squad: 'FRONT', status: 'TODO' }),
      makeIssue({ id: 'n1', squad: null, status: 'AWAITING_APPROVAL' }),
      makeIssue({ id: 'n2', squad: null, status: 'IN_PROGRESS' }),
    ]);
    const front = lanes.find((l) => l.squad === 'FRONT')!;
    const back = lanes.find((l) => l.squad === 'BACK')!;
    const none = lanes.find((l) => l.squad === null)!;

    expect(front.count).toBe(1);
    expect(back.count).toBe(0);
    expect(none.count).toBe(2);
    expect(none.columns.flatMap((c) => c.issues).map((i) => i.id).sort()).toEqual(['n1', 'n2']);
  });

  it('keeps the null lane present with count>0 — mirrors the migrated devs cards', () => {
    const lanes = buildSquadLanes([makeIssue({ id: 'm', squad: null, status: 'AWAITING_APPROVAL' })]);
    const none = lanes.find((l) => l.squad === null)!;
    expect(none).toBeDefined();
    expect(none.count).toBe(1);
  });

  it('gives every lane the full BOARD_STATUS_ORDER column set', () => {
    const lanes = buildSquadLanes([makeIssue({ id: 'f', squad: 'FRONT' })]);
    for (const lane of lanes) {
      expect(lane.columns.map((c) => c.status)).toEqual(BOARD_STATUS_ORDER);
    }
  });
});

describe('isLegalTarget', () => {
  const issues = [
    makeIssue({ id: 'noclient', status: 'REVIEW', clientId: null }),
    makeIssue({ id: 'withclient', status: 'REVIEW', clientId: 'c1' }),
    makeIssue({ id: 'blocked', status: 'TODO', blocked: true }),
  ];

  it('honors the client gate on REVIEW', () => {
    expect(isLegalTarget(issues, 'withclient', 'AWAITING_APPROVAL')).toBe(true);
    expect(isLegalTarget(issues, 'withclient', 'DONE')).toBe(false);
    expect(isLegalTarget(issues, 'noclient', 'DONE')).toBe(true);
    expect(isLegalTarget(issues, 'noclient', 'AWAITING_APPROVAL')).toBe(false);
  });

  it('freezes a blocked issue', () => {
    expect(isLegalTarget(issues, 'blocked', 'IN_PROGRESS')).toBe(false);
  });

  it('rejects unknown ids', () => {
    expect(isLegalTarget(issues, 'ghost', 'TODO')).toBe(false);
  });
});
