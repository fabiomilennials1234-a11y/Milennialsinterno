import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ---------------------------------------------------------------------------
// Supabase mock — builder chain that records calls and lets each test decide
// what data to return per (table, op) pair. The goal is to assert the SQL
// intent ("was delete called?", "was a select for justifications made?")
// without hitting a real DB.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface CallRecord {
  table: string;
  op: 'select' | 'insert' | 'delete' | 'update';
  filters: Array<[string, unknown]>;
  payload?: unknown;
}

const state = {
  calls: [] as CallRecord[],
  // Per-table select responses, keyed by insertion order.
  selectResponses: new Map<string, Array<{ data: Row[] | Row | null; error: unknown }>>(),
  // Per-table insert responses.
  insertResponses: new Map<string, { data: Row | null; error: unknown }>(),
};

function nextSelectResponse(table: string) {
  const queue = state.selectResponses.get(table) ?? [];
  const head = queue.shift() ?? { data: [], error: null };
  state.selectResponses.set(table, queue);
  return head;
}

function makeBuilder(table: string, op: CallRecord['op']) {
  const record: CallRecord = { table, op, filters: [] };
  state.calls.push(record);

  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: (payload: unknown) => {
      record.payload = payload;
      record.op = 'insert';
      return builder;
    },
    delete: () => {
      record.op = 'delete';
      return builder;
    },
    update: (payload: unknown) => {
      record.payload = payload;
      record.op = 'update';
      return builder;
    },
    eq: (col: string, val: unknown) => {
      record.filters.push([col, val]);
      return builder;
    },
    is: (col: string, val: unknown) => {
      record.filters.push([`${col} IS`, val]);
      return builder;
    },
    in: (col: string, val: unknown) => {
      record.filters.push([`${col} IN`, val]);
      return builder;
    },
    neq: (col: string, val: unknown) => {
      record.filters.push([`${col} !=`, val]);
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    // Terminal resolvers — return a promise.
    maybeSingle: () => {
      const res = nextSelectResponse(table);
      const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
      return Promise.resolve({ data, error: res.error });
    },
    single: () => {
      if (record.op === 'insert') {
        const res = state.insertResponses.get(table) ?? { data: null, error: null };
        return Promise.resolve(res);
      }
      const res = nextSelectResponse(table);
      const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
      return Promise.resolve({ data, error: res.error });
    },
    // Non-terminal promise (e.g. `await supabase.from(...).delete().eq(...)`).
    then: (resolve: (v: { data: Row[]; error: unknown }) => void) => {
      if (record.op === 'select') {
        const res = nextSelectResponse(table);
        const data = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
        return Promise.resolve({ data, error: res.error }).then(resolve);
      }
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };

  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table, 'select'),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    }),
    removeChannel: () => {},
  },
}));

// AuthContext mock — consistent user across tests.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'consultor_comercial' },
    isCEO: false,
  }),
}));

// Silence toast side-effects.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports under test — must come after mocks.
// ---------------------------------------------------------------------------

import {
  useSaveComercialJustification,
  useCreateComercialDelayNotification,
} from './useComercialDelayNotifications';

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return Wrapper;
}

function queueSelect(table: string, data: Row[] | Row | null) {
  const queue = state.selectResponses.get(table) ?? [];
  queue.push({ data, error: null });
  state.selectResponses.set(table, queue);
}

function setInsertResponse(table: string, data: Row) {
  state.insertResponses.set(table, { data, error: null });
}

beforeEach(() => {
  state.calls = [];
  state.selectResponses.clear();
  state.insertResponses.clear();
});

// ---------------------------------------------------------------------------
// Regression: bug "justificativas infinitas" (2026-04-24)
// Root cause: saving a justification deleted the notification row, so the
// 5-min re-check would recreate it, reopening the modal forever.
// Fix: remove the DELETE; add justification-aware dedup to creation path.
// ---------------------------------------------------------------------------

