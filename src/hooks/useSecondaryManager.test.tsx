import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ---------------------------------------------------------------------------
// Supabase mock — builder chain supporting the ops used by useSecondaryManager:
//   from(...).select('*').eq(...).maybeSingle()       → useSecondaryManager
//   from(...).upsert(..., {...}).select().single()    → useSetSecondaryManager
//   from(...).delete().eq(...)                        → useRemoveSecondaryManager (awaited directly)
//   from(...).select('*')                             → useSecondaryManagersBulk (list)
//   from('profiles').select(...).in(...)              → useSecondaryManagersBulk (profiles join)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface CallRecord {
  table: string;
  op: 'select' | 'upsert' | 'delete';
  filters: Array<[string, unknown]>;
  payload?: unknown;
  onConflict?: string;
}

const state = {
  calls: [] as CallRecord[],
  selectResponses: new Map<string, Array<{ data: Row[] | Row | null; error: unknown }>>(),
  upsertResponses: new Map<string, { data: Row | null; error: unknown }>(),
};

function nextSelectResponse(table: string) {
  const queue = state.selectResponses.get(table) ?? [];
  const head = queue.shift() ?? { data: null, error: null };
  state.selectResponses.set(table, queue);
  return head;
}

function queueSelect(table: string, data: Row[] | Row | null) {
  const queue = state.selectResponses.get(table) ?? [];
  queue.push({ data, error: null });
  state.selectResponses.set(table, queue);
}

function makeBuilder(table: string, op: CallRecord['op']) {
  const record: CallRecord = { table, op, filters: [] };
  state.calls.push(record);

  const builder: Record<string, unknown> = {
    select: () => builder,
    upsert: (payload: unknown, opts?: { onConflict?: string }) => {
      record.payload = payload;
      record.op = 'upsert';
      record.onConflict = opts?.onConflict;
      return builder;
    },
    delete: () => {
      record.op = 'delete';
      return builder;
    },
    eq: (col: string, val: unknown) => {
      record.filters.push([col, val]);
      return builder;
    },
    in: (col: string, val: unknown) => {
      record.filters.push([`${col} IN`, val]);
      return builder;
    },
    maybeSingle: () => {
      const res = nextSelectResponse(table);
      const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
      return Promise.resolve({ data, error: res.error });
    },
    single: () => {
      if (record.op === 'upsert') {
        const res = state.upsertResponses.get(table) ?? { data: null, error: null };
        return Promise.resolve(res);
      }
      const res = nextSelectResponse(table);
      const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
      return Promise.resolve({ data, error: res.error });
    },
    // Non-terminal promise for delete().eq(...) awaited directly.
    then: (resolve: (v: { data: Row[] | null; error: unknown }) => void) => {
      if (record.op === 'delete') {
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      const res = nextSelectResponse(table);
      const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
      return Promise.resolve({ data, error: res.error }).then(resolve);
    },
  };

  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table, 'select'),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-exec-1' } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  useSecondaryManager,
  useSetSecondaryManager,
  useRemoveSecondaryManager,
  useSecondaryManagersBulk,
} from './useSecondaryManager';

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return Wrapper;
}

beforeEach(() => {
  state.calls = [];
  state.selectResponses.clear();
  state.upsertResponses.clear();
});

// ---------------------------------------------------------------------------

describe('useSecondaryManager', () => {
  it('returns null when no record exists', async () => {
    queueSelect('client_secondary_managers', null);

    const { result } = renderHook(() => useSecondaryManager('client-1'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();

    const call = state.calls.find(c => c.table === 'client_secondary_managers');
    expect(call?.filters).toContainEqual(['client_id', 'client-1']);
  });

  it('returns the record when one exists', async () => {
    const record = {
      id: 'rec-1',
      client_id: 'client-1',
      secondary_manager_id: 'mgr-1',
      phase: 'onboarding',
      created_by: 'user-exec-1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    queueSelect('client_secondary_managers', record);

    const { result } = renderHook(() => useSecondaryManager('client-1'), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 'rec-1', phase: 'onboarding' });
  });

  it('does not run when clientId is undefined', () => {
    const { result } = renderHook(() => useSecondaryManager(undefined), {
      wrapper: wrapper(),
    });

    // Query is disabled — status stays 'pending' and no network call is made.
    expect(result.current.fetchStatus).toBe('idle');
    const calls = state.calls.filter(c => c.table === 'client_secondary_managers');
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe('useSetSecondaryManager', () => {
  it('calls upsert with correct params and onConflict=client_id', async () => {
    const upserted = {
      id: 'rec-1',
      client_id: 'client-1',
      secondary_manager_id: 'mgr-2',
      phase: 'acompanhamento',
      created_by: 'user-exec-1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    state.upsertResponses.set('client_secondary_managers', { data: upserted, error: null });

    const { result } = renderHook(() => useSetSecondaryManager(), { wrapper: wrapper() });

    await result.current.mutateAsync({
      clientId: 'client-1',
      secondaryManagerId: 'mgr-2',
      phase: 'acompanhamento',
    });

    const call = state.calls.find(
      c => c.table === 'client_secondary_managers' && c.op === 'upsert',
    );
    expect(call).toBeDefined();
    expect(call?.onConflict).toBe('client_id');

    const payload = call?.payload as Record<string, unknown>;
    expect(payload.client_id).toBe('client-1');
    expect(payload.secondary_manager_id).toBe('mgr-2');
    expect(payload.phase).toBe('acompanhamento');
    expect(payload.created_by).toBe('user-exec-1');
  });

  it('invalidates secondary-manager and secondary-managers-bulk queries on success', async () => {
    state.upsertResponses.set('client_secondary_managers', {
      data: { id: 'rec-1', client_id: 'client-x' },
      error: null,
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useSetSecondaryManager(), {
      wrapper: localWrapper,
    });

    await result.current.mutateAsync({
      clientId: 'client-x',
      secondaryManagerId: 'mgr-3',
      phase: 'onboarding',
    });

    const keys = spy.mock.calls.map(c => (c[0] as { queryKey?: unknown[] })?.queryKey?.[0]);
    expect(keys).toContain('secondary-manager');
    expect(keys).toContain('secondary-managers-bulk');
    expect(keys).toContain('assigned-clients');
  });
});

// ---------------------------------------------------------------------------

describe('useRemoveSecondaryManager', () => {
  it('calls delete with client_id filter', async () => {
    const { result } = renderHook(() => useRemoveSecondaryManager(), { wrapper: wrapper() });

    await result.current.mutateAsync('client-99');

    const call = state.calls.find(
      c => c.table === 'client_secondary_managers' && c.op === 'delete',
    );
    expect(call).toBeDefined();
    expect(call?.filters).toContainEqual(['client_id', 'client-99']);
  });
});

// ---------------------------------------------------------------------------

describe('useSecondaryManagersBulk', () => {
  it('joins manager names from profiles', async () => {
    queueSelect('client_secondary_managers', [
      {
        id: 'r1',
        client_id: 'c1',
        secondary_manager_id: 'mgr-1',
        phase: 'onboarding',
        created_by: 'u1',
        created_at: '',
        updated_at: '',
      },
    ]);
    queueSelect('profiles', [{ user_id: 'mgr-1', name: 'Ana Lima' }]);

    const { result } = renderHook(() => useSecondaryManagersBulk(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      id: 'r1',
      manager_name: 'Ana Lima',
    });
  });

  it('returns empty array when no records', async () => {
    queueSelect('client_secondary_managers', []);

    const { result } = renderHook(() => useSecondaryManagersBulk(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });
});
