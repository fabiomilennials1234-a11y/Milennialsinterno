import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useJustificativasCount,
  useJustificativasPendentes,
  useJustificativasDoneMine,
  useJustificativasTeam,
  useSubmitJustificativa,
} from './useJustificativas';

vi.mock('@/integrations/supabase/client', () => {
  const rpc = vi.fn();
  return { supabase: { rpc } };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'design' } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useJustificativas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useJustificativasCount retorna comprimento da lista pendente', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{ notification_id: 'n1' }, { notification_id: 'n2' }],
      error: null,
    });
    const { result } = renderHook(() => useJustificativasCount(), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(supabase.rpc).toHaveBeenCalledWith('get_justifications_pending_mine');
  });

  it('useJustificativasPendentes retorna lista', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{ notification_id: 'n1' }],
      error: null,
    });
    const { result } = renderHook(() => useJustificativasPendentes(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
  });

  it('useJustificativasDoneMine chama RPC done', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useJustificativasDoneMine(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabase.rpc).toHaveBeenCalledWith('get_justifications_done_mine');
  });

  it('useJustificativasTeam passa only_pending', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useJustificativasTeam(true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabase.rpc).toHaveBeenCalledWith('get_justifications_team_grouped', {
      p_only_pending: true,
    });
  });

  it('useSubmitJustificativa invalida 3 queries', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: 'new-id', error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(client, 'invalidateQueries');
    const localWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSubmitJustificativa(), { wrapper: localWrapper });
    await result.current.mutateAsync({ notificationId: 'n1', text: 'ok' });
    const keys = spy.mock.calls.map(c => (c[0] as any)?.queryKey?.[0]);
    expect(keys).toContain('justif-pending-mine');
    expect(keys).toContain('justif-done-mine');
    expect(keys).toContain('justif-team');
  });
});