describe('useSaveComercialJustification', () => {
  it('inserts justification and does NOT delete the notification row', async () => {
    // Arrange — calls in order:
    // 1) select notification by id (.single)
    // 2) select profile name (.single)
    // 3) insert justification (.select.single)
    queueSelect('comercial_delay_notifications', {
      id: 'notif-1',
      notification_type: 'novo_cliente_24h',
      client_name: 'Acme',
    });
    queueSelect('profiles', { name: 'Jane' });
    setInsertResponse('comercial_delay_justifications', {
      id: 'just-1',
      notification_id: 'notif-1',
    });

    const { result } = renderHook(() => useSaveComercialJustification(), {
      wrapper: wrapper(),
    });

    await result.current.mutateAsync({
      notificationId: 'notif-1',
      justification: 'travou no cliente',
    });

    const deleteCalls = state.calls.filter(
      c => c.table === 'comercial_delay_notifications' && c.op === 'delete',
    );
    const insertJust = state.calls.filter(
      c => c.table === 'comercial_delay_justifications' && c.op === 'insert',
    );

    expect(deleteCalls).toHaveLength(0);
    expect(insertJust).toHaveLength(1);
  });
});

describe('useCreateComercialDelayNotification', () => {
  it('returns null (skips insert) when a justification already exists for (user, type, client)', async () => {
    // hasActiveJustificationForDelay flow:
    // 1) select notifications matching (user_id, type, client_id) → returns 1 row
    // 2) select justifications where notification_id IN (...) → returns 1 row
    queueSelect('comercial_delay_notifications', [{ id: 'notif-old' }]);
    queueSelect('comercial_delay_justifications', [{ id: 'just-old' }]);

    const { result } = renderHook(() => useCreateComercialDelayNotification(), {
      wrapper: wrapper(),
    });

    const res = await result.current.mutateAsync({
      user_id: 'user-1',
      user_name: 'Jane',
      notification_type: 'novo_cliente_24h',
      client_id: 'client-1',
      client_name: 'Acme',
    });

    expect(res).toBeNull();

    const inserts = state.calls.filter(
      c => c.table === 'comercial_delay_notifications' && c.op === 'insert',
    );
    expect(inserts).toHaveLength(0);
  });

  it('reuses existing unresolved notification when no justification exists yet', async () => {
    // 1) hasActiveJustificationForDelay: notifications query → empty
    //    (justifications query is short-circuited)
    // 2) dedup existing notification query → returns existing row
    queueSelect('comercial_delay_notifications', []);
    queueSelect('comercial_delay_notifications', { id: 'notif-existing' });

    const { result } = renderHook(() => useCreateComercialDelayNotification(), {
      wrapper: wrapper(),
    });

    const res = await result.current.mutateAsync({
      user_id: 'user-1',
      user_name: 'Jane',
      notification_type: 'novo_cliente_24h',
      client_id: 'client-1',
      client_name: 'Acme',
    });

    expect(res).toEqual({ id: 'notif-existing' });
    const inserts = state.calls.filter(
      c => c.table === 'comercial_delay_notifications' && c.op === 'insert',
    );
    expect(inserts).toHaveLength(0);
  });

  it('inserts a new notification when none exists and no justification exists', async () => {
    // 1) hasActiveJustificationForDelay: no notifications → []
    // 2) dedup: no existing notification → null
    // 3) insert → new row
    queueSelect('comercial_delay_notifications', []);
    queueSelect('comercial_delay_notifications', null);
    setInsertResponse('comercial_delay_notifications', { id: 'notif-new' });

    const { result } = renderHook(() => useCreateComercialDelayNotification(), {
      wrapper: wrapper(),
    });

    const res = await result.current.mutateAsync({
      user_id: 'user-1',
      user_name: 'Jane',
      notification_type: 'novo_cliente_24h',
      client_id: 'client-1',
      client_name: 'Acme',
    });

    await waitFor(() => {
      expect(res).toEqual({ id: 'notif-new' });
    });

    const inserts = state.calls.filter(
      c => c.table === 'comercial_delay_notifications' && c.op === 'insert',
    );
    expect(inserts).toHaveLength(1);
  });
});
