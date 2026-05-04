# Dual-Gestor ADS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a client to have a secondary ADS manager with phase-dependent behavior (onboarding = gets tasks, acompanhamento = kanban visibility only).

**Architecture:** New `client_secondary_managers` table with UNIQUE(client_id) constraint. Frontend hook `useSecondaryManager` for CRUD. Kanban query extended with OR clause. Task creation hooks duplicate tasks for secondary when phase=onboarding.

**Tech Stack:** Supabase (Postgres, RLS, pgTAP), React/TypeScript (vitest, Radix Dialog), TanStack Query

**Spec:** `docs/superpowers/specs/2026-05-04-dual-gestor-ads-design.md`

---

### Task 1: Migration — `client_secondary_managers` table + RLS + client SELECT policy

**Files:**
- Create: `supabase/migrations/20260504220000_client_secondary_managers.sql`
- Test: `supabase/tests/client_secondary_managers_rls_test.sql`

- [ ] **Step 1: Write pgTAP test**

```sql
-- supabase/tests/client_secondary_managers_rls_test.sql
BEGIN;
SELECT plan(10);

-- Setup: users
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('dd000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'dg-ceo@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('dd000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'dg-gestor1@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('dd000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'dg-gestor2@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('dd000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'dg-outsider@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email) VALUES
  ('dd000000-0000-0000-0000-000000000001', 'DG CEO', 'dg-ceo@test.local'),
  ('dd000000-0000-0000-0000-000000000002', 'DG Gestor1', 'dg-gestor1@test.local'),
  ('dd000000-0000-0000-0000-000000000003', 'DG Gestor2', 'dg-gestor2@test.local'),
  ('dd000000-0000-0000-0000-000000000004', 'DG Outsider', 'dg-outsider@test.local')
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.user_roles WHERE user_id IN (
  'dd000000-0000-0000-0000-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'dd000000-0000-0000-0000-000000000004'
);
INSERT INTO public.user_roles (user_id, role) VALUES
  ('dd000000-0000-0000-0000-000000000001', 'ceo'),
  ('dd000000-0000-0000-0000-000000000002', 'gestor_ads'),
  ('dd000000-0000-0000-0000-000000000003', 'gestor_ads'),
  ('dd000000-0000-0000-0000-000000000004', 'gestor_ads');

-- Setup: client
INSERT INTO public.clients (id, name, assigned_ads_manager) VALUES
  ('dd110000-0000-0000-0000-000000000001', 'DG Test Client', 'dd000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Setup: secondary manager record
INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by) VALUES
  ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000003', 'onboarding', 'dd000000-0000-0000-0000-000000000001');

-- Test 1: Admin can SELECT
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
SELECT is(
  (SELECT count(*)::int FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001'),
  1, 'admin can see secondary manager record'
);

-- Test 2: Secondary manager can SELECT own record
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000003')::text, true);
SELECT is(
  (SELECT count(*)::int FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001'),
  1, 'secondary manager can see own record'
);

-- Test 3: Outsider cannot SELECT
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000004')::text, true);
SELECT is(
  (SELECT count(*)::int FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001'),
  0, 'outsider cannot see secondary manager record'
);

-- Test 4: Admin can INSERT
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
DELETE FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001';
SELECT lives_ok(
  $$ INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by)
     VALUES ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000003', 'acompanhamento', 'dd000000-0000-0000-0000-000000000001') $$,
  'admin can insert secondary manager'
);

-- Test 5: Non-admin cannot INSERT
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000003')::text, true);
SELECT throws_ok(
  $$ INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by)
     VALUES ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000004', 'onboarding', 'dd000000-0000-0000-0000-000000000003') $$,
  NULL, NULL,
  'non-admin cannot insert secondary manager'
);

-- Test 6: Admin can UPDATE
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
SELECT lives_ok(
  $$ UPDATE public.client_secondary_managers SET phase = 'onboarding' WHERE client_id = 'dd110000-0000-0000-0000-000000000001' $$,
  'admin can update phase'
);

-- Test 7: Non-admin cannot UPDATE
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000003')::text, true);
SELECT throws_ok(
  $$ UPDATE public.client_secondary_managers SET phase = 'acompanhamento' WHERE client_id = 'dd110000-0000-0000-0000-000000000001' $$,
  NULL, NULL,
  'non-admin cannot update secondary manager'
);

-- Test 8: Admin can DELETE
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
SELECT lives_ok(
  $$ DELETE FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001' $$,
  'admin can delete secondary manager'
);

-- Test 9: UNIQUE constraint — only 1 secondary per client
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by)
VALUES ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000003', 'onboarding', 'dd000000-0000-0000-0000-000000000001');
SELECT throws_ok(
  $$ INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by)
     VALUES ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000004', 'onboarding', 'dd000000-0000-0000-0000-000000000001') $$,
  '23505', NULL,
  'UNIQUE constraint prevents 2 secondary managers per client'
);

-- Test 10: Secondary manager can view client via new RLS policy on clients table
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000003')::text, true);
SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id = 'dd110000-0000-0000-0000-000000000001'),
  1, 'secondary manager can SELECT client via secondary_manager_can_view policy'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write migration**

```sql
-- supabase/migrations/20260504220000_client_secondary_managers.sql
BEGIN;

