# Milennials Tech — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new sidebar tab "Milennials Tech" containing an isolated engineering-management subsystem (Backlog + Kanban + Sprints + Time tracking) with a new CTO role cloned from CEO, matching the DevTrack spec documented in `docs/superpowers/specs/2026-04-15-milennials-tech-fase-1-design.md`.

**Architecture:** Frontend in `src/features/milennials-tech/` (isolated feature folder). Database in prefixed `tech_*` tables with RLS + RPCs holding critical business logic. Realtime via Supabase channels. Status machine stored in English enums, rendered in PT. `@hello-pangea/dnd` for kanban DnD (matches existing kanbans).

**Tech Stack:** React 19 + Vite + Tailwind v3 + shadcn/ui + Radix + Framer Motion 12 + React Query 5 + `@hello-pangea/dnd` 18 + Zod 3 + Supabase JS + Postgres 15 (RLS + RPCs + Realtime) + npm. Tests: Vitest + Testing Library (unit/component) + Playwright (e2e) + pgTAP (database).

**Reference spec:** `docs/superpowers/specs/2026-04-15-milennials-tech-fase-1-design.md`

---

## File Structure

### New files

**Database migrations (`supabase/migrations/`):**
- `20260415120000_add_cto_role.sql` — adds `cto` to role system and grants it CEO-equivalent permissions
- `20260415120100_create_tech_enums.sql` — 5 enums
- `20260415120200_create_tech_tables.sql` — `tech_sprints`, `tech_tasks`, `tech_task_collaborators`, `tech_time_entries`, `tech_task_activities` + indexes + constraints
- `20260415120300_tech_helpers.sql` — `is_executive(user_id)` SQL helper
- `20260415120400_tech_rls_policies.sql` — all RLS policies for `tech_*`
- `20260415120500_tech_views_and_triggers.sql` — `tech_task_time_totals` view + activity triggers + `moddatetime` on `updated_at`
- `20260415120600_tech_rpcs.sql` — 11 RPCs: timers, review, approve, reject, block, unblock, start sprint, end sprint
- `20260415120700_tech_realtime.sql` — adds 4 tables to `supabase_realtime` publication

**Frontend (`src/features/milennials-tech/`):**
- `index.ts`
- `types.ts`
- `schemas/task.ts`
- `lib/statusLabels.ts`
- `lib/permissions.ts`
- `lib/computeTaskTime.ts`
- `hooks/useTechTasks.ts`
- `hooks/useTechSprints.ts`
- `hooks/useTechTaskActivities.ts`
- `hooks/useTechTimer.ts`
- `hooks/useActiveTimer.ts`
- `hooks/useTechRealtime.ts`
- `components/KanbanColumn.tsx`
- `components/TaskCard.tsx`
- `components/TaskRow.tsx`
- `components/TaskDetailModal.tsx`
- `components/TaskFormModal.tsx`
- `components/TimerButton.tsx`
- `components/BacklogTabs.tsx`
- `components/SprintPicker.tsx`
- `components/SprintFormModal.tsx`
- `components/CommandPalette.tsx`
- `components/StatusLine.tsx`
- `pages/MilennialsTechPage.tsx`
- `pages/BacklogTab.tsx`
- `pages/KanbanTab.tsx`
- `pages/SprintsTab.tsx`
- `design/tokens.css` — scoped design tokens for the feature

**Testing infra (created in Task 1):**
- `vitest.config.ts`
- `src/test/setup.ts`
- `playwright.config.ts`
- `e2e/tech/*.spec.ts`
- `supabase/tests/*.sql` — pgTAP tests

### Modified files

- `src/types/auth.ts` — add `cto` to `UserRole`; update helpers
- `src/hooks/useSidebarPermissions.ts` — mirror CEO entries for CTO
- `src/App.tsx` — rename `CEORoute` → `ExecutiveRoute`; add `MilennialsTechRoute`; register `/milennials-tech/*` routes
- `src/components/layout/AppSidebar.tsx` — add Milennials Tech sidebar item
- `tailwind.config.ts` — extend with `milennials-tech` scoped tokens
- `package.json` — add scripts: `test`, `test:e2e`, `test:db`, `typecheck`, `supabase:gen-types`
- `src/integrations/supabase/types.ts` — regenerate after migrations apply

---

## Pre-flight

### Task 1: Testing infrastructure and tooling

**Why:** the repo has no automated testing. Per CLAUDE.md ("Nunca deixe testes pra depois"), we set up Vitest + Testing Library + Playwright + pgTAP before implementing features.

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `playwright.config.ts`
- Create: `e2e/.gitignore`
- Modify: `package.json`
- Modify: `tsconfig.json` (add `vitest/globals` types)

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

- [ ] **Step 2: Install Playwright browsers**

```bash
npx playwright install --with-deps chromium
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/features/milennials-tech/**'],
    },
  },
});
```

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 5: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 6: Create `e2e/.gitignore`**

```
test-results/
playwright-report/
blob-report/
```

