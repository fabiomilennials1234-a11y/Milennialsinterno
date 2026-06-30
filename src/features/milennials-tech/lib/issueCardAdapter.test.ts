import { describe, it, expect } from 'vitest';
import { toIssueCardData } from './issueCardAdapter';
import type { BacklogIssue } from '../components/backlogTypes';

const makeIssue = (over: Partial<BacklogIssue>): BacklogIssue => ({
  id: 'id',
  key: 'AGS-1',
  title: 'Default',
  type: 'TASK',
  status: 'TODO',
  priority: 'MEDIUM',
  squad: 'FRONT',
  storyPoints: 3,
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

describe('toIssueCardData — sub-task relations (#158)', () => {
  it('defaults parent/subtask fields to null when no relations passed', () => {
    const card = toIssueCardData(makeIssue({}));
    expect(card.parentKey).toBeNull();
    expect(card.subtaskCount).toBeNull();
    expect(card.subtaskDoneCount).toBeNull();
  });

  it('maps parent_id -> parentKey via relations', () => {
    const card = toIssueCardData(makeIssue({}), { parentKey: 'AGS-12' });
    expect(card.parentKey).toBe('AGS-12');
  });

  it('derives subtaskCount / subtaskDoneCount from relations', () => {
    const card = toIssueCardData(makeIssue({}), { subtaskCount: 4, subtaskDoneCount: 1 });
    expect(card.subtaskCount).toBe(4);
    expect(card.subtaskDoneCount).toBe(1);
  });

  it('passes addedAfterStart through to the card (scope-creep marker, #162)', () => {
    expect(toIssueCardData(makeIssue({ addedAfterStart: true })).addedAfterStart).toBe(true);
    expect(toIssueCardData(makeIssue({ addedAfterStart: false })).addedAfterStart).toBe(false);
  });

  it('keeps existing status-derived + passthrough fields intact alongside relations', () => {
    const card = toIssueCardData(
      makeIssue({ status: 'CHANGES_REQUESTED', blocked: true, blockerReason: 'x' }),
      { parentKey: 'AGS-7', subtaskCount: 2, subtaskDoneCount: 2 },
    );
    expect(card.changesRequested).toBe(true);
    expect(card.isBlocked).toBe(true);
    expect(card.blockerReason).toBe('x');
    expect(card.parentKey).toBe('AGS-7');
    expect(card.subtaskDoneCount).toBe(2);
  });
});

describe('toIssueCardData — epic + sub-task on the board card (#173)', () => {
  it('labels the epic chip with the epic key and colors it from the epic id', () => {
    const card = toIssueCardData(makeIssue({ epicId: 'e1', epicKey: 'AGS-E1' }));
    expect(card.epicLabel).toBe('AGS-E1');
    expect(card.epicColor).toBeTruthy();
  });

  it('falls back to the epic title when the epic has no key', () => {
    const card = toIssueCardData(makeIssue({ epicId: 'e1', epicKey: null, epicTitle: 'Checkout' }));
    expect(card.epicLabel).toBe('Checkout');
  });

  it('leaves the epic chip empty when the issue has no epic', () => {
    expect(toIssueCardData(makeIssue({ epicId: null })).epicLabel).toBeNull();
  });

  it('derives sub-task counts from the row progress (#171)', () => {
    const card = toIssueCardData(makeIssue({ subtaskProgress: { done: 1, total: 3 } }));
    expect(card.subtaskCount).toBe(3);
    expect(card.subtaskDoneCount).toBe(1);
  });

  it('leaves sub-task counts null when the row owns no sub-tasks', () => {
    const card = toIssueCardData(makeIssue({}));
    expect(card.subtaskCount).toBeNull();
    expect(card.subtaskDoneCount).toBeNull();
  });

  it('lets explicit relations override the row progress', () => {
    const card = toIssueCardData(
      makeIssue({ subtaskProgress: { done: 1, total: 3 } }),
      { subtaskCount: 5, subtaskDoneCount: 2 },
    );
    expect(card.subtaskCount).toBe(5);
    expect(card.subtaskDoneCount).toBe(2);
  });
});