CREATE TABLE public.client_secondary_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  secondary_manager_id UUID NOT NULL REFERENCES auth.users(id),
  phase TEXT NOT NULL CHECK (phase IN ('onboarding', 'acompanhamento')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

CREATE INDEX idx_csm_secondary_manager ON public.client_secondary_managers(secondary_manager_id);
CREATE INDEX idx_csm_client ON public.client_secondary_managers(client_id);

ALTER TABLE public.client_secondary_managers ENABLE ROW LEVEL SECURITY;

-- SELECT: secondary manager sees own, admins see all
CREATE POLICY "csm_select" ON public.client_secondary_managers
  FOR SELECT USING (
    secondary_manager_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- INSERT/UPDATE/DELETE: admins only
CREATE POLICY "csm_admin_insert" ON public.client_secondary_managers
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "csm_admin_update" ON public.client_secondary_managers
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "csm_admin_delete" ON public.client_secondary_managers
  FOR DELETE USING (public.is_admin(auth.uid()));

-- Secondary manager can also view the client row in clients table
CREATE POLICY "secondary_manager_can_view_client" ON public.clients
  FOR SELECT USING (
    id IN (SELECT client_id FROM public.client_secondary_managers WHERE secondary_manager_id = auth.uid())
  );

-- updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.client_secondary_managers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
```

- [ ] **Step 3: Apply migration to remote DB**

Run: `SUPABASE_ACCESS_TOKEN=<token> supabase db query --linked -f supabase/migrations/20260504220000_client_secondary_managers.sql`
Expected: empty rows (success)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260504220000_client_secondary_managers.sql supabase/tests/client_secondary_managers_rls_test.sql
git commit -m "feat(db): add client_secondary_managers table with RLS + pgTAP tests"
```

---

### Task 2: Hook — `useSecondaryManager`

**Files:**
- Create: `src/hooks/useSecondaryManager.ts`
- Test: `src/hooks/useSecondaryManager.test.tsx`

- [ ] **Step 1: Write vitest test**

```typescript
// src/hooks/useSecondaryManager.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-ceo', role: 'ceo' }, isCEO: true }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSecondaryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when client has no secondary manager', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const { useSecondaryManager } = await import('@/hooks/useSecondaryManager');
    const { result } = renderHook(() => useSecondaryManager('client-1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it('returns secondary manager record when exists', async () => {
    const record = {
      id: 'csm-1',
      client_id: 'client-1',
      secondary_manager_id: 'gestor-2',
      phase: 'onboarding',
      created_by: 'u-ceo',
    };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: record, error: null }),
        }),
      }),
    });

    const { useSecondaryManager } = await import('@/hooks/useSecondaryManager');
    const { result } = renderHook(() => useSecondaryManager('client-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(record));
  });
});

describe('useSetSecondaryManager', () => {
  it('upserts secondary manager record', async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'csm-1' }, error: null }),
      }),
    });
    mockFrom.mockReturnValue({ upsert: upsertMock });

    const { useSetSecondaryManager } = await import('@/hooks/useSecondaryManager');
    const { result } = renderHook(() => useSetSecondaryManager(), { wrapper });

    await result.current.mutateAsync({
      clientId: 'client-1',
      secondaryManagerId: 'gestor-2',
      phase: 'onboarding',
    });

    expect(mockFrom).toHaveBeenCalledWith('client_secondary_managers');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-1',
        secondary_manager_id: 'gestor-2',
        phase: 'onboarding',
      }),
      expect.objectContaining({ onConflict: 'client_id' }),
    );
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/hooks/useSecondaryManager.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement hook**

```typescript
// src/hooks/useSecondaryManager.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SecondaryManagerRecord {
  id: string;
  client_id: string;
  secondary_manager_id: string;
  phase: 'onboarding' | 'acompanhamento';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useSecondaryManager(clientId: string | undefined) {
  return useQuery({
    queryKey: ['secondary-manager', clientId],
    queryFn: async (): Promise<SecondaryManagerRecord | null> => {
      const { data, error } = await supabase
        .from('client_secondary_managers')
        .select('*')
        .eq('client_id', clientId!)
        .maybeSingle();

      if (error) throw error;
      return data as SecondaryManagerRecord | null;
    },
    enabled: !!clientId,
  });
}

export function useSetSecondaryManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      clientId,
      secondaryManagerId,
      phase,
    }: {
      clientId: string;
      secondaryManagerId: string;
      phase: 'onboarding' | 'acompanhamento';
    }) => {
      const { data, error } = await supabase
        .from('client_secondary_managers')
        .upsert(
          {
            client_id: clientId,
            secondary_manager_id: secondaryManagerId,
            phase,
            created_by: user!.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'client_id' },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { clientId }) => {
      toast.success('Gestor secundário salvo');
      queryClient.invalidateQueries({ queryKey: ['secondary-manager', clientId] });
      queryClient.invalidateQueries({ queryKey: ['secondary-managers-bulk'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
    },
    onError: () => toast.error('Erro ao salvar gestor secundário'),
  });
}

export function useRemoveSecondaryManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('client_secondary_managers')
        .delete()
        .eq('client_id', clientId);

      if (error) throw error;
    },
    onSuccess: (_, clientId) => {
      toast.success('Gestor secundário removido');
      queryClient.invalidateQueries({ queryKey: ['secondary-manager', clientId] });
      queryClient.invalidateQueries({ queryKey: ['secondary-managers-bulk'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-clients'] });
    },
    onError: () => toast.error('Erro ao remover gestor secundário'),
  });
}

