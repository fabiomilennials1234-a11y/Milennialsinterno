import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// The backlog read model joins the epic key + title onto each issue (#170) so
// the flat-mode row chip and grouped headers have a label. One epics query,
// joined client-side — same pattern as projects/clients/profiles.

const taskRows = [
  {
    id: 'i1', key: 'AGS-1', title: 'Linked', type: 'STORY', status: 'TODO', priority: 'MEDIUM',
    squad: null, story_points: null, assignee_id: null, rank: 'V', project_id: 'p1',
    epic_id: 'e1', sprint_id: null, blocked: false, blocker_reason: null, added_after_start: false,
  },
  {
    id: 'i2', key: 'AGS-2', title: 'Loose', type: 'TASK', status: 'BACKLOG', priority: 'LOW',
    squad: null, story_points: null, assignee_id: null, rank: 'W', project_id: 'p1',
    epic_id: null, sprint_id: null, blocked: false, blocker_reason: null, added_after_start: false,
  },
];
const epicRows = [{ id: 'e1', key: 'AGS-E1', title: 'Checkout' }];

vi.mock('@/integrations/supabase/client', () => {
  function builder(table: string) {
    const calls = new Set<string>();
    const b: Record<string, unknown> = {
      select: () => b,
      is: () => { calls.add('is'); return b; },
      not: () => { calls.add('not'); return b; },
      order: () => b,
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
        let result: { data: unknown; error: null } = { data: [], error: null };
        if (table === 'tech_tasks' && calls.has('is')) result = { data: taskRows, error: null };
        else if (table === 'tech_tasks' && calls.has('not')) result = { data: [], error: null };
        else if (table === 'tech_epics') result = { data: epicRows, error: null };
        else if (table === 'tech_projects')
          result = { data: [{ id: 'p1', name: 'Agros', key_prefix: 'AGS', client_id: null }], error: null };
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

beforeEach(() => vi.clearAllMocks());

describe('useBacklogIssues — epic label enrichment (#170)', () => {
  it('joins epic key + title onto a linked issue', async () => {
    const { result } = renderHook(() => useBacklogIssues(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const i1 = result.current.data!.find((i) => i.id === 'i1');
    expect(i1?.epicKey).toBe('AGS-E1');
    expect(i1?.epicTitle).toBe('Checkout');
  });

  it('leaves epic fields null for an issue with no epic', async () => {
    const { result } = renderHook(() => useBacklogIssues(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const i2 = result.current.data!.find((i) => i.id === 'i2');
    expect(i2?.epicKey ?? null).toBeNull();
    expect(i2?.epicTitle ?? null).toBeNull();
  });
});
