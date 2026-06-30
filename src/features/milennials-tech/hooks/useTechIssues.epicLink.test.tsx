import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Round-trip of the epic↔issue link at the data border (#169). We drive the
// real hooks with a mocked supabase and assert the resulting epic_id contract
// at each step: link on create, re-link to another epic, and unlink.
const { rpc, from, update, eq } = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { rpc: vi.fn(), from, update, eq };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from },
}));

import { useCreateIssue, useRelinkIssueEpic } from './useTechIssues';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function wrapperWithSpy() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(client, 'invalidateQueries');
  const W = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper: W, spy };
}

beforeEach(() => {
  rpc.mockReset();
  from.mockClear();
  update.mockClear();
  eq.mockReset();
});

describe('epic↔issue link round-trip', () => {
  it('links the epic on create — tech_issue_create carries p_epic_id', async () => {
    rpc.mockResolvedValue({ data: 'new-id', error: null });
    const { result } = renderHook(() => useCreateIssue(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ projectId: 'p1', title: 'Issue', epicId: 'e1' });
    });

    expect(rpc).toHaveBeenCalledWith(
      'tech_issue_create',
      expect.objectContaining({ p_project_id: 'p1', p_epic_id: 'e1' }),
    );
  });

  it('re-links to another epic via tech_issue_set_epic (uniform RPC write path, #169.1)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useRelinkIssueEpic(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'i1', epicId: 'e2' });
    });

    expect(rpc).toHaveBeenCalledWith('tech_issue_set_epic', {
      p_issue_id: 'i1',
      p_epic_id: 'e2',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('unlinks via the SAME RPC with p_epic_id null — no direct table write (#169.1)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useRelinkIssueEpic(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'i1', epicId: null });
    });

    expect(rpc).toHaveBeenCalledWith('tech_issue_set_epic', {
      p_issue_id: 'i1',
      p_epic_id: null,
    });
    expect(from).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('invalidates the legacy task cache too — the detail reads useTechTasks, not the backlog', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { wrapper: W, spy } = wrapperWithSpy();
    const { result } = renderHook(() => useRelinkIssueEpic(), { wrapper: W });

    await act(async () => {
      await result.current.mutateAsync({ id: 'i1', epicId: 'e2' });
    });

    const invalidatedKeys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidatedKeys).toContain(JSON.stringify(['tech', 'backlog']));
    expect(invalidatedKeys).toContain(JSON.stringify(['tech', 'tasks']));
  });
});