export function useSecondaryManagersBulk() {
  return useQuery({
    queryKey: ['secondary-managers-bulk'],
    queryFn: async (): Promise<(SecondaryManagerRecord & { manager_name: string })[]> => {
      const { data: records, error } = await supabase
        .from('client_secondary_managers')
        .select('*');

      if (error) throw error;
      if (!records || records.length === 0) return [];

      const managerIds = [...new Set(records.map(r => r.secondary_manager_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', managerIds);

      const nameMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p.name;
        return acc;
      }, {} as Record<string, string>);

      return records.map(r => ({
        ...(r as SecondaryManagerRecord),
        manager_name: nameMap[r.secondary_manager_id] || 'Sem nome',
      }));
    },
    staleTime: 30_000,
  });
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/hooks/useSecondaryManager.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSecondaryManager.ts src/hooks/useSecondaryManager.test.tsx
git commit -m "feat: add useSecondaryManager hook with CRUD + bulk query + vitest tests"
```

---

### Task 3: Modal — `SecondaryManagerModal`

**Files:**
- Create: `src/components/client/SecondaryManagerModal.tsx`

- [ ] **Step 1: Implement modal component**

```typescript
// src/components/client/SecondaryManagerModal.tsx
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAdsManagers } from '@/hooks/useClientRegistration';
import {
  useSecondaryManager,
  useSetSecondaryManager,
  useRemoveSecondaryManager,
} from '@/hooks/useSecondaryManager';
import { cn } from '@/lib/utils';
import { Users, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  primaryManagerId: string | null;
  primaryManagerName: string;
}

export default function SecondaryManagerModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  primaryManagerId,
  primaryManagerName,
}: Props) {
  const { data: existing, isLoading: loadingExisting } = useSecondaryManager(open ? clientId : undefined);
  const { data: allManagers = [] } = useAdsManagers();
  const setSecondary = useSetSecondaryManager();
  const removeSecondary = useRemoveSecondaryManager();

  const [phase, setPhase] = useState<'onboarding' | 'acompanhamento'>('onboarding');
  const [selectedManagerId, setSelectedManagerId] = useState('');

  useEffect(() => {
    if (existing) {
      setPhase(existing.phase);
      setSelectedManagerId(existing.secondary_manager_id);
    } else {
      setPhase('onboarding');
      setSelectedManagerId('');
    }
  }, [existing, open]);

  const availableManagers = allManagers.filter(m => m.user_id !== primaryManagerId);

  const handleSave = async () => {
    if (!selectedManagerId) return;
    await setSecondary.mutateAsync({
      clientId,
      secondaryManagerId: selectedManagerId,
      phase,
    });
    onOpenChange(false);
  };

  const handleRemove = async () => {
    await removeSecondary.mutateAsync(clientId);
    onOpenChange(false);
  };

  const isEditing = !!existing;
  const isSaving = setSecondary.isPending || removeSecondary.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gestor Secundário
          </DialogTitle>
          <DialogDescription>
            {clientName} · Gestor principal: {primaryManagerName}
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Phase toggle */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fase do cliente
              </label>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setPhase('onboarding')}
                  className={cn(
                    'flex-1 rounded-lg border p-3 text-center transition-colors',
                    phase === 'onboarding'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30',
                  )}
                >
                  <div className="text-sm font-semibold">Onboarding</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Recebe tarefas</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('acompanhamento')}
                  className={cn(
                    'flex-1 rounded-lg border p-3 text-center transition-colors',
                    phase === 'acompanhamento'
                      ? 'border-success bg-success/10 text-success'
                      : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30',
                  )}
                >
                  <div className="text-sm font-semibold">Acompanhamento</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Só visualiza</div>
                </button>
              </div>
            </div>

            {/* Manager select */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Gestor secundário
              </label>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full mt-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Selecionar gestor...</option>
                {availableManagers.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                disabled={!selectedManagerId || isSaving}
                className="flex-1"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
              {isEditing && (
                <Button
                  variant="destructive"
                  onClick={handleRemove}
                  disabled={isSaving}
                >
                  Remover
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i secondary`
Expected: no errors (may need types.ts regeneration — if so, add `client_secondary_managers` type manually to satisfy compiler until next `supabase gen types` run)

- [ ] **Step 3: Commit**

```bash
git add src/components/client/SecondaryManagerModal.tsx
git commit -m "feat: add SecondaryManagerModal component"
```

---

### Task 4: Button + Label in `ClientListPage`

**Files:**
- Modify: `src/pages/ClientListPage.tsx`

- [ ] **Step 1: Add imports and hook at top of component**

At the imports section (~line 29), add:

```typescript
import SecondaryManagerModal from '@/components/client/SecondaryManagerModal';
import { useSecondaryManagersBulk } from '@/hooks/useSecondaryManager';
```

Inside the component function (after `const updateAssignment = useUpdateClientAssignment();` ~line 105), add:

```typescript
const { data: secondaryManagers = [] } = useSecondaryManagersBulk();
const [secondaryModalClient, setSecondaryModalClient] = useState<{
  id: string;
  name: string;
  primaryManagerId: string | null;
  primaryManagerName: string;
} | null>(null);

const getSecondaryForClient = (clientId: string) =>
  secondaryManagers.find(sm => sm.client_id === clientId) || null;
```

- [ ] **Step 2: Add button in actions column**

In the actions `<TableCell>` (~line 856-893), inside the `<>` fragment that contains "+ Venda" and "Churn" buttons, add before the Venda button:

```typescript
{(() => {
  const secondary = getSecondaryForClient(client.id);
  const gestorName = managerOptions?.gestores.find(g => g.id === client.assigned_ads_manager)?.name || 'Sem gestor';
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setSecondaryModalClient({
        id: client.id,
        name: client.name,
        primaryManagerId: client.assigned_ads_manager,
        primaryManagerName: gestorName,
      })}
      className={cn(
        'gap-1',
        secondary
          ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
          : '',
      )}
    >
      <Users className="w-3 h-3" />
      {secondary ? '2 Gestores' : '+ Gestor'}
    </Button>
  );
})()}
```

- [ ] **Step 3: Add secondary manager label in expanded row**

After the Treinador label (~line 719 for CEO / ~line 728 for non-CEO), add in both branches:

```typescript
{(() => {
  const secondary = getSecondaryForClient(client.id);
  if (!secondary) return null;
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">2º Gestor:</span>
      <span className="text-[10px] text-primary">{secondary.manager_name}</span>
    </div>
  );
})()}
```

- [ ] **Step 4: Render modal at component level**

Before the closing `</>` of the component return, add:

```typescript
<SecondaryManagerModal
  open={!!secondaryModalClient}
  onOpenChange={(open) => !open && setSecondaryModalClient(null)}
  clientId={secondaryModalClient?.id || ''}
  clientName={secondaryModalClient?.name || ''}
  primaryManagerId={secondaryModalClient?.primaryManagerId || null}
  primaryManagerName={secondaryModalClient?.primaryManagerName || ''}
/>
```

- [ ] **Step 5: Add `Users` import from lucide-react**

In the lucide-react import line, add `Users` to the destructured imports.

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 7: Commit**

```bash
git add src/pages/ClientListPage.tsx
git commit -m "feat(clients): add dual-gestor button + modal + label in client list"
```

---

### Task 5: Kanban query — secondary manager sees clients

**Files:**
- Modify: `src/hooks/useAdsManager.ts:135-178`
- Test: `src/hooks/useAdsManager.secondary.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// src/hooks/useAdsManager.secondary.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnValue({
        order: mockOrder.mockReturnValue({
          or: mockOr.mockReturnValue({
            eq: mockEq.mockResolvedValue({ data: [], error: null }),
          }),
          eq: mockEq.mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    })),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'gestor-2', role: 'gestor_ads' }, isCEO: false }),
}));

