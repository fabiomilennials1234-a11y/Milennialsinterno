import { describe, it, expect } from 'vitest';
import { canEditTask, canApprove, canDragToColumn } from './permissions';
import type { TechTask } from '../types';

const task: TechTask = {
  id: 'task-1', title: 'T', description: null, type: 'FEATURE', status: 'TODO',
  priority: 'MEDIUM', sprint_id: null, assignee_id: 'user-dev',
  created_by: 'user-cto', deadline: null, estimated_hours: null,
  acceptance_criteria: null, technical_context: null, git_branch: null,
  checklist: [], is_blocked: false, blocker_reason: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

describe('permissions', () => {
  it('canEditTask: exec can edit any', () => {
    expect(canEditTask('user-cto', 'cto', task, [])).toBe(true);
    expect(canEditTask('user-ceo', 'ceo', task, [])).toBe(true);
  });
  it('canEditTask: assignee can edit', () => {
    expect(canEditTask('user-dev', 'devs', task, [])).toBe(true);
  });
  it('canEditTask: collaborator can edit', () => {
    expect(canEditTask('other', 'devs', task, ['other'])).toBe(true);
  });
  it('canEditTask: random user cannot', () => {
    expect(canEditTask('stranger', 'devs', task, [])).toBe(false);
  });
  it('canApprove: only executive', () => {
    expect(canApprove('cto')).toBe(true);
    expect(canApprove('devs')).toBe(false);
  });
  it('canDragToColumn: REVIEW->DONE requires executive', () => {
    expect(canDragToColumn('user-dev', 'devs', task, [], 'DONE', 'REVIEW')).toBe(false);
    expect(canDragToColumn('user-cto', 'cto', task, [], 'DONE', 'REVIEW')).toBe(true);
  });
});
