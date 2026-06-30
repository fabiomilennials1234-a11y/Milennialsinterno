import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// The backlog read model enriches each top-level issue with aggregated sub-task
// progress (#171). We assert the resulting SHAPE (subtaskProgress on the issue)
// and that sub-tasks are pulled in ONE query — not per row (no N+1).

const topLevelRows = [
  {
    id: 'i1',
    key: 'AGS-1',
    title: 'Parent with subtasks',
    type: 'STORY',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    squad: 'FRONT',
    story_points: 3,
    assignee_id: null,
    rank: 'V',
    project_id: 'p1',
    epic_id: null,
    sprint_id: null,
    blocked: false,
    blocker_reason: null,
    added_after_start: false,
  },
  {
    id: 'i2',
    key: 'AGS-2',
    title: 'Parent without subtasks',
    type: 'TASK',
    status: 'BACKLOG',
    priority: 'LOW',
    squad: null,
    story_points: null,
    assignee_id: null,
    rank: 'W',
    project_id: 'p1',
    epic_id: null,
    sprint_id: null,
    blocked: false,
    blocker_reason: null,
    added_after_start: false,
  },
];

const subtaskRows = [
  { parent_id: 'i1', status: 'DONE' },
  { parent_id: 'i1', status: 'TODO' },
];

const subtaskQuery = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  function builder(table: string) {
    const calls = new Set<string>();
    const b: Record<string, unknown> = {
      select: () => b,
      is: () => {
        calls.add('is');
        return b;
      },
      not: () => {
        calls.add('not');
        return b;
      },
      order: () => b,
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
        let result: { data: unknown; error: null } = { data: [], error: null };
        if (table === 'tech_tasks' && calls.has('is')) result = { data: topLevelRows, error: null };
        else if (table === 'tech_tasks' && calls.has('not')) {
          subtaskQuery();
          result = { data: subtaskRows, error: null };
        } else if (table === 'tech_projects')
          result = { data: [{ id: 'p1', name: 'Agros', key_prefix: 'AGS', client_id: null }], error: null };
        else if (table === 'clients') result = { data: [], error: null };
        else if (table === 'profiles') result = { data: [], error: null };
        return Promise.resolve(result).then(onF, onR);
      },
    };
    return b;
  }
  return { supabase: { from: (table: string) => builder(table) } };
});

import { useBacklogIssues } from './useTechIssues';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => subtaskQuery.mockClear());

describe('useBacklogIssues — sub-task progress enrichment (#171)', () => {
  it('attaches aggregated done/total to an issue that owns sub-tasks', async () => {
    const { result } = renderHook(() => useBacklogIssues(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const i1 = result.current.data!.find((i) => i.id === 'i1');
    expect(i1?.subtaskProgress).toEqual({ done: 1, total: 2 });
  });

  it('leaves subtaskProgress absent for an issue with no sub-tasks', async () => {
    const { result } = renderHook(() => useBacklogIssues(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const i2 = result.current.data!.find((i) => i.id === 'i2');
    expect(i2?.subtaskProgress).toBeUndefined();
  });

  it('pulls every sub-task in a single query (no N+1)', async () => {
    const { result } = renderHook(() => useBacklogIssues(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(subtaskQuery).toHaveBeenCalledTimes(1);
  });
});
