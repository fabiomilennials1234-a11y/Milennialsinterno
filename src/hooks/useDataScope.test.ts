import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDataScope } from './useDataScope';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/usePageAccess', () => ({
  usePageAccess: vi.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';

const mockedUseAuth = vi.mocked(useAuth);
const mockedUsePageAccess = vi.mocked(usePageAccess);

function setupAuth(opts: { isAdminUser?: boolean; isCEO?: boolean } = {}) {
  mockedUseAuth.mockReturnValue({
    isAdminUser: opts.isAdminUser ?? false,
    isCEO: opts.isCEO ?? false,
  } as any);
}

function setupPageAccess(opts: {
  data?: string[];
  isSuccess?: boolean;
  isError?: boolean;
}) {
  mockedUsePageAccess.mockReturnValue({
    data: opts.data,
    isSuccess: opts.isSuccess ?? false,
    isError: opts.isError ?? false,
  } as any);
}

describe('useDataScope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin bypass: seesAll=true and isReady=true synchronously, even before pageAccess resolves', () => {
    setupAuth({ isAdminUser: true });
    setupPageAccess({ data: undefined, isSuccess: false, isError: false });

    const { result } = renderHook(() => useDataScope('gestor-crm'));

    expect(result.current.seesAll).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.scopeKey).toBe('all');
  });

  it('CEO bypass behaves like admin', () => {
    setupAuth({ isCEO: true });
    setupPageAccess({ data: undefined, isSuccess: false, isError: false });

    const { result } = renderHook(() => useDataScope('gestor-crm'));

    expect(result.current.seesAll).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.scopeKey).toBe('all');
  });

  it('non-admin, pageAccess pending: isReady=false and scopeKey="pending"', () => {
    setupAuth();
    setupPageAccess({ data: undefined, isSuccess: false, isError: false });

    const { result } = renderHook(() => useDataScope('gestor-crm'));

    expect(result.current.seesAll).toBe(false);
    expect(result.current.isReady).toBe(false);
    expect(result.current.scopeKey).toBe('pending');
  });

  it('non-admin, pageAccess resolved with grant: seesAll=true, scopeKey="all"', () => {
    setupAuth();
    setupPageAccess({ data: ['gestor-crm', 'design'], isSuccess: true });

    const { result } = renderHook(() => useDataScope('gestor-crm'));

    expect(result.current.seesAll).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.scopeKey).toBe('all');
  });

  it('non-admin, pageAccess resolved without grant: seesAll=false, scopeKey="mine"', () => {
    setupAuth();
    setupPageAccess({ data: ['design'], isSuccess: true });

    const { result } = renderHook(() => useDataScope('gestor-crm'));

    expect(result.current.seesAll).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.scopeKey).toBe('mine');
  });

  it('pageAccess error: isReady=true with seesAll=false (fail-closed)', () => {
    setupAuth();
    setupPageAccess({ data: undefined, isSuccess: false, isError: true });

    const { result } = renderHook(() => useDataScope('gestor-crm'));

    expect(result.current.seesAll).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.scopeKey).toBe('mine');
  });

  it('undefined pageSlug: seesAll=false, isReady=true (fail-closed for unknown slug)', () => {
    setupAuth();
    setupPageAccess({ data: ['gestor-crm'], isSuccess: true });

    const { result } = renderHook(() => useDataScope(undefined));

    expect(result.current.seesAll).toBe(false);
    expect(result.current.isReady).toBe(true);
    expect(result.current.scopeKey).toBe('mine');
  });

  it('undefined pageSlug + admin: seesAll=true (admin still bypasses)', () => {
    setupAuth({ isAdminUser: true });
    setupPageAccess({ data: undefined, isSuccess: false });

    const { result } = renderHook(() => useDataScope(undefined));

    expect(result.current.seesAll).toBe(true);
    expect(result.current.scopeKey).toBe('all');
  });
});