vi.mock('@/hooks/useTargetAdsManager', () => ({
  useTargetAdsManager: () => ({ targetUserId: null }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAssignedClients with secondary manager', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes secondary-manager clients in query via OR filter', async () => {
    const { useAssignedClients } = await import('@/hooks/useAdsManager');
    renderHook(() => useAssignedClients(), { wrapper });

    await waitFor(() => {
      expect(mockOr).toHaveBeenCalled();
      const orArg = mockOr.mock.calls[0]?.[0];
      expect(orArg).toContain('client_secondary_managers');
    });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/hooks/useAdsManager.secondary.test.tsx`
Expected: FAIL — OR filter doesn't include client_secondary_managers

- [ ] **Step 3: Modify `useAssignedClients` query**

In `src/hooks/useAdsManager.ts`, replace lines 155-158:

Before:
```typescript
if (effectiveUserId && shouldFilterByManager) {
  query = query.eq('assigned_ads_manager', effectiveUserId);
}
```

After:
```typescript
if (effectiveUserId && shouldFilterByManager) {
  query = query.or(
    `assigned_ads_manager.eq.${effectiveUserId},id.in.(select client_id from client_secondary_managers where secondary_manager_id eq '${effectiveUserId}' )`,
  );
}
```

**Note:** Supabase PostgREST `or` filter with embedded select. If this doesn't work with PostgREST subselect syntax, fall back to two queries merged client-side:

```typescript
if (effectiveUserId && shouldFilterByManager) {
  // Primary clients
  const primaryQuery = supabase
    .from('clients')
    .select(selectFields)
    .eq('assigned_ads_manager', effectiveUserId)
    .order('created_at', { ascending: false });

  // Secondary client IDs
  const { data: secondaryRecords } = await supabase
    .from('client_secondary_managers')
    .select('client_id')
    .eq('secondary_manager_id', effectiveUserId);

  const secondaryIds = (secondaryRecords || []).map(r => r.client_id);

  let secondaryClients: Client[] = [];
  if (secondaryIds.length > 0) {
    const { data } = await supabase
      .from('clients')
      .select(selectFields)
      .in('id', secondaryIds)
      .order('created_at', { ascending: false });
    secondaryClients = (data || []) as Client[];
  }

  if (!isCEO) {
    primaryQuery.eq('archived', false);
  } else {
    primaryQuery.or('archived.eq.false,and(archived.eq.true,status.eq.churned)');
  }

  const { data: primaryClients, error } = await primaryQuery;
  if (error) throw error;

  // Merge and dedupe
  const seen = new Set((primaryClients || []).map(c => c.id));
  const merged = [...(primaryClients || [])];
  for (const c of secondaryClients) {
    if (!seen.has(c.id)) {
      if (!isCEO && c.archived) continue;
      merged.push(c);
    }
  }
  return merged;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/hooks/useAdsManager.secondary.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAdsManager.ts src/hooks/useAdsManager.secondary.test.tsx
git commit -m "feat(kanban): extend useAssignedClients to include secondary manager clients"
```

---

### Task 6: Task duplication — secondary manager gets onboarding tasks

**Files:**
- Modify: `src/hooks/useOnboardingAutomation.ts`

- [ ] **Step 1: Create helper to duplicate task for secondary manager**

Add at the top of the file (after imports):

```typescript
import { supabase } from '@/integrations/supabase/client';

async function duplicateTaskForSecondaryManager(
  clientId: string,
  taskInsert: {
    client_id: string;
    task_type: string;
    title: string;
    description: string;
    status: string;
    due_date: string;
    milestone: string;
  },
) {
  const { data: secondary } = await supabase
    .from('client_secondary_managers')
    .select('secondary_manager_id, phase')
    .eq('client_id', clientId)
    .maybeSingle();

  if (!secondary || secondary.phase !== 'onboarding') return;

  const { data: existing } = await supabase
    .from('onboarding_tasks')
    .select('id')
    .eq('client_id', clientId)
    .eq('task_type', taskInsert.task_type)
    .eq('assigned_to', secondary.secondary_manager_id)
    .maybeSingle();

  if (existing) return;

  await supabase
    .from('onboarding_tasks')
    .insert({
      ...taskInsert,
      assigned_to: secondary.secondary_manager_id,
    });
}
```

- [ ] **Step 2: Call helper after each task insert**

After the `await supabase.from('onboarding_tasks').insert(...)` block at line ~527, add:

```typescript
await duplicateTaskForSecondaryManager(clientId, {
  client_id: clientId,
  task_type: taskTemplate.taskType,
  title: title,
  description: taskTemplate.description,
  status: 'pending',
  due_date: dueDate.toISOString(),
  milestone: taskTemplate.milestone,
});
```

Do the same after the single-next-task insert at line ~560:

```typescript
await duplicateTaskForSecondaryManager(clientId, {
  client_id: clientId,
  task_type: taskDef.nextTask,
  title: nextTaskDef.title,
  description: `${nextTaskDef.description} Cliente: ${clientName}.`,
  status: 'pending',
  due_date: dueDate.toISOString(),
  milestone: nextTaskDef.milestone,
});
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useOnboardingAutomation.ts
git commit -m "feat(tasks): duplicate onboarding tasks for secondary manager when phase=onboarding"
```

---

### Task 7: Supabase types regeneration

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Regenerate types**

Run: `SUPABASE_ACCESS_TOKEN=<token> supabase gen types typescript --linked > src/integrations/supabase/types.ts`

If that fails (due to CLI version), manually add the type block for `client_secondary_managers` in the types file following the existing pattern.

- [ ] **Step 2: TypeScript check full project**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore: regenerate supabase types with client_secondary_managers"
```

---

### Task 8: Integration test — full flow (Playwright)

**Files:**
- Create: `e2e/dual-gestor.spec.ts` (or appropriate e2e directory)

- [ ] **Step 1: Write Playwright test**

```typescript
// e2e/dual-gestor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dual-Gestor ADS', () => {
  test.beforeEach(async ({ page }) => {
    // Login as CEO
    await page.goto('/');
    // ... login flow (adapt to project's auth pattern)
  });

  test('can add secondary manager to client', async ({ page }) => {
    await page.goto('/clientes');
    await page.waitForSelector('table');

    // Find a client row and click "+ Gestor" button
    const gestorButton = page.locator('button:has-text("+ Gestor")').first();
    await expect(gestorButton).toBeVisible();
    await gestorButton.click();

    // Modal opens
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Gestor Secundário')).toBeVisible();

    // Select phase
    await page.locator('text=Onboarding').click();

    // Select manager from dropdown
    const select = page.locator('select').last();
    await select.selectOption({ index: 1 });

    // Save
    await page.locator('button:has-text("Salvar")').click();

    // Modal closes
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // Button changed to "2 Gestores"
    await expect(page.locator('button:has-text("2 Gestores")').first()).toBeVisible();
  });

  test('can edit and remove secondary manager', async ({ page }) => {
    await page.goto('/clientes');
    await page.waitForSelector('table');

    // Click "2 Gestores" button (assumes previous test left one)
    const editButton = page.locator('button:has-text("2 Gestores")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Remove
      await page.locator('button:has-text("Remover")').click();
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();

      // Button reverted to "+ Gestor"
      await expect(page.locator('button:has-text("+ Gestor")').first()).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: Run Playwright**

Run: `npx playwright test e2e/dual-gestor.spec.ts --headed`
Expected: visual confirmation of flow

- [ ] **Step 3: Commit**

```bash
git add e2e/dual-gestor.spec.ts
git commit -m "test(e2e): add Playwright tests for dual-gestor ADS flow"
```

---

### Task 9: Final — full regression + push

- [ ] **Step 1: Run all vitest tests**

Run: `npx vitest run`
Expected: all pass, no regressions

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Push to main**

```bash
git push origin main
```