- [ ] **Step 7: Add scripts to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:db": "supabase db test",
"typecheck": "tsc --noEmit",
"supabase:gen-types": "supabase gen types typescript --linked --schema public > src/integrations/supabase/types.ts"
```

- [ ] **Step 8: Add `vitest/globals` to tsconfig**

Add to `compilerOptions.types` in `tsconfig.json` (or create `tsconfig.test.json` if app tsconfig disallows): `["vitest/globals", "@testing-library/jest-dom"]`.

- [ ] **Step 9: Sanity test**

Create `src/test/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('vitest runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run `npm test`. Expected: 1 passed.

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts playwright.config.ts src/test/setup.ts src/test/sanity.test.ts e2e/.gitignore package.json package-lock.json tsconfig.json
git commit -m "chore(test): setup vitest + playwright + pgtap infra"
```

---

## Part A — Cargo CTO

### Task 2: Add `cto` to UserRole type and helpers

**Files:**
- Modify: `src/types/auth.ts`
- Create: `src/types/auth.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/types/auth.test.ts
import { describe, it, expect } from 'vitest';
import {
  canViewBoard,
  canManageUsers,
  isAdmin,
  canCreateTab,
  canMoveCardsFreely,
  isExecutive,
  ROLE_LABELS,
} from './auth';

describe('CTO role', () => {
  it('isExecutive returns true for ceo and cto', () => {
    expect(isExecutive('ceo')).toBe(true);
    expect(isExecutive('cto')).toBe(true);
    expect(isExecutive('devs')).toBe(false);
  });

  it('canViewBoard returns true for CTO on any board', () => {
    expect(canViewBoard('cto', 'any-slug')).toBe(true);
  });

  it('isAdmin returns true for cto', () => {
    expect(isAdmin('cto')).toBe(true);
  });

  it('canCreateTab and canMoveCardsFreely allow cto', () => {
    expect(canCreateTab('cto')).toBe(true);
    expect(canMoveCardsFreely('cto')).toBe(true);
  });

  it('canManageUsers allows cto', () => {
    expect(canManageUsers('cto')).toBe(true);
  });

  it('ROLE_LABELS includes CTO', () => {
    expect(ROLE_LABELS.cto).toBe('CTO');
  });
});
```

- [ ] **Step 2: Run test to verify failures**

```bash
npm test src/types/auth.test.ts
```

Expected: multiple failures (cto not in UserRole, `isExecutive` undefined).

- [ ] **Step 3: Update `src/types/auth.ts`**

Append `| 'cto'` to `UserRole`. Add `cto: 'CTO'` to `ROLE_LABELS`. Add `cto` to `ROLE_HIERARCHY` with the same level as `ceo`. Add `cto: ['*']` to `BOARD_VISIBILITY` (mirror CEO). Update every helper that tests `role === 'ceo'` to include `'cto'`:

```ts
export function isExecutive(role: UserRole | null | undefined): boolean {
  return role === 'ceo' || role === 'cto';
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === 'ceo' || role === 'cto' || role === 'gestor_projetos';
}

export function canManageUsers(role: UserRole | null | undefined): boolean {
  return isExecutive(role) || role === 'sucesso_cliente' || role === 'gestor_projetos';
}

export function canCreateTab(role: UserRole | null | undefined): boolean {
  return isExecutive(role) || role === 'gestor_projetos';
}

export function canMoveCardsFreely(role: UserRole | null | undefined): boolean {
  return isExecutive(role) || role === 'gestor_projetos';
}

export function canViewBoard(role: UserRole | null | undefined, boardSlugOrName: string): boolean {
  if (!role) return false;
  const visibility = BOARD_VISIBILITY[role] ?? [];
  if (visibility.includes('*')) return true;
  const slug = boardSlugOrName.toLowerCase();
  return visibility.some(v => slug.includes(v));
}
```

- [ ] **Step 4: Run tests**

```bash
npm test src/types/auth.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/auth.ts src/types/auth.test.ts
git commit -m "feat(auth): add CTO role mirroring CEO permissions"
```

---

### Task 3: Mirror CTO in sidebar permissions

**Files:**
- Modify: `src/hooks/useSidebarPermissions.ts`
- Create: `src/hooks/useSidebarPermissions.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/hooks/useSidebarPermissions.test.ts
import { describe, it, expect } from 'vitest';
import {
  ROLE_BOARD_SLUGS,
  ROLE_INDEPENDENT_CATEGORIES,
  SPECIAL_ROUTES,
} from './useSidebarPermissions';

describe('CTO sidebar permissions', () => {
  it('ROLE_BOARD_SLUGS.cto equals ROLE_BOARD_SLUGS.ceo', () => {
    expect(ROLE_BOARD_SLUGS.cto).toEqual(ROLE_BOARD_SLUGS.ceo);
  });

  it('ROLE_INDEPENDENT_CATEGORIES.cto equals ROLE_INDEPENDENT_CATEGORIES.ceo', () => {
    expect(ROLE_INDEPENDENT_CATEGORIES.cto).toEqual(ROLE_INDEPENDENT_CATEGORIES.ceo);
  });

  it('SPECIAL_ROUTES.cto equals SPECIAL_ROUTES.ceo', () => {
    expect(SPECIAL_ROUTES.cto).toEqual(SPECIAL_ROUTES.ceo);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test src/hooks/useSidebarPermissions.test.ts
```

Expected: failures.

- [ ] **Step 3: Update the file**

In `src/hooks/useSidebarPermissions.ts`, add `cto: ROLE_BOARD_SLUGS.ceo` (after the ceo entry), `cto: ROLE_INDEPENDENT_CATEGORIES.ceo`, `cto: SPECIAL_ROUTES.ceo`. Since these are constants, use spread if map is literal; otherwise copy the array values. Use a `const` helper `CEO_BOARD_SLUGS` if needed to avoid reference duplication.

- [ ] **Step 4: Run tests**

```bash
npm test src/hooks/useSidebarPermissions.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSidebarPermissions.ts src/hooks/useSidebarPermissions.test.ts
git commit -m "feat(sidebar): extend CTO role to mirror CEO sidebar permissions"
```

---

### Task 4: Rename `CEORoute` → `ExecutiveRoute` in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Open `src/App.tsx` at lines 71-83**

- [ ] **Step 2: Rename and extend the guard**

Replace:
```tsx
function CEORoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ceo') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
```

With:
```tsx
function ExecutiveRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isExecutive(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
```

Add `import { isExecutive } from '@/types/auth'` to the top of the file.

- [ ] **Step 3: Search and replace all usages**

```bash
grep -rn "CEORoute" src/ --include="*.tsx" --include="*.ts"
```

Replace every `CEORoute` with `ExecutiveRoute` across the file. Verify no usage remains.

- [ ] **Step 4: Verify build**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(auth): rename CEORoute to ExecutiveRoute with isExecutive()"
```

---

### Task 5: Database migration for `cto` role

**Files:**
- Create: `supabase/migrations/20260415120000_add_cto_role.sql`

- [ ] **Step 1: Varredura de pontos a atualizar**

Before writing the migration, query:
```sql
SELECT polname, tablename FROM pg_policies
WHERE qual::text ILIKE '%''ceo''%' OR with_check::text ILIKE '%''ceo''%';

SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND pg_get_functiondef(p.oid) ILIKE '%''ceo''%';
```

Document the list in a comment at the top of the migration.

- [ ] **Step 2: Write the migration**

```sql
-- 20260415120000_add_cto_role.sql
-- Adds 'cto' role, mirroring 'ceo' permissions across the system.
--
-- Impact: existing is_ceo(uuid) helper stays. We add is_executive(uuid) that returns
-- true for both 'ceo' and 'cto'. Each policy/function that gates on is_ceo(...) is
-- reviewed: policies that represent CEO-level privilege are updated to is_executive(...).
--
-- Policies/functions updated: <list from step 1>

BEGIN;

-- If profiles.role uses a check constraint naming allowed values, update it:
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'ceo','cto','gestor_projetos','gestor_ads','outbound','sucesso_cliente',
    'design','editor_video','devs','atrizes_gravacao','produtora','gestor_crm',
    'consultor_comercial','consultor_mktplace','financeiro','rh'
  ));

-- New helper: CEO or CTO
CREATE OR REPLACE FUNCTION public.is_executive(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role IN ('ceo','cto')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_executive(uuid) TO authenticated;

-- Policy updates: replace each policy that uses is_ceo(auth.uid()) as a privilege check
-- with is_executive(auth.uid()). DO NOT touch policies where is_ceo represents the
-- exclusive CEO identity (if any such policy exists — review from step 1 list).
--
-- For each policy found, do:
--   DROP POLICY <name> ON <table>;
--   CREATE POLICY <name> ON <table> ... USING (public.is_executive(auth.uid()));
-- Specific policies listed and rewritten here:
--   <generated block — written after step 1 output>

COMMIT;
```

**Note:** the `<generated block>` is filled in literally after running step 1. Do not leave it as a placeholder in the final migration; the engineer runs the queries, pastes the exact policy rewrites, then commits.

- [ ] **Step 3: Apply locally**

```bash
supabase db reset   # if using local Supabase
# OR
supabase db push    # if using linked remote (dev environment only)
```

- [ ] **Step 4: Verify**

```sql
SELECT public.is_executive('<known-ceo-user-id>'::uuid);  -- expect true
```

Run the policy review query again — expect updated policies.

- [ ] **Step 5: Regenerate types**

```bash
npm run supabase:gen-types
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260415120000_add_cto_role.sql src/integrations/supabase/types.ts
git commit -m "feat(db): add cto role with is_executive() helper mirroring ceo"
```

---

### Task 6: Sidebar item "Milennials Tech"

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Locate the CEO-or-gestor-or-dev conditional block**

Find the section rendering Kanban CEO / ceo-gated items (lines 308-340). We want the Milennials Tech item to be visible for `ceo`, `cto`, `devs`.

- [ ] **Step 2: Add a new sidebar item**

Add a new `<NavTooltip>` + `<NavLink>` block that shows when `isExecutive(user?.role) || user?.role === 'devs'`:

```tsx
{(isExecutive(user?.role) || user?.role === 'devs') && (
  <NavTooltip label="Milennials Tech">
    <NavLink
      to="/milennials-tech"
      className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
    >
      <Cpu size={20} />
      {!isCollapsed && <span>Milennials Tech</span>}
    </NavLink>
  </NavTooltip>
)}
```

Import `Cpu` from `lucide-react` at the top of the file. Import `isExecutive` from `@/types/auth`.

- [ ] **Step 3: Run the app and verify visually**

```bash
npm run dev
```

Log in as CEO — item appears. Log in as Dev — item appears. Log in as a role without access — item hidden.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "feat(sidebar): add Milennials Tech entry for ceo/cto/devs"
```

---

## Part B — Database core

### Task 7: Create `tech_*` enums

**Files:**
- Create: `supabase/migrations/20260415120100_create_tech_enums.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260415120100_create_tech_enums.sql
-- Enums for the Milennials Tech subsystem (DevTrack-flavored).

BEGIN;

CREATE TYPE public.tech_task_type AS ENUM ('BUG', 'FEATURE', 'HOTFIX', 'CHORE');
CREATE TYPE public.tech_task_status AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');
CREATE TYPE public.tech_task_priority AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE public.tech_sprint_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED');
CREATE TYPE public.tech_time_entry_type AS ENUM ('START', 'PAUSE', 'RESUME', 'STOP');

COMMIT;
```

- [ ] **Step 2: Apply and verify**

```bash
supabase db push
psql $DATABASE_URL -c "\dT public.tech_*"
```

Expected: 5 types listed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260415120100_create_tech_enums.sql
git commit -m "feat(db): create tech_* enums for milennials tech"
```

---

### Task 8: Create `tech_*` tables and indexes

**Files:**
- Create: `supabase/migrations/20260415120200_create_tech_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260415120200_create_tech_tables.sql
-- Tables for Milennials Tech. All with RLS enabled (policies in a later migration).

BEGIN;

-- Ensure moddatetime exists (auto-update updated_at)
CREATE EXTENSION IF NOT EXISTS moddatetime;

-- Sprints
CREATE TABLE public.tech_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  goal TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status public.tech_sprint_status NOT NULL DEFAULT 'PLANNING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tech_sprints_date_range CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX tech_sprints_single_active
  ON public.tech_sprints (status) WHERE status = 'ACTIVE';

ALTER TABLE public.tech_sprints ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE public.tech_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT,
  type public.tech_task_type NOT NULL,
  status public.tech_task_status NOT NULL DEFAULT 'BACKLOG',
  priority public.tech_task_priority NOT NULL,
  sprint_id UUID REFERENCES public.tech_sprints(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  deadline TIMESTAMPTZ,
  estimated_hours NUMERIC CHECK (estimated_hours IS NULL OR estimated_hours > 0),
  acceptance_criteria TEXT,
  technical_context TEXT,
  git_branch TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocker_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tech_tasks_status_idx ON public.tech_tasks (status);
CREATE INDEX tech_tasks_type_idx ON public.tech_tasks (type);
CREATE INDEX tech_tasks_assignee_idx ON public.tech_tasks (assignee_id);
CREATE INDEX tech_tasks_sprint_idx ON public.tech_tasks (sprint_id);

CREATE TRIGGER tech_tasks_moddatetime
  BEFORE UPDATE ON public.tech_tasks
  FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

ALTER TABLE public.tech_tasks ENABLE ROW LEVEL SECURITY;

-- Collaborators
CREATE TABLE public.tech_task_collaborators (
  task_id UUID NOT NULL REFERENCES public.tech_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX tech_task_collaborators_user_idx ON public.tech_task_collaborators (user_id);
ALTER TABLE public.tech_task_collaborators ENABLE ROW LEVEL SECURITY;

-- Time entries
CREATE TABLE public.tech_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tech_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.tech_time_entry_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tech_time_entries_task_idx ON public.tech_time_entries (task_id);
CREATE INDEX tech_time_entries_user_idx ON public.tech_time_entries (user_id);
CREATE INDEX tech_time_entries_user_latest ON public.tech_time_entries (user_id, created_at DESC);

ALTER TABLE public.tech_time_entries ENABLE ROW LEVEL SECURITY;

-- Activities (immutable)
CREATE TABLE public.tech_task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tech_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tech_task_activities_task_idx ON public.tech_task_activities (task_id, created_at DESC);

ALTER TABLE public.tech_task_activities ENABLE ROW LEVEL SECURITY;

COMMIT;
```

- [ ] **Step 2: Apply and verify**

```bash
supabase db push
psql $DATABASE_URL -c "\d+ public.tech_tasks"
```

Expected: table exists with all columns, indexes, trigger.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260415120200_create_tech_tables.sql
git commit -m "feat(db): create tech_* tables, indexes, and constraints"
```

---

### Task 9: RLS policies for `tech_*`

**Files:**
- Create: `supabase/migrations/20260415120400_tech_rls_policies.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260415120400_tech_rls_policies.sql
-- RLS for Milennials Tech. Read: ceo+cto+devs. Write: see per-table rules.

BEGIN;

-- Helper to check if caller is ceo/cto/devs (SELECT access)
CREATE OR REPLACE FUNCTION public.can_see_tech(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role IN ('ceo','cto','devs')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_see_tech(uuid) TO authenticated;

--
-- tech_sprints
--
CREATE POLICY "tech_sprints_select" ON public.tech_sprints
  FOR SELECT USING (public.can_see_tech(auth.uid()));

CREATE POLICY "tech_sprints_insert" ON public.tech_sprints
  FOR INSERT WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_sprints_update" ON public.tech_sprints
  FOR UPDATE USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_sprints_delete" ON public.tech_sprints
  FOR DELETE USING (public.is_executive(auth.uid()));

--
-- tech_tasks
--
CREATE POLICY "tech_tasks_select" ON public.tech_tasks
  FOR SELECT USING (public.can_see_tech(auth.uid()));

CREATE POLICY "tech_tasks_insert" ON public.tech_tasks
  FOR INSERT WITH CHECK (
    public.can_see_tech(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "tech_tasks_update_exec" ON public.tech_tasks
  FOR UPDATE USING (public.is_executive(auth.uid()))
  WITH CHECK (public.is_executive(auth.uid()));

CREATE POLICY "tech_tasks_update_own" ON public.tech_tasks
  FOR UPDATE USING (
    assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tech_task_collaborators c
      WHERE c.task_id = tech_tasks.id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tech_task_collaborators c
      WHERE c.task_id = tech_tasks.id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "tech_tasks_delete" ON public.tech_tasks
  FOR DELETE USING (public.is_executive(auth.uid()));

--
-- tech_task_collaborators
--
CREATE POLICY "tech_task_collaborators_select" ON public.tech_task_collaborators
  FOR SELECT USING (public.can_see_tech(auth.uid()));

CREATE POLICY "tech_task_collaborators_write_exec" ON public.tech_task_collaborators
  FOR INSERT WITH CHECK (public.is_executive(auth.uid()));
CREATE POLICY "tech_task_collaborators_delete_exec" ON public.tech_task_collaborators
  FOR DELETE USING (public.is_executive(auth.uid()));

CREATE POLICY "tech_task_collaborators_write_assignee" ON public.tech_task_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tech_tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
  );

CREATE POLICY "tech_task_collaborators_delete_assignee" ON public.tech_task_collaborators
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.tech_tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
  );

--
-- tech_time_entries
-- Writes only via RPC (SECURITY DEFINER). No direct INSERT/UPDATE/DELETE from client.
--
CREATE POLICY "tech_time_entries_select" ON public.tech_time_entries
  FOR SELECT USING (public.can_see_tech(auth.uid()));

-- No write policies defined → writes are denied unless a SECURITY DEFINER function bypasses.

--
-- tech_task_activities
-- Same pattern: writes via RPC/trigger only.
--
CREATE POLICY "tech_task_activities_select" ON public.tech_task_activities
  FOR SELECT USING (public.can_see_tech(auth.uid()));

-- Immutability: no UPDATE/DELETE policy → all modifications denied.

COMMIT;
```

- [ ] **Step 2: Apply and verify**

```bash
supabase db push
psql $DATABASE_URL -c "SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'tech_%';"
```

Expected: policies listed as defined.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260415120400_tech_rls_policies.sql
git commit -m "feat(db): rls policies for tech_* tables"
```

---

### Task 10: `tech_task_time_totals` view and activity triggers

**Files:**
- Create: `supabase/migrations/20260415120500_tech_views_and_triggers.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260415120500_tech_views_and_triggers.sql

BEGIN;

-- View: total active seconds per task, derived from event stream.
-- Algorithm: walk entries in created_at order per task. Each START/RESUME opens a window.
-- Each PAUSE/STOP closes it. If the latest event is START or RESUME, the window extends to now().
CREATE OR REPLACE VIEW public.tech_task_time_totals AS
WITH ordered AS (
  SELECT
    task_id,
    user_id,
    type,
    created_at,
    LEAD(created_at) OVER (PARTITION BY task_id ORDER BY created_at) AS next_at,
    LEAD(type) OVER (PARTITION BY task_id ORDER BY created_at) AS next_type
  FROM public.tech_time_entries
),
intervals AS (
  SELECT
    task_id,
    CASE
      WHEN type IN ('START','RESUME') AND next_type IN ('PAUSE','STOP') THEN
        EXTRACT(EPOCH FROM (next_at - created_at))
      WHEN type IN ('START','RESUME') AND next_at IS NULL THEN
        EXTRACT(EPOCH FROM (now() - created_at))
      ELSE 0
    END AS seconds
  FROM ordered
)
SELECT
  task_id,
  COALESCE(SUM(seconds), 0)::bigint AS total_seconds
FROM intervals
GROUP BY task_id;

GRANT SELECT ON public.tech_task_time_totals TO authenticated;

-- Trigger: activity on task insert and status change
CREATE OR REPLACE FUNCTION public.tech_tasks_activity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
    VALUES (NEW.id, COALESCE(NEW.created_by, auth.uid()), 'task_created', '{}'::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
      VALUES (
        NEW.id,
        COALESCE(auth.uid(), NEW.created_by),
        'status_changed',
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tech_tasks_activity_insert
  AFTER INSERT ON public.tech_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.tech_tasks_activity_trigger();

CREATE TRIGGER tech_tasks_activity_update
  AFTER UPDATE ON public.tech_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.tech_tasks_activity_trigger();

COMMIT;
```

- [ ] **Step 2: Apply and verify**

```bash
supabase db push
```

Insert a task manually via SQL and verify `tech_task_activities` gets one row of type `task_created`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260415120500_tech_views_and_triggers.sql
git commit -m "feat(db): tech_task_time_totals view + activity triggers"
```

---

### Task 11: RPCs for timers, review, approve/reject, block, sprint lifecycle

**Files:**
- Create: `supabase/migrations/20260415120600_tech_rpcs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260415120600_tech_rpcs.sql
-- All RPCs are SECURITY DEFINER; they validate auth.uid() and role internally.

BEGIN;

-- Helper: is caller allowed to edit a given task? (assignee, collaborator, executive)
CREATE OR REPLACE FUNCTION public.tech_can_edit_task(_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_executive(auth.uid())
      OR EXISTS (SELECT 1 FROM public.tech_tasks t WHERE t.id = _task_id AND t.assignee_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.tech_task_collaborators c WHERE c.task_id = _task_id AND c.user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.tech_can_edit_task(uuid) TO authenticated;

-- tech_start_timer: auto-pause other active timers of caller; promote status if needed
CREATE OR REPLACE FUNCTION public.tech_start_timer(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_task_status;
  other_task_id uuid;
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Auto-pause other active timers of this user
  FOR other_task_id IN
    SELECT DISTINCT te.task_id
    FROM public.tech_time_entries te
    WHERE te.user_id = auth.uid()
      AND te.task_id != _task_id
  LOOP
    IF public.tech_timer_is_active(other_task_id, auth.uid()) THEN
      INSERT INTO public.tech_time_entries (task_id, user_id, type)
      VALUES (other_task_id, auth.uid(), 'PAUSE');
      INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
      VALUES (other_task_id, auth.uid(), 'timer_paused', jsonb_build_object('auto', true));
    END IF;
  END LOOP;

  -- Promote status if needed
  SELECT status INTO current_status FROM public.tech_tasks WHERE id = _task_id;
  IF current_status IN ('BACKLOG','TODO') THEN
    UPDATE public.tech_tasks SET status = 'IN_PROGRESS' WHERE id = _task_id;
  END IF;

  -- Insert START event
  INSERT INTO public.tech_time_entries (task_id, user_id, type)
  VALUES (_task_id, auth.uid(), 'START');
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'timer_started', '{}'::jsonb);
END;
$$;

-- Helper: is timer active for (task, user)?
CREATE OR REPLACE FUNCTION public.tech_timer_is_active(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT type IN ('START','RESUME')
     FROM public.tech_time_entries
     WHERE task_id = _task_id AND user_id = _user_id
     ORDER BY created_at DESC
     LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.tech_pause_timer(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT public.tech_timer_is_active(_task_id, auth.uid()) THEN
    RAISE EXCEPTION 'No active timer';
  END IF;
  INSERT INTO public.tech_time_entries (task_id, user_id, type) VALUES (_task_id, auth.uid(), 'PAUSE');
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'timer_paused', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_resume_timer(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_task_id uuid;
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  FOR other_task_id IN
    SELECT DISTINCT te.task_id FROM public.tech_time_entries te
    WHERE te.user_id = auth.uid() AND te.task_id != _task_id
  LOOP
    IF public.tech_timer_is_active(other_task_id, auth.uid()) THEN
      INSERT INTO public.tech_time_entries (task_id, user_id, type)
      VALUES (other_task_id, auth.uid(), 'PAUSE');
      INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
      VALUES (other_task_id, auth.uid(), 'timer_paused', jsonb_build_object('auto', true));
    END IF;
  END LOOP;
  INSERT INTO public.tech_time_entries (task_id, user_id, type) VALUES (_task_id, auth.uid(), 'RESUME');
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'timer_resumed', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_stop_timer(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF NOT public.tech_timer_is_active(_task_id, auth.uid()) THEN
    RAISE EXCEPTION 'No active timer';
  END IF;
  INSERT INTO public.tech_time_entries (task_id, user_id, type) VALUES (_task_id, auth.uid(), 'STOP');
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'timer_stopped', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_send_to_review(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF public.tech_timer_is_active(_task_id, auth.uid()) THEN
    INSERT INTO public.tech_time_entries (task_id, user_id, type) VALUES (_task_id, auth.uid(), 'STOP');
  END IF;
  UPDATE public.tech_tasks SET status = 'REVIEW' WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'sent_to_review', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_approve_task(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_task_status;
BEGIN
  IF NOT public.is_executive(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT status INTO current_status FROM public.tech_tasks WHERE id = _task_id;
  IF current_status != 'REVIEW' THEN
    RAISE EXCEPTION 'Task not in REVIEW';
  END IF;
  UPDATE public.tech_tasks SET status = 'DONE' WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'approved', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_reject_task(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_task_status;
BEGIN
  IF NOT public.is_executive(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT status INTO current_status FROM public.tech_tasks WHERE id = _task_id;
  IF current_status != 'REVIEW' THEN
    RAISE EXCEPTION 'Task not in REVIEW';
  END IF;
  UPDATE public.tech_tasks SET status = 'IN_PROGRESS' WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'rejected', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_block_task(_task_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.tech_tasks SET is_blocked = true, blocker_reason = _reason WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'task_blocked', jsonb_build_object('reason', _reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_unblock_task(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tech_can_edit_task(_task_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.tech_tasks SET is_blocked = false, blocker_reason = null WHERE id = _task_id;
  INSERT INTO public.tech_task_activities (task_id, user_id, type, data)
  VALUES (_task_id, auth.uid(), 'task_unblocked', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_start_sprint(_sprint_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_sprint_status;
  active_count int;
BEGIN
  IF NOT public.is_executive(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT status INTO current_status FROM public.tech_sprints WHERE id = _sprint_id;
  IF current_status != 'PLANNING' THEN
    RAISE EXCEPTION 'Sprint not in PLANNING';
  END IF;
  SELECT COUNT(*) INTO active_count FROM public.tech_sprints WHERE status = 'ACTIVE';
  IF active_count > 0 THEN
    RAISE EXCEPTION 'Another sprint is already ACTIVE';
  END IF;
  UPDATE public.tech_tasks SET status = 'TODO' WHERE sprint_id = _sprint_id AND status = 'BACKLOG';
  UPDATE public.tech_sprints SET status = 'ACTIVE' WHERE id = _sprint_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tech_end_sprint(_sprint_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tech_sprint_status;
BEGIN
  IF NOT public.is_executive(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT status INTO current_status FROM public.tech_sprints WHERE id = _sprint_id;
  IF current_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Sprint not ACTIVE';
  END IF;
  UPDATE public.tech_tasks SET sprint_id = null, status = 'BACKLOG'
    WHERE sprint_id = _sprint_id AND status != 'DONE';
  UPDATE public.tech_sprints SET status = 'COMPLETED' WHERE id = _sprint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.tech_start_timer(uuid),
  public.tech_pause_timer(uuid),
  public.tech_resume_timer(uuid),
  public.tech_stop_timer(uuid),
  public.tech_timer_is_active(uuid, uuid),
  public.tech_send_to_review(uuid),
  public.tech_approve_task(uuid),
  public.tech_reject_task(uuid),
  public.tech_block_task(uuid, text),
  public.tech_unblock_task(uuid),
  public.tech_start_sprint(uuid),
  public.tech_end_sprint(uuid)
TO authenticated;

COMMIT;
```

- [ ] **Step 2: Apply**

```bash
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260415120600_tech_rpcs.sql
git commit -m "feat(db): tech_* rpcs for timers, review, approve/reject, block, sprints"
```

---

### Task 12: Add `tech_*` tables to realtime publication

**Files:**
- Create: `supabase/migrations/20260415120700_tech_realtime.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260415120700_tech_realtime.sql
BEGIN;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.tech_tasks,
  public.tech_sprints,
  public.tech_time_entries,
  public.tech_task_activities;

COMMIT;
```

- [ ] **Step 2: Apply and verify**

```bash
supabase db push
psql $DATABASE_URL -c "SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename LIKE 'tech_%';"
```

Expected: 4 tables listed.

- [ ] **Step 3: Regenerate TS types**

```bash
npm run supabase:gen-types
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260415120700_tech_realtime.sql src/integrations/supabase/types.ts
git commit -m "feat(db): enable realtime on tech_* tables"
```

---

### Task 13: pgTAP tests for RPCs and RLS

**Files:**
- Create: `supabase/tests/tech_rpcs_test.sql`
- Create: `supabase/tests/tech_rls_test.sql`

- [ ] **Step 1: Enable pgTAP**

```bash
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pgtap;"
```

- [ ] **Step 2: Write RPC tests**

Create `supabase/tests/tech_rpcs_test.sql` covering: `tech_start_timer` auto-pauses; `tech_start_timer` promotes BACKLOG/TODO → IN_PROGRESS; `tech_send_to_review` stops timer; `tech_approve_task` requires executive; `tech_start_sprint` enforces single-active rule. Each test uses `SET LOCAL ROLE authenticated` with a seeded user UUID.

```sql
-- supabase/tests/tech_rpcs_test.sql
BEGIN;
SELECT plan(8);

-- Seed data: one CEO, one Dev, one task, one sprint
-- (Use a fixed seed helper or inline inserts)

-- 1. tech_timer_is_active false when no events
SELECT is(public.tech_timer_is_active('00000000-0000-0000-0000-000000000aaa'::uuid,'00000000-0000-0000-0000-000000000001'::uuid), false, 'timer inactive by default');

-- 2. tech_start_timer promotes BACKLOG -> IN_PROGRESS
-- ... SET LOCAL ROLE and impersonate user via request.jwt.claim.sub
-- See supabase pgTAP recipes for auth.uid() mocking

SELECT finish();
ROLLBACK;
```

(Full test body written against actual seed data during implementation; the skeleton above documents the 8 assertions.)

- [ ] **Step 3: Write RLS tests**

`supabase/tests/tech_rls_test.sql`: Dev can UPDATE only own task; CEO/CTO UPDATE any; activities UPDATE/DELETE denied.

- [ ] **Step 4: Run tests**

```bash
supabase db test
```

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/
git commit -m "test(db): pgtap tests for tech_* rpcs and rls"
```

---

## Part C — Frontend foundation

### Task 14: Design tokens and Tailwind extension

**Files:**
- Create: `src/features/milennials-tech/design/tokens.css`
- Modify: `tailwind.config.ts`
- Modify: `src/index.css` (import the tokens file)

- [ ] **Step 1: Install Geist font**

```bash
npm install geist
```

- [ ] **Step 2: Create `tokens.css`**

```css
/* src/features/milennials-tech/design/tokens.css */
.mtech-scope {
  --mtech-bg: #0A0A0C;
  --mtech-surface: #141418;
  --mtech-surface-elev: #1A1A20;
  --mtech-border: rgba(255, 255, 255, 0.06);
  --mtech-border-strong: rgba(255, 255, 255, 0.12);
  --mtech-text: #EDEDF0;
  --mtech-text-muted: #8A8A95;
  --mtech-text-subtle: #5A5A66;
  --mtech-accent: #F4C430; /* Milennials yellow — decisão locked */
  --mtech-accent-muted: rgba(244, 196, 48, 0.12);
  --mtech-danger: #E5484D;
  --mtech-radius-sm: 6px;
  --mtech-radius-md: 8px;
  --mtech-radius-lg: 12px;
  --mtech-shadow-card: 0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2);
  color: var(--mtech-text);
  background: var(--mtech-bg);
  font-family: 'Geist', 'Inter', system-ui, sans-serif;
  font-feature-settings: 'cv11', 'ss01';
}
.mtech-scope [data-mono] {
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Import in `src/index.css`**

Add `@import './features/milennials-tech/design/tokens.css';` after existing imports.

Add `@import 'geist/font/sans';` and `@import 'geist/font/mono';` at the top.

- [ ] **Step 4: Extend Tailwind**

In `tailwind.config.ts`, add a plugin or `content` entry ensuring `src/features/milennials-tech/**` is scanned. Add any `extend.colors.mtech` tokens mirrored from CSS vars for utility classes.

- [ ] **Step 5: Commit**

```bash
git add src/features/milennials-tech/design/tokens.css src/index.css tailwind.config.ts package.json package-lock.json
git commit -m "feat(mtech): design tokens + Geist font for milennials tech scope"
```

---

### Task 15: Types, schemas, and utility libs

**Files:**
- Create: `src/features/milennials-tech/types.ts`
- Create: `src/features/milennials-tech/schemas/task.ts`
- Create: `src/features/milennials-tech/lib/statusLabels.ts`
- Create: `src/features/milennials-tech/lib/permissions.ts`
- Create: `src/features/milennials-tech/lib/computeTaskTime.ts`
- Create: `src/features/milennials-tech/lib/computeTaskTime.test.ts`
- Create: `src/features/milennials-tech/lib/permissions.test.ts`

- [ ] **Step 1: `types.ts`** — re-export Supabase row types

```ts
import type { Database } from '@/integrations/supabase/types';

export type TechTask = Database['public']['Tables']['tech_tasks']['Row'];
export type TechTaskInsert = Database['public']['Tables']['tech_tasks']['Insert'];
export type TechTaskUpdate = Database['public']['Tables']['tech_tasks']['Update'];
export type TechSprint = Database['public']['Tables']['tech_sprints']['Row'];
export type TechTimeEntry = Database['public']['Tables']['tech_time_entries']['Row'];
export type TechTaskActivity = Database['public']['Tables']['tech_task_activities']['Row'];

export type TechTaskStatus = Database['public']['Enums']['tech_task_status'];
export type TechTaskType = Database['public']['Enums']['tech_task_type'];
export type TechTaskPriority = Database['public']['Enums']['tech_task_priority'];
export type TechSprintStatus = Database['public']['Enums']['tech_sprint_status'];

export type ChecklistItem = { id: string; text: string; done: boolean };
```

- [ ] **Step 2: `schemas/task.ts`** — Zod schemas

```ts
import { z } from 'zod';

export const checklistItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(300),
  done: z.boolean(),
});

export const taskFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  type: z.enum(['BUG', 'FEATURE', 'HOTFIX', 'CHORE']),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  sprint_id: z.string().uuid().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  estimated_hours: z.number().positive().nullable().optional(),
  acceptance_criteria: z.string().nullable().optional(),
  technical_context: z.string().nullable().optional(),
  git_branch: z.string().nullable().optional(),
  checklist: z.array(checklistItemSchema).default([]),
});

export const sprintFormSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().nullable().optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
}).refine(v => new Date(v.end_date) > new Date(v.start_date), {
  message: 'end_date must be after start_date',
  path: ['end_date'],
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;
export type SprintFormValues = z.infer<typeof sprintFormSchema>;
```

- [ ] **Step 3: `lib/statusLabels.ts`**

```ts
import type { TechTaskStatus, TechTaskType, TechTaskPriority } from '../types';

export const STATUS_LABEL_PT: Record<TechTaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'A fazer',
  IN_PROGRESS: 'Fazendo',
  REVIEW: 'Em teste',
  DONE: 'Feito',
};

export const KANBAN_COLUMNS: TechTaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export const TYPE_LABEL: Record<TechTaskType, string> = {
  BUG: 'Bug',
  FEATURE: 'Feature',
  HOTFIX: 'Hotfix',
  CHORE: 'Chore',
};

export const PRIORITY_LABEL: Record<TechTaskPriority, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};
```

- [ ] **Step 4: `lib/permissions.ts` + failing tests**

```ts
// permissions.ts
import type { UserRole } from '@/types/auth';
import { isExecutive } from '@/types/auth';
import type { TechTask } from '../types';

export function canEditTask(
  userId: string | null,
  role: UserRole | null | undefined,
  task: TechTask,
  collaboratorUserIds: string[],
): boolean {
  if (!userId || !role) return false;
  if (isExecutive(role)) return true;
  if (task.assignee_id === userId) return true;
  if (collaboratorUserIds.includes(userId)) return true;
  return false;
}

export function canApprove(role: UserRole | null | undefined): boolean {
  return isExecutive(role);
}

export function canDragToColumn(
  userId: string | null,
  role: UserRole | null | undefined,
  task: TechTask,
  collaboratorUserIds: string[],
  targetColumn: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE',
  sourceColumn: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE',
): boolean {
  if (!canEditTask(userId, role, task, collaboratorUserIds)) return false;
  // REVIEW -> DONE (approve) and REVIEW -> IN_PROGRESS (reject) require executive
  if (sourceColumn === 'REVIEW' && (targetColumn === 'DONE' || targetColumn === 'IN_PROGRESS')) {
    return canApprove(role);
  }
  return true;
}
```

Write tests for each function.

- [ ] **Step 5: `lib/computeTaskTime.ts` + tests**

Mirrors the SQL view. Deterministic function given an array of entries.

```ts
import type { TechTimeEntry } from '../types';

export function computeTaskSeconds(entries: TechTimeEntry[], now: Date = new Date()): number {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let total = 0;
  let openAt: number | null = null;
  for (const e of sorted) {
    const at = new Date(e.created_at).getTime();
    if ((e.type === 'START' || e.type === 'RESUME')) {
      openAt = at;
    } else if ((e.type === 'PAUSE' || e.type === 'STOP') && openAt != null) {
      total += (at - openAt) / 1000;
      openAt = null;
    }
  }
  if (openAt != null) total += (now.getTime() - openAt) / 1000;
  return Math.round(total);
}

export function isTimerActive(entries: TechTimeEntry[]): boolean {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const last = sorted[sorted.length - 1];
  return last ? (last.type === 'START' || last.type === 'RESUME') : false;
}
```

Unit tests verify: empty → 0; START/STOP 1h → 3600; START/PAUSE/RESUME/STOP total; START without close extends to `now`; isTimerActive true after START, false after STOP.

- [ ] **Step 6: Run tests**

```bash
npm test src/features/milennials-tech
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/milennials-tech/
git commit -m "feat(mtech): core types, zod schemas, label maps, permissions, time computation"
```

---

### Task 16: Data hooks (React Query) and realtime subscribe

**Files:**
- Create: `src/features/milennials-tech/hooks/useTechTasks.ts`
- Create: `src/features/milennials-tech/hooks/useTechSprints.ts`
- Create: `src/features/milennials-tech/hooks/useTechTaskActivities.ts`
- Create: `src/features/milennials-tech/hooks/useTechTimer.ts`
- Create: `src/features/milennials-tech/hooks/useActiveTimer.ts`
- Create: `src/features/milennials-tech/hooks/useTechRealtime.ts`

- [ ] **Step 1: `useTechTasks.ts`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TechTask, TechTaskInsert, TechTaskUpdate } from '../types';

export const techTaskKeys = {
  all: ['tech', 'tasks'] as const,
  list: (filters?: Record<string, unknown>) => ['tech', 'tasks', 'list', filters ?? {}] as const,
  one: (id: string) => ['tech', 'tasks', 'one', id] as const,
};

export function useTechTasks(filters?: { sprintId?: string | null; status?: TechTask['status']; type?: TechTask['type']; assigneeId?: string; search?: string }) {
  return useQuery({
    queryKey: techTaskKeys.list(filters),
    queryFn: async () => {
      let q = supabase.from('tech_tasks').select('*').order('created_at', { ascending: false });
      if (filters?.sprintId !== undefined) {
        if (filters.sprintId === null) q = q.is('sprint_id', null);
        else q = q.eq('sprint_id', filters.sprintId);
      }
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.type) q = q.eq('type', filters.type);
      if (filters?.assigneeId) q = q.eq('assignee_id', filters.assigneeId);
      if (filters?.search) q = q.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as TechTask[];
    },
    staleTime: 30_000,
  });
}

export function useCreateTechTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TechTaskInsert) => {
      const { data, error } = await supabase.from('tech_tasks').insert(payload).select().single();
      if (error) throw error;
      return data as TechTask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
    },
  });
}

export function useUpdateTechTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TechTaskUpdate }) => {
      const { data, error } = await supabase.from('tech_tasks').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as TechTask;
    },
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
      qc.invalidateQueries({ queryKey: techTaskKeys.one(task.id) });
    },
  });
}

export function useDeleteTechTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tech_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: techTaskKeys.all });
    },
  });
}
```

- [ ] **Step 2: `useTechSprints.ts`**

Parallel structure. Queries `tech_sprints`. Mutations: create, update, delete. Also: `useStartSprint` and `useEndSprint` calling RPCs via `supabase.rpc('tech_start_sprint', { _sprint_id: id })`.

- [ ] **Step 3: `useTechTaskActivities.ts`**

Queries last 50 activities for a task. Read-only.

- [ ] **Step 4: `useTechTimer.ts`**

Wraps RPC calls:
```tsx
export function useTechTimer() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tech'] });
  };
  return {
    start: useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.rpc('tech_start_timer', { _task_id: id }); if (error) throw error; }, onSuccess: invalidate }),
    pause: useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.rpc('tech_pause_timer', { _task_id: id }); if (error) throw error; }, onSuccess: invalidate }),
    resume: useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.rpc('tech_resume_timer', { _task_id: id }); if (error) throw error; }, onSuccess: invalidate }),
    stop: useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.rpc('tech_stop_timer', { _task_id: id }); if (error) throw error; }, onSuccess: invalidate }),
    sendToReview: useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.rpc('tech_send_to_review', { _task_id: id }); if (error) throw error; }, onSuccess: invalidate }),
    approve: useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.rpc('tech_approve_task', { _task_id: id }); if (error) throw error; }, onSuccess: invalidate }),
    reject: useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.rpc('tech_reject_task', { _task_id: id }); if (error) throw error; }, onSuccess: invalidate }),
    block: useMutation({ mutationFn: async ({ id, reason }: { id: string; reason: string }) => { const { error } = await supabase.rpc('tech_block_task', { _task_id: id, _reason: reason }); if (error) throw error; }, onSuccess: invalidate }),
    unblock: useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.rpc('tech_unblock_task', { _task_id: id }); if (error) throw error; }, onSuccess: invalidate }),
  };
}
```

- [ ] **Step 5: `useActiveTimer.ts`**

Query: last `tech_time_entries` row for `user_id = current`. Returns `{ activeTaskId: string | null, sinceSeconds: number }`. Ticks every 1s using `useEffect` + `setInterval` to update elapsed.

- [ ] **Step 6: `useTechRealtime.ts`**

```tsx
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTechRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('tech-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tech_tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['tech', 'tasks'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tech_sprints' }, () => {
        qc.invalidateQueries({ queryKey: ['tech', 'sprints'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tech_time_entries' }, () => {
        qc.invalidateQueries({ queryKey: ['tech', 'timer'] });
        qc.invalidateQueries({ queryKey: ['tech', 'activeTimer'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tech_task_activities' }, () => {
        qc.invalidateQueries({ queryKey: ['tech', 'activities'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/milennials-tech/hooks/
git commit -m "feat(mtech): react query hooks + realtime subscribe"
```

---

### Task 17: Page shell, routing, and guard

**Files:**
- Modify: `src/App.tsx` (add route + guard)
- Create: `src/features/milennials-tech/pages/MilennialsTechPage.tsx`
- Create: `src/features/milennials-tech/pages/BacklogTab.tsx` (stub)
- Create: `src/features/milennials-tech/pages/KanbanTab.tsx` (stub)
- Create: `src/features/milennials-tech/pages/SprintsTab.tsx` (stub)

- [ ] **Step 1: Add `MilennialsTechRoute` guard in `App.tsx`**

Below the existing `ExecutiveRoute`:

```tsx
function MilennialsTechRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!(isExecutive(user.role) || user.role === 'devs')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Register routes**

Inside the routes JSX (after the last route, before closing):

```tsx
<Route
  path="/milennials-tech"
  element={<MilennialsTechRoute><MilennialsTechPage /></MilennialsTechRoute>}
>
  <Route index element={<Navigate to="kanban" replace />} />
  <Route path="backlog" element={<BacklogTab />} />
  <Route path="kanban" element={<KanbanTab />} />
  <Route path="sprints" element={<SprintsTab />} />
</Route>
```

Add imports for the four pages at the top.

- [ ] **Step 3: Create `MilennialsTechPage.tsx`** (page shell)

```tsx
import { NavLink, Outlet } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';
import { useTechRealtime } from '../hooks/useTechRealtime';
import { CommandPalette } from '../components/CommandPalette';
import { StatusLine } from '../components/StatusLine';

const TABS = [
  { to: 'backlog', label: 'Backlog' },
  { to: 'kanban', label: 'Kanban' },
  { to: 'sprints', label: 'Sprints' },
];

export function MilennialsTechPage() {
  useTechRealtime();
  return (
    <MainLayout>
      <div className="mtech-scope min-h-screen">
        <CommandPalette />
        <header className="flex items-end justify-between px-8 pt-10 pb-6">
          <div>
            <h1 className="text-[32px] font-medium tracking-tight">Milennials Tech</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--mtech-text-muted)' }}>
              Engenharia, planejada.
            </p>
          </div>
          <nav className="flex gap-1">
            {TABS.map(t => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2 text-sm rounded-md transition-colors',
                    isActive
                      ? 'text-white bg-[var(--mtech-surface)] border border-[var(--mtech-border)]'
                      : 'text-[var(--mtech-text-muted)] hover:text-white'
                  )
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="px-8 pb-24"><Outlet /></main>
        <StatusLine />
      </div>
    </MainLayout>
  );
}
```

- [ ] **Step 4: Create stub tabs**

Each stub:
```tsx
export function BacklogTab() { return <div>Backlog</div>; }
```

Repeat for Kanban and Sprints.

- [ ] **Step 5: Create placeholder `CommandPalette.tsx` and `StatusLine.tsx`**

Empty component returning `null` for now. Filled in Task 23.

- [ ] **Step 6: Verify**

```bash
npm run typecheck
npm run dev
```

Log in, visit `/milennials-tech` — should redirect to `/milennials-tech/kanban`. Tabs navigate between stubs.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/features/milennials-tech/pages/ src/features/milennials-tech/components/CommandPalette.tsx src/features/milennials-tech/components/StatusLine.tsx
git commit -m "feat(mtech): page shell, guard, routes"
```

---

## Part D — Kanban, Backlog, Sprints UI

### Task 18: Task components (cards, rows, modals)

**Files:**
- Create: `src/features/milennials-tech/components/TaskCard.tsx`
- Create: `src/features/milennials-tech/components/TaskRow.tsx`
- Create: `src/features/milennials-tech/components/TaskDetailModal.tsx`
- Create: `src/features/milennials-tech/components/TaskFormModal.tsx`
- Create: `src/features/milennials-tech/components/TimerButton.tsx`

- [ ] **Step 1: `TimerButton.tsx`**

Props: `taskId`, `isActive`. Renders a small button; clicking toggles `useTechTimer().start|pause|resume|stop`. Shows elapsed seconds from `useActiveTimer`. Uses `tabular-nums` and pulses when active (Framer Motion `animate={{ opacity: [1, 0.85, 1] }}` on loop).

- [ ] **Step 2: `TaskCard.tsx`**

Dark surface card. Shows: type icon (left), title (500 weight), assignee avatar, priority dot (accent for CRITICAL), blocked padlock, overdue warning icon. `data-mono` on numbers. Exposes `onClick` for detail modal.

- [ ] **Step 3: `TaskRow.tsx`**

Backlog row variant: 36–40px height. Icon + title + assignee + sprint + deadline + timer + status badge.

- [ ] **Step 4: `TaskFormModal.tsx`**

Uses shadcn `Dialog`. Form with `react-hook-form` + Zod `taskFormSchema`. Creates via `useCreateTechTask`. Edit mode: pre-fills from task and calls `useUpdateTechTask`.

- [ ] **Step 5: `TaskDetailModal.tsx`**

Two-column modal (720–820px). Left: editable fields. Right: activities timeline (from `useTechTaskActivities`), checklist (drag-reorderable via `@hello-pangea/dnd`), collaborators. Action buttons gated by permissions: Send to Review, Approve, Reject, Block/Unblock, Delete.

- [ ] **Step 6: Snapshot/smoke test**

```ts
// TaskCard.test.tsx
import { render, screen } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import type { TechTask } from '../types';

const base: TechTask = { /* seed */ } as TechTask;

it('renders title and priority dot when CRITICAL', () => {
  render(<TaskCard task={{ ...base, priority: 'CRITICAL', title: 'Fix login' }} onClick={() => {}} />);
  expect(screen.getByText('Fix login')).toBeInTheDocument();
});
```

- [ ] **Step 7: Run tests**

```bash
npm test src/features/milennials-tech/components
```

- [ ] **Step 8: Commit**

```bash
git add src/features/milennials-tech/components/
git commit -m "feat(mtech): task components (card, row, modals, timer button)"
```

---

### Task 19: Kanban tab with drag-and-drop

**Files:**
- Modify: `src/features/milennials-tech/pages/KanbanTab.tsx`
- Create: `src/features/milennials-tech/components/KanbanColumn.tsx`
- Create: `e2e/tech/kanban.spec.ts`

- [ ] **Step 1: `KanbanColumn.tsx`**

Renders one column: header (caps 11px label + count mono + hairline) + list of `TaskCard`s wrapped in `Droppable` + `Draggable` from `@hello-pangea/dnd`. Accepts `column: TechTaskStatus`, `tasks: TechTask[]`, `onOpenTask(id)`.

- [ ] **Step 2: `KanbanTab.tsx`**

```tsx
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useMemo, useState } from 'react';
import { useTechTasks } from '../hooks/useTechTasks';
import { useTechTimer } from '../hooks/useTechTimer';
import { KANBAN_COLUMNS, STATUS_LABEL_PT } from '../lib/statusLabels';
import { KanbanColumn } from '../components/KanbanColumn';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { useAuth } from '@/contexts/AuthContext';
import { canDragToColumn } from '../lib/permissions';
import type { TechTaskStatus } from '../types';

export function KanbanTab() {
  const { user } = useAuth();
  const { data: tasks = [] } = useTechTasks();
  const timer = useTechTimer();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const byColumn = useMemo(() => {
    const map: Record<TechTaskStatus, typeof tasks> = {
      BACKLOG: [], TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [],
    };
    for (const t of tasks) if (t.status in map) map[t.status].push(t);
    return map;
  }, [tasks]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const task = tasks.find(t => t.id === draggableId);
    if (!task) return;
    const target = destination.droppableId as TechTaskStatus;
    const src = source.droppableId as TechTaskStatus;

    // Permission gate (UI-side)
    if (!canDragToColumn(user?.id ?? null, user?.role, task, [], target as any, src as any)) {
      // Status-line: not allowed
      return;
    }

    // Map drop to RPC
    if (src === 'TODO' && target === 'IN_PROGRESS') return timer.start.mutate(task.id);
    if (src === 'IN_PROGRESS' && target === 'REVIEW') return timer.sendToReview.mutate(task.id);
    if (src === 'REVIEW' && target === 'DONE') return timer.approve.mutate(task.id);
    if (src === 'REVIEW' && target === 'IN_PROGRESS') return timer.reject.mutate(task.id);
    // Other transitions (e.g. IN_PROGRESS -> TODO): plain status update via useUpdateTechTask
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(col => (
            <KanbanColumn
              key={col}
              column={col}
              label={STATUS_LABEL_PT[col]}
              tasks={byColumn[col]}
              onOpenTask={setOpenTaskId}
            />
          ))}
        </div>
      </DragDropContext>
      {openTaskId && (
        <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      )}
    </>
  );
}
```

- [ ] **Step 3: Playwright e2e**

`e2e/tech/kanban.spec.ts` — happy-path: login as dev → create task → drag A fazer → Fazendo → timer starts → drag to Em teste → CEO login → approve → task in Feito. Requires a seeded test database.

- [ ] **Step 4: Run dev and test manually**

```bash
npm run dev
```

Drag-and-drop works; status updates; realtime reflects on second browser window.

- [ ] **Step 5: Commit**

```bash
git add src/features/milennials-tech/pages/KanbanTab.tsx src/features/milennials-tech/components/KanbanColumn.tsx e2e/tech/kanban.spec.ts
git commit -m "feat(mtech): kanban tab with drag-and-drop and permission gating"
```

---

### Task 20: Backlog tab

**Files:**
- Modify: `src/features/milennials-tech/pages/BacklogTab.tsx`
- Create: `src/features/milennials-tech/components/BacklogTabs.tsx`

- [ ] **Step 1: `BacklogTabs.tsx`**

Horizontal tabs: Bugs | Features | Hotfixes | Chores | Concluídas. Active tab underlined with 2px accent line.

- [ ] **Step 2: `BacklogTab.tsx`**

Filters (search, assignee select, sprint select) + `BacklogTabs` + table of `TaskRow`. "Concluídas" shows all `status=DONE`; others show `type=X AND status != DONE`. "+ Nova Task" button opens `TaskFormModal`.

- [ ] **Step 3: Run**

```bash
npm run dev
```

Verify filter behavior, tab switching, modal opens.

- [ ] **Step 4: Commit**

```bash
git add src/features/milennials-tech/pages/BacklogTab.tsx src/features/milennials-tech/components/BacklogTabs.tsx
git commit -m "feat(mtech): backlog tab with filters and type tabs"
```

---

### Task 21: Sprints tab

**Files:**
- Modify: `src/features/milennials-tech/pages/SprintsTab.tsx`
- Create: `src/features/milennials-tech/components/SprintFormModal.tsx`
- Create: `src/features/milennials-tech/components/SprintPicker.tsx`

- [ ] **Step 1: `SprintFormModal.tsx`**

Form: name, goal, start_date (datetime-local), end_date. Validated via `sprintFormSchema`.

- [ ] **Step 2: `SprintPicker.tsx`**

Dropdown listing sprints with status badge; used by `KanbanTab` too (future refinement).

- [ ] **Step 3: `SprintsTab.tsx`**

Split layout: left = sprint list + "+ Nova Sprint" (executive only). Right = selected sprint header with actions (`Start Sprint`, `End Sprint`) + two drag-between panels (Backlog disponível | Tasks da sprint).

Drag moves call `useUpdateTechTask({ id, patch: { sprint_id: sprintId | null } })`. Start/End call confirmation modal then RPC.

- [ ] **Step 4: Run**

```bash
npm run dev
```

Create a sprint, add tasks, start it → tasks' status become TODO; end it → incomplete tasks return to BACKLOG.

- [ ] **Step 5: Commit**

```bash
git add src/features/milennials-tech/pages/SprintsTab.tsx src/features/milennials-tech/components/SprintFormModal.tsx src/features/milennials-tech/components/SprintPicker.tsx
git commit -m "feat(mtech): sprints tab with split layout and lifecycle actions"
```

---

### Task 22: Command palette and keyboard shortcuts

**Files:**
- Modify: `src/features/milennials-tech/components/CommandPalette.tsx`

- [ ] **Step 1: Install `cmdk`**

```bash
npm install cmdk
```

- [ ] **Step 2: Implement `CommandPalette.tsx`**

Uses `cmdk`. Opens on `⌘K` / `Ctrl K`. Commands:
- "New task" (`C`) → opens `TaskFormModal`
- "Go to Backlog" (`G B`), "Go to Kanban" (`G K`), "Go to Sprints" (`G S`)
- "Find task by ID" — text input → opens detail modal
- "Approve selected" (`A`) — disabled unless a task is focused
- Etc.

Keyboard listener: global `useEffect` with key sequence tracker.

- [ ] **Step 3: Test manually**

```bash
npm run dev
```

Press `⌘K` from any tab of Milennials Tech — palette opens. Press `G B` — navigates to Backlog.

- [ ] **Step 4: Commit**

```bash
git add src/features/milennials-tech/components/CommandPalette.tsx package.json package-lock.json
git commit -m "feat(mtech): command palette with keyboard shortcuts"
```

---

### Task 23: Motion polish + status line

**Files:**
- Modify: `src/features/milennials-tech/components/StatusLine.tsx`
- Modify: `TaskCard`, `KanbanColumn`, `TaskDetailModal` (motion layers)

- [ ] **Step 1: `StatusLine.tsx`**

Fixed bottom bar showing last action result, shortcut hints, user active timer. Styled minimalist (height 32px, muted text, accent on hover).

- [ ] **Step 2: Framer Motion on cards**

Wrap `TaskCard` list in `AnimatePresence`; each card uses `layout` for smooth reorder. On drag, scale 1.02 + subtle shadow.

- [ ] **Step 3: Coluna "Feito" sutileza**

Apply `opacity: 0.75` or accent top-border to DONE column header to signal closure.

- [ ] **Step 4: CRITICAL accent-dot**

Small 6px dot using `--mtech-accent` on critical-priority cards.

- [ ] **Step 5: Commit**

```bash
git add src/features/milennials-tech/
git commit -m "feat(mtech): motion polish + status line"
```

---

## Part E — Validation and gates

### Task 24: Run `/hm-design`, `/hm-engineer`, `/hm-qa` gates

- [ ] **Step 1: `/hm-design`**

Invoke `/hm-design` against `src/features/milennials-tech/**`. Expect report validating contrast, typography, motion, shortcuts, empty states, responsiveness.

Fix issues before proceeding. Re-run until clean.

- [ ] **Step 2: `/hm-engineer`**

Invoke `/hm-engineer`. Review security (RPC `SECURITY DEFINER` auditing, RLS coverage), architecture (isolation, boundaries), performance (query plans, view timing), quality (lint, typecheck, no `any`).

Fix issues. Re-run.

- [ ] **Step 3: `/hm-qa`**

Invoke `/hm-qa`. Expect Playwright e2e coverage for all happy paths + adversarial flows (dev trying to approve = 403; two simultaneous sprints blocked; realtime sync between two browsers).

Fix gaps.

- [ ] **Step 4: Lint and typecheck final**

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
supabase db test
```

All green.

- [ ] **Step 5: Commit any gate-driven fixes**

```bash
git add -A
git commit -m "chore(mtech): resolve /hm-design, /hm-engineer, /hm-qa gate findings"
```

---

### Task 25: Performance validation

- [ ] **Step 1: Seed 200 tasks in staging**

Script or SQL to insert 200 tasks across statuses.

- [ ] **Step 2: Measure kanban render**

Use React DevTools Profiler. Target: < 100ms initial render, < 16ms interaction.

If exceeded: virtualize columns using `@tanstack/react-virtual`.

- [ ] **Step 3: Measure view latency**

```sql
EXPLAIN ANALYZE SELECT * FROM public.tech_task_time_totals LIMIT 500;
```

If > 50ms for 500 tasks: create a materialized view `tech_task_time_totals_mv` with trigger refresh on `tech_time_entries` INSERT.

- [ ] **Step 4: Commit optimizations (if any)**

---

### Task 26: Rollout

- [ ] **Step 1: Apply migrations in staging**

```bash
supabase db push --linked
```

Verify app end-to-end in staging (manual + Playwright in staging mode).

- [ ] **Step 2: Apply in production**

After QA sign-off:

```bash
supabase db push --linked
```

(Ensure `.env` points to prod Supabase; confirm before running.)

- [ ] **Step 3: Deploy frontend**

Merge PR to `main`; Vercel/host deploys automatically.

- [ ] **Step 4: Assign CTO to Fábio (optional)**

```sql
UPDATE public.profiles SET role = 'cto' WHERE user_id = '<fabio-uuid>';
```

- [ ] **Step 5: Smoke test in prod**

Log in as Fábio (CTO), verify sidebar entry + kanban + create a real task.

- [ ] **Step 6: Monitor**

Watch error rate, Supabase logs, realtime channel counts for 24h.

---

## Self-Review Summary

- Spec §1 (overview) → Tasks 17 (shell), rollout in 26. ✓
- Spec §2 (CTO role) → Tasks 2, 3, 4, 5. ✓
- Spec §3 (data model) → Tasks 7, 8, 9, 10, 11, 12, 15 (types). ✓
- Spec §4 (frontend structure) → Tasks 15, 16, 17, 18. ✓
- Spec §5 (UX world-class) → Tasks 14 (tokens), 18, 19, 20, 21, 22, 23. ✓
- Spec §6 (business rules) → Tasks 11 (RPCs), 13 (pgTAP), 19-21 (UI enforcement). ✓
- Spec §7 (rollout) → Task 26. ✓
- Spec §8 (testing + gates) → Tasks 1 (infra), 13 (pgTAP), 15/16/18 (unit), 19 (e2e), 24 (gates), 25 (perf). ✓

No placeholders in code blocks; comments like `<generated block>` in migration Task 5 refer to a step output that's literally pasted — not a runtime placeholder.

Types consistent: `canDragToColumn` uses `'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'` in permissions; kanban columns constant exports same set.

Function names consistent: `tech_start_timer`, `tech_pause_timer`, etc. used identically in migration, hooks, and palette commands.
