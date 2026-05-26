import { describe, it, expect } from 'vitest';
import {
  computeUrgencyBadge,
  shouldIncludeTask,
  groupTasksByStatus,
  type EnrichedCrmTask,
} from './useCrmDailyTasks';

// =============================================================
// Slice 1 — urgencyBadge computation
// Priority: atrasado > hoje > dn > null
// =============================================================

describe('computeUrgencyBadge', () => {
  // Fixed "now" for deterministic tests: 2026-05-26T12:00:00Z
  const now = new Date('2026-05-26T12:00:00Z');
  const todayStart = new Date('2026-05-26T00:00:00Z');

  it('returns "atrasado" when due_date is before today', () => {
    const result = computeUrgencyBadge({
      dueDate: '2026-05-25T10:00:00Z',
      deadlineStatus: 'ok',
      isBlockedDN: false,
      todayStart,
    });
    expect(result).toBe('atrasado');
  });

  it('returns "atrasado" when deadlineStatus is overdue (even without due_date)', () => {
    const result = computeUrgencyBadge({
      dueDate: null,
      deadlineStatus: 'overdue',
      isBlockedDN: false,
      todayStart,
    });
    expect(result).toBe('atrasado');
  });

  it('returns "hoje" when due_date is today', () => {
    const result = computeUrgencyBadge({
      dueDate: '2026-05-26T15:00:00Z',
      deadlineStatus: 'ok',
      isBlockedDN: false,
      todayStart,
    });
    expect(result).toBe('hoje');
  });

  it('returns "dn" when task is blocked by D+N', () => {
    const result = computeUrgencyBadge({
      dueDate: '2026-05-28T10:00:00Z',
      deadlineStatus: 'ok',
      isBlockedDN: true,
      todayStart,
    });
    expect(result).toBe('dn');
  });

  it('returns null for normal future task', () => {
    const result = computeUrgencyBadge({
      dueDate: '2026-05-28T10:00:00Z',
      deadlineStatus: 'ok',
      isBlockedDN: false,
      todayStart,
    });
    expect(result).toBeNull();
  });

  it('returns null when no due_date and no special status', () => {
    const result = computeUrgencyBadge({
      dueDate: null,
      deadlineStatus: 'none',
      isBlockedDN: false,
      todayStart,
    });
    expect(result).toBeNull();
  });

  it('atrasado wins over dn (priority order)', () => {
    const result = computeUrgencyBadge({
      dueDate: '2026-05-24T10:00:00Z',
      deadlineStatus: 'ok',
      isBlockedDN: true,
      todayStart,
    });
    expect(result).toBe('atrasado');
  });

  it('atrasado wins over hoje when deadlineStatus is overdue and due_date is today', () => {
    const result = computeUrgencyBadge({
      dueDate: '2026-05-26T10:00:00Z',
      deadlineStatus: 'overdue',
      isBlockedDN: false,
      todayStart,
    });
    expect(result).toBe('atrasado');
  });

  it('hoje wins over dn (priority order)', () => {
    const result = computeUrgencyBadge({
      dueDate: '2026-05-26T10:00:00Z',
      deadlineStatus: 'ok',
      isBlockedDN: true,
      todayStart,
    });
    expect(result).toBe('hoje');
  });
});

// =============================================================
// Slice 2 — done filtering
// Include done tasks completed today, exclude done from previous days
// =============================================================

