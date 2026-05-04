# Page-grant data scope race condition fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the race condition that hides data from users with `user_page_grants` cross-functional access (e.g. consultor_comercial with `gestor-crm` grant) by introducing a canonical `useDataScope` hook and migrating 13 call sites in 5 hooks.

**Architecture:** Centralize the `seesAll` derivation that today is duplicated across data hooks. The new helper exposes `{ seesAll, isReady, scopeKey }`. Consumers put `scopeKey` in their React Query `queryKey` (so refetch fires when the page-grant lookup resolves) and gate their `enabled` with `isReady` (so the first request doesn't run with stale `seesAll=false`). Each hook migration is a mechanical 3-line change with no behavioral diff for admin/native-role users.

**Tech Stack:** React Query, TypeScript, Vitest + @testing-library/react, existing `usePageAccess` RPC, existing `useAuth` context.

**Spec:** `docs/superpowers/specs/2026-05-04-page-grant-data-scope-fix-design.md`

---

## File map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/hooks/useDataScope.ts` | Canonical `seesAll`/`isReady`/`scopeKey` helper |
| Create | `src/hooks/useDataScope.test.ts` | Unit tests for the helper |
| Modify | `src/hooks/useCrmKanban.ts` | 7 query hooks → `useDataScope('gestor-crm')` |
| Modify | `src/hooks/useMktplaceKanban.ts` | 3 query hooks → `useDataScope('consultor-mktplace')` |
| Modify | `src/hooks/useDepartmentTasks.ts` | `useDepartmentTasks` → `useDataScope(DEPARTMENT_TO_PAGE_SLUG[department])` |
| Modify | `src/hooks/useOutboundManager.ts` | `useOutboundTasks` → compose `useDataScope('outbound')` with `targetUserId` |
| Modify | `src/hooks/useOnboardingTasks.ts` | `useOnboardingTasks` → compose `useDataScope('sucesso-cliente')` with `targetUserId` |

Each modified file gets its own commit. Bisect-friendly.

---

### Task 1: Create the `useDataScope` helper

**Files:**
- Create: `src/hooks/useDataScope.ts`
- Test: `src/hooks/useDataScope.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useDataScope.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useDataScope.test.ts`
Expected: FAIL with module not found `'./useDataScope'`.

- [ ] **Step 3: Implement the helper**

Create `src/hooks/useDataScope.ts`:

```ts
import { useAuth } from '@/contexts/AuthContext';
import { usePageAccess } from '@/hooks/usePageAccess';

export interface DataScopeResult {
  /** True quando o user vê dados completos da página (admin/CEO/page_grant). */
  seesAll: boolean;
  /**
   * True quando o cálculo de `seesAll` é confiável.
   * Admin/CEO: true síncrono.
   * Demais: true após `usePageAccess` resolver (sucesso ou erro).
   * Use como gate em `enabled` da useQuery pra evitar query "fantasma"
   * com seesAll=false antes de pageAccess chegar.
   */
  isReady: boolean;
  /**
   * Identidade estável pra entrar em `queryKey`. Muda quando `seesAll` muda,
   * forçando React Query a refetch quando o user passa de "pending" pra "all".
   */
  scopeKey: 'all' | 'mine' | 'pending';
}

/**
 * Resolve scope de leitura por página.
 *
 * Substitui o padrão duplicado:
 *   const { isAdminUser, isCEO } = useAuth();
 *   const { data: pageAccess = [] } = usePageAccess();
 *   const seesAll = isAdminUser || isCEO || pageAccess.includes(slug);
 *
 * Esse padrão tinha race: queryKey não incluía pageAccess, então refetch
 * não acontecia quando a RPC resolvia. Aqui `scopeKey` resolve isso.
 *
 * Slug undefined → seesAll=false fail-closed (exceto admin/CEO bypass).
 * Erro na RPC pageAccess → isReady=true com seesAll=false (fail-closed).
 */
export function useDataScope(pageSlug: string | undefined): DataScopeResult {
  const { isAdminUser, isCEO } = useAuth();
  const { data: pageAccess, isSuccess, isError } = usePageAccess();

  const adminBypass = isAdminUser || isCEO;
  const isReady = adminBypass || isSuccess || isError;
  const seesAll =
    adminBypass || (!!pageSlug && (pageAccess?.includes(pageSlug) ?? false));
  const scopeKey: DataScopeResult['scopeKey'] = !isReady
    ? 'pending'
    : seesAll
      ? 'all'
      : 'mine';

  return { seesAll, isReady, scopeKey };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useDataScope.test.ts`
Expected: PASS — 8 tests passing.

- [ ] **Step 5: Type-check the new files**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors related to the new files.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDataScope.ts src/hooks/useDataScope.test.ts
git commit -m "$(cat <<'EOF'
feat(hooks): useDataScope canonical page-grant scope resolver

Centraliza o cálculo de seesAll/isReady/scopeKey usado por hooks de
leitura. Resolve race condition onde queryKey não incluía pageAccess,
deixando users com user_page_grants vendo dados parciais até logout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Migrate `useCrmKanban.ts` (7 sites)

**Files:**
- Modify: `src/hooks/useCrmKanban.ts` (lines 256-464)

The 7 hooks all share the same shape. The migration is mechanical:

1. Replace the trio `useAuth() partial + usePageAccess() + seesAll computation` with `useAuth() (only what's still needed) + useDataScope('gestor-crm')`.
2. Replace `user?.role` in `queryKey` with `scopeKey` (and keep `user?.role` only when the role is also needed for branching, which here it is — the fallback filter checks `user?.role === 'gestor_crm'`). Add `scopeKey` to queryKey alongside `user?.role` to be conservative.
3. Add `isReady &&` to the `enabled`.

- [ ] **Step 1: Add the import**

In `src/hooks/useCrmKanban.ts`, locate line 4:

```ts
import { usePageAccess } from '@/hooks/usePageAccess';
```

Replace with:

```ts
import { useDataScope } from '@/hooks/useDataScope';
```

(`usePageAccess` is no longer used directly in this file after migration.)

- [ ] **Step 2: Migrate `useCrmKanbanClients` (lines 256-284)**

Replace lines 257-261:

```ts
  const { user, isAdminUser, isCEO } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  // gestor_crm operacional padrão filtra. Mas user com page_grant 'gestor-crm'
  // (ex: cargo cross-funcional) ou admin enxergam tudo.
  const seesAll = isAdminUser || isCEO || pageAccess.includes('gestor-crm');
```

With:

```ts
  const { user } = useAuth();
  // gestor_crm operacional padrão filtra. Mas user com page_grant 'gestor-crm'
  // (ex: cargo cross-funcional) ou admin enxergam tudo.
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');
```

Replace `queryKey: ['crm-kanban-clients', user?.id, user?.role],` with:

```ts
    queryKey: ['crm-kanban-clients', user?.id, user?.role, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 3: Migrate `useCrmNovosClientes` (lines 287-313)**

Replace lines 288-290:

```ts
  const { user, isAdminUser, isCEO } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  const seesAll = isAdminUser || isCEO || pageAccess.includes('gestor-crm');
```

With:

```ts
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');
```

Replace `queryKey: ['crm-novos-clientes', user?.id, user?.role],` with:

```ts
    queryKey: ['crm-novos-clientes', user?.id, user?.role, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 4: Migrate `useCrmBoasVindasClientes` (lines 316-342)**

Replace lines 317-319:

```ts
  const { user, isAdminUser, isCEO } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  const seesAll = isAdminUser || isCEO || pageAccess.includes('gestor-crm');
```

With:

```ts
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');
```

Replace `queryKey: ['crm-boasvindas-clientes', user?.id, user?.role],` with:

```ts
    queryKey: ['crm-boasvindas-clientes', user?.id, user?.role, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 5: Migrate `useCrmTracking` (lines 345-368)**

Replace lines 346-348:

```ts
  const { user, isAdminUser, isCEO } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  const seesAll = isAdminUser || isCEO || pageAccess.includes('gestor-crm');
```

With:

```ts
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');
```

Replace `queryKey: ['crm-tracking', user?.id, user?.role],` with:

```ts
    queryKey: ['crm-tracking', user?.id, user?.role, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 6: Migrate `useCrmTodayDocumentedClients` (lines 375-405)**

Replace lines 376-378:

```ts
  const { user, isAdminUser, isCEO } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  const seesAll = isAdminUser || isCEO || pageAccess.includes('gestor-crm');
```

With:

```ts
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');
```

Replace `queryKey: ['crm-today-documented', user?.id, user?.role],` with:

```ts
    queryKey: ['crm-today-documented', user?.id, user?.role, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

(Keep `refetchInterval: 60_000`.)

- [ ] **Step 7: Migrate `useCrmDocumentation` (lines 408-431)**

Replace lines 409-411:

```ts
  const { user, isAdminUser, isCEO } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  const seesAll = isAdminUser || isCEO || pageAccess.includes('gestor-crm');
```

With:

```ts
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');
```

Replace `queryKey: ['crm-documentation', user?.id, user?.role],` with:

```ts
    queryKey: ['crm-documentation', user?.id, user?.role, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 8: Migrate `useCrmConfiguracoes` (lines 437-464)**

Replace lines 438-441:

```ts
  const { user, isAdminUser, isCEO } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  const { produto, finalizado } = opts;
  const seesAll = isAdminUser || isCEO || pageAccess.includes('gestor-crm');
```

With:

```ts
  const { user } = useAuth();
  const { produto, finalizado } = opts;
  const { seesAll, isReady, scopeKey } = useDataScope('gestor-crm');
```

Replace `queryKey: ['crm-configuracoes', user?.id, user?.role, produto ?? 'all', finalizado ?? 'any'],` with:

```ts
    queryKey: ['crm-configuracoes', user?.id, user?.role, produto ?? 'all', finalizado ?? 'any', scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 9: Verify no remaining `pageAccess.includes` in this file**

Run: `grep -n "pageAccess" src/hooks/useCrmKanban.ts`
Expected: empty output (zero matches).

Run: `grep -n "isAdminUser\|isCEO" src/hooks/useCrmKanban.ts`
Expected: empty output (those came only with the old pattern).

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 11: Run existing tests**

Run: `npx vitest run`
Expected: all tests pass (no regression).

- [ ] **Step 12: Commit**

```bash
git add src/hooks/useCrmKanban.ts
git commit -m "$(cat <<'EOF'
fix(crm-kanban): adopt useDataScope to fix page-grant race condition

Os 7 hooks de leitura do CRM passam a usar useDataScope('gestor-crm').
queryKey ganha scopeKey e enabled fica gated em isReady — refetch
automático quando pageAccess resolve.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migrate `useMktplaceKanban.ts` (3 sites)

**Files:**
- Modify: `src/hooks/useMktplaceKanban.ts` (lines 87-167)

Same mechanical pattern, slug `consultor-mktplace`.

- [ ] **Step 1: Switch the import**

Locate the existing import line in `src/hooks/useMktplaceKanban.ts`:

```ts
import { usePageAccess } from '@/hooks/usePageAccess';
```

Replace with:

```ts
import { useDataScope } from '@/hooks/useDataScope';
```

- [ ] **Step 2: Migrate `useMktplaceClients` (lines 87-115)**

Replace lines 88-92:

```ts
  const { user, isCEO, isAdminUser } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  // page_grant 'consultor-mktplace' libera visão geral. Owner natural
  // (consultor_mktplace) sem grant continua filtrado pelos seus clientes.
  const seesAll = isAdminUser || isCEO || pageAccess.includes('consultor-mktplace');
```

With:

```ts
  const { user } = useAuth();
  // page_grant 'consultor-mktplace' libera visão geral. Owner natural
  // (consultor_mktplace) sem grant continua filtrado pelos seus clientes.
  const { seesAll, isReady, scopeKey } = useDataScope('consultor-mktplace');
```

Replace `queryKey: ['mktplace-all-clients', user?.id],` with:

```ts
    queryKey: ['mktplace-all-clients', user?.id, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 3: Migrate `useMktplaceTracking` (lines 118-141)**

Replace lines 119-121:

```ts
  const { user, isCEO, isAdminUser } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  const seesAll = isAdminUser || isCEO || pageAccess.includes('consultor-mktplace');
```

With:

```ts
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('consultor-mktplace');
```

Replace `queryKey: ['mktplace-tracking', user?.id],` with:

```ts
    queryKey: ['mktplace-tracking', user?.id, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 4: Migrate `useMktplaceDocumentation` (lines 144-167)**

Replace lines 145-147:

```ts
  const { user, isCEO, isAdminUser } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();
  const seesAll = isAdminUser || isCEO || pageAccess.includes('consultor-mktplace');
```

With:

```ts
  const { user } = useAuth();
  const { seesAll, isReady, scopeKey } = useDataScope('consultor-mktplace');
```

Replace `queryKey: ['mktplace-documentation', user?.id],` with:

```ts
    queryKey: ['mktplace-documentation', user?.id, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 5: Verify clean migration**

Run: `grep -n "pageAccess\|isAdminUser\|isCEO" src/hooks/useMktplaceKanban.ts`
Expected: empty output.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 7: Run tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useMktplaceKanban.ts
git commit -m "$(cat <<'EOF'
fix(mktplace-kanban): adopt useDataScope to fix page-grant race condition

Hooks useMktplaceClients/Tracking/Documentation passam a usar
useDataScope('consultor-mktplace'). scopeKey em queryKey + isReady em
enabled — refetch automático quando pageAccess resolve.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Migrate `useDepartmentTasks.ts` (1 site, dynamic slug)

**Files:**
- Modify: `src/hooks/useDepartmentTasks.ts` (lines 53-64)

The slug here is dynamic (department → slug via `DEPARTMENT_TO_PAGE_SLUG`). `useDataScope(undefined)` is fail-closed, which preserves today's behavior when the department isn't mapped.

- [ ] **Step 1: Add the import**

In `src/hooks/useDepartmentTasks.ts`, locate the imports block. Add:

```ts
import { useDataScope } from '@/hooks/useDataScope';
```

Remove the `usePageAccess` import (line 4):

```ts
import { usePageAccess } from '@/hooks/usePageAccess';
```

(Verify nothing else in this file still uses it.)

- [ ] **Step 2: Migrate `useDepartmentTasks` body (lines 53-64)**

Replace lines 54-61:

```ts
export function useDepartmentTasks(department: string, type: 'daily' | 'weekly' = 'daily') {
  const { user, isAdminUser, isCEO } = useAuth();
  const { data: pageAccess = [] } = usePageAccess();

  // page_grant: user com grant na página do department vê dados completos
  // (não é owner natural — owner já passa direto pelo RLS via has_role).
  // Admin (ceo/cto/gestor_projetos) bypass via RLS — também ignora filtro.
  const slug = DEPARTMENT_TO_PAGE_SLUG[department];
  const seesAll = isAdminUser || isCEO || (!!slug && pageAccess.includes(slug));
```

With:

```ts
export function useDepartmentTasks(department: string, type: 'daily' | 'weekly' = 'daily') {
  const { user } = useAuth();

  // page_grant: user com grant na página do department vê dados completos
  // (não é owner natural — owner já passa direto pelo RLS via has_role).
  // Admin (ceo/cto/gestor_projetos) bypass via RLS — também ignora filtro.
  const slug = DEPARTMENT_TO_PAGE_SLUG[department];
  const { seesAll, isReady, scopeKey } = useDataScope(slug);
```

Replace `queryKey: ['department-tasks', user?.id, department, type],` with:

```ts
    queryKey: ['department-tasks', user?.id, department, type, scopeKey],
```

Replace `enabled: !!user?.id,` with:

```ts
    enabled: isReady && !!user?.id,
```

- [ ] **Step 3: Verify clean migration**

Run: `grep -n "pageAccess\|isAdminUser\|isCEO" src/hooks/useDepartmentTasks.ts`
Expected: empty output.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDepartmentTasks.ts
git commit -m "$(cat <<'EOF'
fix(department-tasks): adopt useDataScope to fix page-grant race condition

useDepartmentTasks resolve o slug dinamicamente via DEPARTMENT_TO_PAGE_SLUG
e passa pra useDataScope. scopeKey em queryKey + isReady em enabled —
refetch automático quando pageAccess resolve. Slug undefined permanece
fail-closed (alinha com filtro existente).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Migrate `useOutboundManager.ts` (1 site, with `targetUserId`)

**Files:**
- Modify: `src/hooks/useOutboundManager.ts` (lines 175-207)

This hook has `targetUserId` semantics: when a CEO is inspecting a specific manager, `seesAll` must be false regardless of grant. Compose `useDataScope` with the `targetUserId` guard.

- [ ] **Step 1: Switch the import**

In `src/hooks/useOutboundManager.ts`, locate:

```ts
import { usePageAccess } from '@/hooks/usePageAccess';
```

Replace with:

```ts
import { useDataScope } from '@/hooks/useDataScope';
```

(Verify nothing else uses `usePageAccess` in this file.)

- [ ] **Step 2: Migrate `useOutboundTasks` (lines 176-207)**

Replace lines 177-185:

```ts
  const { user, isAdminUser, isCEO } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const { data: pageAccess = [] } = usePageAccess();

  const effectiveUserId = targetUserId || user?.id;
  // page_grant 'outbound' libera visão geral; targetUserId força filtro
  // (CEO inspeciona um manager específico). Owner natural já passa via role.
  const seesAll =
    !targetUserId && (isAdminUser || isCEO || pageAccess.includes('outbound'));
```

With:

```ts
  const { user } = useAuth();
  const { targetUserId } = useTargetOutboundManager();
  const { seesAll: pageSeesAll, isReady, scopeKey } = useDataScope('outbound');

  const effectiveUserId = targetUserId || user?.id;
  // page_grant 'outbound' libera visão geral; targetUserId força filtro
  // (CEO inspeciona um manager específico). Owner natural já passa via role.
  const seesAll = !targetUserId && pageSeesAll;
```

Replace `queryKey: ['outbound-tasks', taskType, effectiveUserId],` with:

```ts
    queryKey: ['outbound-tasks', taskType, effectiveUserId, scopeKey],
```

Replace `enabled: !!effectiveUserId,` with:

```ts
    enabled: isReady && !!effectiveUserId,
```

- [ ] **Step 3: Verify clean migration**

Run: `grep -n "pageAccess\|isAdminUser\|isCEO" src/hooks/useOutboundManager.ts`
Expected: empty output.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useOutboundManager.ts
git commit -m "$(cat <<'EOF'
fix(outbound): adopt useDataScope to fix page-grant race condition

useOutboundTasks compõe useDataScope('outbound') com guarda de
targetUserId. scopeKey em queryKey + isReady em enabled — refetch
automático quando pageAccess resolve.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Migrate `useOnboardingTasks.ts` (1 site, with `targetUserId`)

**Files:**
- Modify: `src/hooks/useOnboardingTasks.ts` (lines 33-62)

Same `targetUserId` composition as Task 5, slug `sucesso-cliente`.

- [ ] **Step 1: Switch the import**

In `src/hooks/useOnboardingTasks.ts`, locate:

```ts
import { usePageAccess } from '@/hooks/usePageAccess';
```

Replace with:

```ts
import { useDataScope } from '@/hooks/useDataScope';
```

- [ ] **Step 2: Migrate `useOnboardingTasks` (lines 33-62)**

Replace lines 34-42:

```ts
  const { user, isAdminUser, isCEO } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const { data: pageAccess = [] } = usePageAccess();
  const queryClient = useQueryClient();

  const effectiveUserId = targetUserId || user?.id;
  // page_grant 'sucesso-cliente' libera visão geral; targetUserId força filtro.
  const seesAll =
    !targetUserId && (isAdminUser || isCEO || pageAccess.includes('sucesso-cliente'));
```

With:

```ts
  const { user } = useAuth();
  const { targetUserId } = useTargetAdsManager();
  const { seesAll: pageSeesAll, isReady, scopeKey } = useDataScope('sucesso-cliente');
  const queryClient = useQueryClient();

  const effectiveUserId = targetUserId || user?.id;
  // page_grant 'sucesso-cliente' libera visão geral; targetUserId força filtro.
  const seesAll = !targetUserId && pageSeesAll;
```

Replace `queryKey: ['onboarding-tasks', effectiveUserId],` with:

```ts
    queryKey: ['onboarding-tasks', effectiveUserId, scopeKey],
```

Replace `enabled: !!effectiveUserId,` with:

```ts
    enabled: isReady && !!effectiveUserId,
```

- [ ] **Step 3: Verify clean migration**

Run: `grep -n "pageAccess\|isAdminUser\|isCEO" src/hooks/useOnboardingTasks.ts`
Expected: empty output.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useOnboardingTasks.ts
git commit -m "$(cat <<'EOF'
fix(onboarding): adopt useDataScope to fix page-grant race condition

useOnboardingTasks compõe useDataScope('sucesso-cliente') com guarda
de targetUserId. scopeKey em queryKey + isReady em enabled — refetch
automático quando pageAccess resolve.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Manual smoke test in browser

**Goal:** Confirm the bug is fixed end-to-end and no regression for native roles or admins.

- [ ] **Step 1: Repo-wide grep for the old pattern**

Run: `grep -rn "pageAccess.includes" --include="*.ts" --include="*.tsx" src/`
Expected: zero matches in `src/hooks/use{Crm,Mktplace,Outbound,Onboarding,Department}*`. The only remaining matches (if any) should be in `usePageDataScope.ts`, `useSidebarPermissions.ts`, or `usePermissionDivergenceLogger.ts` — which are intentionally out of scope.

If a hook in scope still has the old pattern, it was missed — go back and migrate.

- [ ] **Step 2: Full type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: all pass, including the 8 new `useDataScope` tests.

- [ ] **Step 4: Start the dev server**

Run: `npm run dev`
Open: the URL printed (typically `http://localhost:5173` or `http://localhost:8080`).

- [ ] **Step 5: Bug-fix verification (treinador comercial + grant gestor-crm)**

Pre-condition: identify or create a test user with `role='consultor_comercial'` and `additional_pages: ['gestor-crm']`. The grant flow is: admin user (ceo/cto) opens UsersPage → edits the test user → adds "CRM PRO+" in the "Páginas adicionais" selector → saves.

Test:
1. Log in as the treinador comercial.
2. Navigate to `/gestor-crm`.
3. Verify each column is populated:
   - "Tarefas Diárias" — shows tasks from any `gestor_crm` user, not just from the treinador
   - "Novos clientes" — shows all clients with `crm_status='novo'` and `assigned_crm` set, regardless of who is assigned
   - "Boas-vindas" — same, for `crm_status='boas_vindas'`
   - "Acompanhamento diário" — shows clients across all 5 weekdays from all gestores
   - "Configuração V8/Automation/Copilot" — shows configurations from all gestores
   - "Justificativa" — shows pending and resolved justifications from all gestores
4. Open browser DevTools → Network tab. Reload the page. Verify the requests to `department_tasks`, `clients`, `crm_daily_tracking`, `crm_configuracoes` happen **after** the `get_my_page_access` RPC resolves (or you can confirm by Watching the same request fire twice if pageAccess is slow — once with `scopeKey=pending` blocked by `enabled=false`, once with `scopeKey=all`).

- [ ] **Step 6: Regression — admin / CEO**

Test:
1. Log in as a `ceo` or `cto` user.
2. Navigate to `/gestor-crm`, `/consultor-mktplace`, `/outbound`, `/sucesso-cliente`, `/financeiro`.
3. Verify all columns show data and feel snappy (no extra wait for `pageAccess`).
4. DevTools Network: confirm queries fire immediately on page load (no `enabled: false` gating).

- [ ] **Step 7: Regression — gestor_crm nativo (no grant)**

Test:
1. Log in as a `gestor_crm` user that does NOT have any `additional_pages` set.
2. Navigate to `/gestor-crm`.
3. Verify columns show ONLY clients/tasks where the gestor is the natural owner (`assigned_crm = his.id`).

If the columns are empty when they shouldn't be (or show OTHER gestores' work) the migration broke the fallback filter — investigate `seesAll` and the `if (!seesAll && user?.role === 'gestor_crm')` block in the affected hook.

- [ ] **Step 8: Regression — consultor_mktplace nativo (no grant)**

Test:
1. Log in as a `consultor_mktplace` user without grants.
2. Navigate to `/consultor-mktplace`.
3. Verify only his own assigned clients show up.

- [ ] **Step 9: Regression — `targetUserId` flow**

Test:
1. Log in as `ceo`.
2. Navigate to a page that uses `useTargetOutboundManager` or `useTargetAdsManager` (typically a CEO inspector view that lets you "view as" a specific manager).
3. Set `targetUserId` to a specific manager.
4. Verify the listing filters down to only that manager's tasks.

- [ ] **Step 10: Final commit if anything was tweaked**

If steps 5-9 surfaced no issues, no extra commit is needed.

If a fix was needed, commit it on top:

```bash
git add <touched files>
git commit -m "$(cat <<'EOF'
fix(useDataScope rollout): <describe the specific tweak>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (post-write)

- [x] Spec coverage: every section of the spec has a corresponding task. Task 1 covers the helper. Tasks 2-6 cover the migration table. Task 7 covers manual testing and regression. Out-of-scope items (ESLint rule, realtime invalidation, mapping centralization, `usePageDataScope` migration) are explicitly NOT in any task.
- [x] No placeholders: every step has the actual code, command, or expected output.
- [x] Type consistency: `seesAll`, `isReady`, `scopeKey` names are identical across the helper definition (Task 1) and every consumer (Tasks 2-6). The `pageSeesAll` rename is local-only and used consistently in Tasks 5 and 6 where composition with `targetUserId` is needed.
- [x] No missed hooks: `grep` step in Task 7 catches anything that slipped through.
