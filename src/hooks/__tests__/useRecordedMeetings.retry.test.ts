import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createElement } from 'react';

// ── Records: which table/update calls and which edge fn invocations happened ──
const updateCalls: { table: string; payload: Record<string, unknown>; id: string }[] = [];
const invokeCalls: { fn: string; body: unknown }[] = [];

function makeUpdateBuilder(table: string) {
  let payload: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {
    update: (p: Record<string, unknown>) => {
      payload = p;
      return builder;
    },
    eq: (_col: string, id: string) => {
      updateCalls.push({ table, payload, id });
      return Promise.resolve({ error: null });
    },
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => makeUpdateBuilder(table),
    functions: {
      invoke: (fn: string, opts: { body: unknown }) => {
        invokeCalls.push({ fn, body: opts.body });
        return Promise.resolve({ data: { status: 'ok' }, error: null });
      },
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Tester' } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useRecordedMeetings } from '../useRecordedMeetings';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  updateCalls.length = 0;
  invokeCalls.length = 0;
});

describe('useRecordedMeetings — retry idempotente', () => {
  it('retryTranscript: marca pending e invoca transcribe-meeting com o recording_id', async () => {
    const { result } = renderHook(() => useRecordedMeetings(), { wrapper });

    await act(async () => {
      await result.current.retryTranscript.mutateAsync('rec-1');
    });

    expect(invokeCalls).toEqual([{ fn: 'transcribe-meeting', body: { recording_id: 'rec-1' } }]);
    const update = updateCalls.find((c) => c.table === 'recorded_meetings');
    expect(update?.id).toBe('rec-1');
    expect(update?.payload).toMatchObject({ transcript_status: 'pending', transcript_error: null });
  });

  it('retryAta: marca pending e invoca generate-meeting-ata com o recording_id', async () => {
    const { result } = renderHook(() => useRecordedMeetings(), { wrapper });

    await act(async () => {
      await result.current.retryAta.mutateAsync('rec-2');
    });

    expect(invokeCalls).toEqual([{ fn: 'generate-meeting-ata', body: { recording_id: 'rec-2' } }]);
    const update = updateCalls.find((c) => c.table === 'recorded_meetings');
    expect(update?.id).toBe('rec-2');
    expect(update?.payload).toMatchObject({ ata_status: 'pending', ata_error: null });
  });

  it('retryTranscript não invoca generate-meeting-ata (não cruza as funções)', async () => {
    const { result } = renderHook(() => useRecordedMeetings(), { wrapper });
    await act(async () => {
      await result.current.retryTranscript.mutateAsync('rec-3');
    });
    expect(invokeCalls.map((c) => c.fn)).not.toContain('generate-meeting-ata');
  });
});