describe('shouldIncludeTask', () => {
  const todayStart = new Date('2026-05-26T00:00:00Z');

  it('includes todo tasks', () => {
    expect(shouldIncludeTask({
      status: 'todo',
      updatedAt: '2026-05-20T10:00:00Z',
      todayStart,
    })).toBe(true);
  });

  it('includes doing tasks', () => {
    expect(shouldIncludeTask({
      status: 'doing',
      updatedAt: '2026-05-20T10:00:00Z',
      todayStart,
    })).toBe(true);
  });

  it('includes done task completed today', () => {
    expect(shouldIncludeTask({
      status: 'done',
      updatedAt: '2026-05-26T14:30:00Z',
      todayStart,
    })).toBe(true);
  });

  it('includes done task completed at start of today', () => {
    expect(shouldIncludeTask({
      status: 'done',
      updatedAt: '2026-05-26T00:00:00Z',
      todayStart,
    })).toBe(true);
  });

  it('excludes done task from yesterday', () => {
    expect(shouldIncludeTask({
      status: 'done',
      updatedAt: '2026-05-25T23:59:59Z',
      todayStart,
    })).toBe(false);
  });

  it('excludes done task from days ago', () => {
    expect(shouldIncludeTask({
      status: 'done',
      updatedAt: '2026-05-20T10:00:00Z',
      todayStart,
    })).toBe(false);
  });
});

// =============================================================
// Slice 3 — status grouping + type shape
// =============================================================

function makeEnrichedTask(overrides: Partial<EnrichedCrmTask> & { status: 'todo' | 'doing' | 'done' }): EnrichedCrmTask {
  return {
    task: {
      id: 'task-1',
      user_id: 'user-1',
      title: 'Test task',
      description: null,
      task_type: 'daily',
      status: overrides.status,
      priority: null,
      due_date: null,
      department: 'gestor_crm',
      related_client_id: null,
      created_at: '2026-05-26T10:00:00Z',
      updated_at: '2026-05-26T10:00:00Z',
      archived: false,
      archived_at: null,
    },
    produto: null,
    configId: null,
    stepKey: null,
    checklistProgress: null,
    isBlockedDN: false,
    blockedUntil: null,
    deadlineStatus: 'none',
    urgencyBadge: null,
    ...overrides,
  };
}

describe('groupTasksByStatus', () => {
  it('groups tasks into todo/doing/done buckets', () => {
    const tasks: EnrichedCrmTask[] = [
      makeEnrichedTask({ status: 'todo' }),
      makeEnrichedTask({ status: 'doing', task: { ...makeEnrichedTask({ status: 'doing' }).task, id: 'task-2' } }),
      makeEnrichedTask({ status: 'done', task: { ...makeEnrichedTask({ status: 'done' }).task, id: 'task-3' } }),
    ];

    const grouped = groupTasksByStatus(tasks);

    expect(grouped.todo).toHaveLength(1);
    expect(grouped.doing).toHaveLength(1);
    expect(grouped.done).toHaveLength(1);
    expect(grouped.todo[0].task.status).toBe('todo');
    expect(grouped.doing[0].task.status).toBe('doing');
    expect(grouped.done[0].task.status).toBe('done');
  });

  it('returns empty arrays when no tasks', () => {
    const grouped = groupTasksByStatus([]);
    expect(grouped.todo).toEqual([]);
    expect(grouped.doing).toEqual([]);
    expect(grouped.done).toEqual([]);
  });

  it('handles multiple tasks in same status', () => {
    const tasks: EnrichedCrmTask[] = [
      makeEnrichedTask({ status: 'todo' }),
      makeEnrichedTask({ status: 'todo', task: { ...makeEnrichedTask({ status: 'todo' }).task, id: 'task-2' } }),
      makeEnrichedTask({ status: 'todo', task: { ...makeEnrichedTask({ status: 'todo' }).task, id: 'task-3' } }),
    ];

    const grouped = groupTasksByStatus(tasks);
    expect(grouped.todo).toHaveLength(3);
    expect(grouped.doing).toHaveLength(0);
    expect(grouped.done).toHaveLength(0);
  });
});

describe('EnrichedCrmTask shape', () => {
  it('has urgencyBadge field', () => {
    const task = makeEnrichedTask({ status: 'todo', urgencyBadge: 'atrasado' });
    expect(task.urgencyBadge).toBe('atrasado');
  });

  it('does not have group field', () => {
    const task = makeEnrichedTask({ status: 'todo' });
    expect('group' in task).toBe(false);
  });
});
