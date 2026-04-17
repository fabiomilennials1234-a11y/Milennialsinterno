# mtech Per-User Access Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to grant or revoke Milennials Tech access per user via a boolean flag on `profiles`, additive to the existing role-based gate.

**Architecture:** One DB migration adds `profiles.can_access_mtech`, extends `can_see_tech()` with an `OR` clause, and installs a `BEFORE UPDATE` trigger that rejects flag changes by non-admin callers. Edge functions `create-user`/`update-user` accept the new field. Frontend reads it from `AuthContext`, uses it in the route guard and sidebar gate, exposes a switch in both modals, and adds a quick toggle column to the users list with an optimistic handler.

**Tech Stack:** Supabase Postgres (plpgsql trigger), pgTAP, Deno edge functions, React + TypeScript, TanStack Query, shadcn/ui `Switch`.

Spec: `docs/superpowers/specs/2026-04-17-mtech-user-access-toggle-design.md`

---

## Task 1: DB — column + gate + guard trigger + pgTAP test

**Files:**
- Create: `supabase/migrations/20260417140000_profiles_mtech_access.sql`
- Create: `supabase/tests/profiles_mtech_access_guard_test.sql`

- [ ] **Step 1: Write the pgTAP test**

Create `supabase/tests/profiles_mtech_access_guard_test.sql`:

```sql
-- supabase/tests/profiles_mtech_access_guard_test.sql
-- Guards the additive mtech access flag: ensures non-admin callers cannot
-- change profiles.can_access_mtech, while admin roles can, and other columns
-- remain freely updatable by their normal writers.

BEGIN;

SELECT plan(4);

-- ============================================================
-- Seed: 4 users — ceo, design (non-admin), gestor_projetos, rh
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'ceo-access@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeeeeeee-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'design-access@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeeeeeee-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'gp-access@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeeeeeee-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rh-access@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'CEO Access', 'ceo-access@test.local'),
  ('eeeeeeee-0000-0000-0000-000000000002'::uuid, 'Design Access', 'design-access@test.local'),
  ('eeeeeeee-0000-0000-0000-000000000003'::uuid, 'GP Access', 'gp-access@test.local'),
  ('eeeeeeee-0000-0000-0000-000000000004'::uuid, 'RH Access', 'rh-access@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'ceo'),
  ('eeeeeeee-0000-0000-0000-000000000002'::uuid, 'design'),
  ('eeeeeeee-0000-0000-0000-000000000003'::uuid, 'gestor_projetos'),
  ('eeeeeeee-0000-0000-0000-000000000004'::uuid, 'rh')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- Test 1: admin (gestor_projetos) can toggle the flag
-- ============================================================
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-000000000003', true);

SELECT lives_ok(
  $$ UPDATE public.profiles
     SET can_access_mtech = true
     WHERE user_id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid $$,
  'gestor_projetos can grant mtech access'
);

-- ============================================================
-- Test 2: non-admin (rh) cannot toggle the flag
-- ============================================================
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-000000000004', true);

SELECT throws_ok(
  $$ UPDATE public.profiles
     SET can_access_mtech = false
     WHERE user_id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid $$,
  '42501',
  'Only admin roles may change can_access_mtech',
  'rh role blocked from toggling can_access_mtech'
);

-- ============================================================
-- Test 3: can_see_tech returns true for user with flag set (no tech role)
-- ============================================================
RESET ROLE;
SELECT ok(
  public.can_see_tech('eeeeeeee-0000-0000-0000-000000000002'::uuid),
  'can_see_tech returns true for design user with can_access_mtech=true'
);

-- ============================================================
-- Test 4: can_see_tech returns false for user without role and without flag
-- ============================================================
SELECT ok(
  NOT public.can_see_tech('eeeeeeee-0000-0000-0000-000000000004'::uuid),
  'can_see_tech returns false for rh user with can_access_mtech=false'
);

SELECT * FROM finish();

ROLLBACK;
```

- [ ] **Step 2: Create the migration**

Path: `supabase/migrations/20260417140000_profiles_mtech_access.sql`

```sql
-- 20260417140000_profiles_mtech_access.sql
-- Additive per-user mtech access flag + guard trigger.
--
-- Keeps the existing role gate (ceo/cto/devs) intact and layers an OR on top,
-- so any user whose profiles.can_access_mtech is TRUE can also see the module,
-- regardless of cargo. The BEFORE UPDATE trigger ensures only admin roles
-- (ceo/cto/gestor_projetos/sucesso_cliente) can change the flag — RLS cannot
-- enforce column-level invariants on UPDATE.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_access_mtech BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_see_tech(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('ceo','cto','devs')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = _user_id AND can_access_mtech IS TRUE
    )
$$;

CREATE OR REPLACE FUNCTION public.profiles_guard_mtech_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.can_access_mtech IS DISTINCT FROM OLD.can_access_mtech THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('ceo','cto','gestor_projetos','sucesso_cliente')
    ) THEN
      RAISE EXCEPTION 'Only admin roles may change can_access_mtech'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_mtech_access ON public.profiles;

CREATE TRIGGER trg_profiles_guard_mtech_access
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_mtech_access();
```

- [ ] **Step 3: Apply the migration**

```bash
cd /Volumes/Untitled/refine-dash-main
set -a; source .env.scripts; set +a
supabase db push --linked
```

Expected: CLI lists only `20260417140000_profiles_mtech_access.sql` as pending; applies successfully.

- [ ] **Step 4: Validate against the remote DB via Node + service role**

Create `/Volumes/Untitled/refine-dash-main/.tmp-access-validate.mjs`:

```javascript
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const loadEnv = (p) => { for (const r of readFileSync(p, 'utf8').split('\n')) { const l = r.replace(/\r$/, '').trim(); if (!l || l.startsWith('#')) continue; const eq = l.indexOf('='); if (eq <= 0) continue; let v = l.slice(eq+1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[l.slice(0, eq).trim()] = v } }
loadEnv('/Volumes/Untitled/refine-dash-main/.env'); loadEnv('/Volumes/Untitled/refine-dash-main/.env.scripts')

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }})

// Create one admin (ceo) test user + one non-admin (design) test user
const mkUser = async (role) => {
  const email = `mtech-flag-${role}-${Date.now()}@test.local`
  const password = 'Temp-' + Math.random().toString(36).slice(2) + 'Aa1!'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  await admin.from('profiles').upsert({ user_id: data.user.id, name: role, email }, { onConflict: 'user_id' })
  await admin.from('user_roles').delete().eq('user_id', data.user.id)
  await admin.from('user_roles').insert({ user_id: data.user.id, role })
  return { id: data.user.id, email, password }
}
const adminUser = await mkUser('gestor_projetos')
const nonAdminUser = await mkUser('rh')
const targetUser = await mkUser('design')

const signIn = async (email, password) => {
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false }})
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

let pass = true
try {
  // Test A: admin grants flag
  const adminClient = await signIn(adminUser.email, adminUser.password)
  const t1 = await adminClient.from('profiles').update({ can_access_mtech: true }).eq('user_id', targetUser.id)
  if (t1.error) { console.error('FAIL A — admin update errored:', t1.error); pass = false }
  else console.log('OK A — gestor_projetos granted access')

  // Test B: non-admin blocked
  const nonAdminClient = await signIn(nonAdminUser.email, nonAdminUser.password)
  const t2 = await nonAdminClient.from('profiles').update({ can_access_mtech: false }).eq('user_id', targetUser.id)
  if (!t2.error || t2.error.code !== '42501') { console.error('FAIL B — non-admin got through:', t2.error); pass = false }
  else console.log('OK B — rh blocked with 42501')

  // Test C: can_see_tech returns true for target (design with flag=true)
  const { data: seen, error: seeErr } = await admin.rpc('can_see_tech', { _user_id: targetUser.id })
  if (seeErr) { console.error('FAIL C — rpc errored:', seeErr); pass = false }
  else if (seen !== true) { console.error('FAIL C — expected true, got', seen); pass = false }
  else console.log('OK C — can_see_tech returns true for flagged design user')
} finally {
  // cleanup
  await admin.auth.admin.deleteUser(adminUser.id)
  await admin.auth.admin.deleteUser(nonAdminUser.id)
  await admin.auth.admin.deleteUser(targetUser.id)
}
if (!pass) process.exit(1)
```

Run:

```bash
cd /Volumes/Untitled/refine-dash-main
node .tmp-access-validate.mjs
rm .tmp-access-validate.mjs
```

Expected: three `OK` lines. If any FAIL, STOP and report BLOCKED.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260417140000_profiles_mtech_access.sql \
        supabase/tests/profiles_mtech_access_guard_test.sql
git commit -m "feat(mtech): per-user access flag with admin-only guard"
```

---

## Task 2: Edge functions — accept `can_access_mtech`

**Files:**
- Modify: `supabase/functions/create-user/index.ts`
- Modify: `supabase/functions/update-user/index.ts`

- [ ] **Step 1: Update create-user to accept the flag**

In `supabase/functions/create-user/index.ts`, change the `CreateUserRequest` interface (lines 4–15) to add the new optional field:

```typescript
interface CreateUserRequest {
  email: string
  password: string
  name: string
  role: string
  avatar?: string
  group_id?: string
  squad_id?: string
  category_id?: string
  is_coringa?: boolean
  additional_pages?: string[]
  can_access_mtech?: boolean
}
```

Then update the destructure on line 68 to pull the new field:

```typescript
const { email, password, name, role, avatar, group_id, squad_id, category_id, is_coringa, additional_pages, can_access_mtech } = body
```

Then update the `upsert` payload inside the profiles block (lines 98–110) to include it:

```typescript
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .upsert(
    {
      user_id: userId,
      name,
      email,
      avatar: avatar || null,
      group_id: group_id || null,
      squad_id: squad_id || null,
      category_id: category_id || null,
      is_coringa: is_coringa || false,
      additional_pages: additional_pages || [],
      can_access_mtech: can_access_mtech === true,
    },
    { onConflict: 'user_id' }
  )
```

- [ ] **Step 2: Update update-user to accept the flag**

In `supabase/functions/update-user/index.ts`, change `UpdateUserRequest` (lines 4–17) to add the field:

```typescript
interface UpdateUserRequest {
  userId: string
  email?: string
  password?: string
  name?: string
  role?: string
  department?: string
  avatar?: string
  group_id?: string | null
  squad_id?: string | null
  category_id?: string | null
  is_coringa?: boolean
  additional_pages?: string[]
  can_access_mtech?: boolean
}
```

Update the destructure on line 61 to pull the new field:

```typescript
const { userId, email, password, name, role, department, avatar, group_id, squad_id, category_id, is_coringa, additional_pages, can_access_mtech } = body
```

Then inside the `profileUpdates` block (lines 105–114) add one line:

```typescript
const profileUpdates: Record<string, unknown> = {}
if (name) profileUpdates.name = name
if (email) profileUpdates.email = email
if (department !== undefined) profileUpdates.department = department
if (avatar !== undefined) profileUpdates.avatar = avatar
if (group_id !== undefined) profileUpdates.group_id = group_id
if (squad_id !== undefined) profileUpdates.squad_id = squad_id
if (category_id !== undefined) profileUpdates.category_id = category_id
if (is_coringa !== undefined) profileUpdates.is_coringa = is_coringa
if (additional_pages !== undefined) profileUpdates.additional_pages = additional_pages
if (can_access_mtech !== undefined) profileUpdates.can_access_mtech = can_access_mtech
```

- [ ] **Step 3: Deploy both edge functions**

```bash
cd /Volumes/Untitled/refine-dash-main
set -a; source .env.scripts; set +a
supabase functions deploy create-user --project-ref semhnpwxptfgqxhkoqsk
supabase functions deploy update-user --project-ref semhnpwxptfgqxhkoqsk
```

Expected: two `Deployed Function ...` lines, no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/create-user/index.ts supabase/functions/update-user/index.ts
git commit -m "feat(mtech): edge functions accept can_access_mtech"
```

---

## Task 3: AuthContext + `useUsers` types

**Files:**
- Modify: `src/types/auth.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/hooks/useUsers.ts`

- [ ] **Step 1: Extend the `User` type**

In `src/types/auth.ts`, change the `User` interface (lines 20–26):

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  can_access_mtech: boolean;
}
```

- [ ] **Step 2: Populate the field in AuthContext**

In `src/contexts/AuthContext.tsx`, inside `fetchUserData` (lines 74–82), change the returned object to include `can_access_mtech`:

```typescript
      return {
        id: profile.user_id,
        name: profile.name,
        email: profile.email,
        role,
        avatar: profile.avatar || undefined,
        group_id: profile.group_id,
        squad_id: profile.squad_id,
        can_access_mtech: profile.can_access_mtech === true,
      };
```

(The `.select('*')` on line 46 already returns every profile column, so no query change is needed.)

- [ ] **Step 3: Extend `DbUser` + the two mutation types**

In `src/hooks/useUsers.ts`:

Change the `DbUser` interface (lines 5–21) to add the flag at the end:

```typescript
export interface DbUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  created_at: string;
  group_id: string | null;
  squad_id: string | null;
  category_id: string | null;
  is_coringa: boolean;
  additional_pages: string[];
  can_access_mtech: boolean;
  group_name?: string;
  squad_name?: string;
  category_name?: string;
}
```

In `useUsers` map (lines 48–67), add one line inside the returned object:

```typescript
        return {
          id: profile.id,
          user_id: profile.user_id,
          name: profile.name,
          email: profile.email,
          role: (userRole?.role as UserRole) || 'design',
          avatar: profile.avatar,
          created_at: profile.created_at,
          group_id: profile.group_id,
          squad_id: profile.squad_id,
          category_id: profile.category_id,
          is_coringa: profile.is_coringa || false,
          additional_pages: profile.additional_pages || [],
          can_access_mtech: profile.can_access_mtech === true,
          group_name: (profile.organization_groups as any)?.name || null,
          squad_name: (profile.squads as any)?.name || null,
          category_name: (profile.independent_categories as any)?.name || null,
        };
```

Change the `useCreateUser` mutationFn input type (lines 77–87) to add the field:

```typescript
    mutationFn: async (data: {
      email: string;
      password: string;
      name: string;
      role: UserRole;
      group_id?: string;
      squad_id?: string;
      category_id?: string;
      is_coringa?: boolean;
      additional_pages?: string[];
      can_access_mtech?: boolean;
    }) => {
```

Change the `useUpdateUser` mutationFn input type (lines 120–131) the same way:

```typescript
    mutationFn: async (data: {
      userId: string;
      email?: string;
      password?: string;
      name?: string;
      role?: UserRole;
      group_id?: string | null;
      squad_id?: string | null;
      category_id?: string | null;
      is_coringa?: boolean;
      additional_pages?: string[];
      can_access_mtech?: boolean;
    }) => {
```

No further changes needed — the hooks already spread `data` into the edge function body verbatim.

- [ ] **Step 4: Typecheck**

```bash
cd /Volumes/Untitled/refine-dash-main
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "AuthContext|useUsers|types/auth" || echo "no errors in touched files"
```

Expected: `no errors in touched files`.

- [ ] **Step 5: Commit**

```bash
git add src/types/auth.ts src/contexts/AuthContext.tsx src/hooks/useUsers.ts
git commit -m "feat(mtech): carry can_access_mtech through AuthContext and useUsers"
```

---

## Task 4: Route guard + sidebar gate

**Files:**
- Modify: `src/App.tsx:104-111`
- Modify: `src/components/layout/AppSidebar.tsx:344`

- [ ] **Step 1: Update `MilennialsTechRoute`**

In `src/App.tsx`, the current `MilennialsTechRoute`:

```typescript
function MilennialsTechRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!(isExecutive(user?.role) || user?.role === 'devs')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
```

Change the role check to include the flag:

```typescript
function MilennialsTechRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!(isExecutive(user?.role) || user?.role === 'devs' || user?.can_access_mtech)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Update sidebar gate**

In `src/components/layout/AppSidebar.tsx`, line 344:

```typescript
        {(isExecutive(user?.role) || user?.role === 'devs') && (
```

Change to:

```typescript
        {(isExecutive(user?.role) || user?.role === 'devs' || user?.can_access_mtech) && (
```

- [ ] **Step 3: Typecheck**

```bash
cd /Volumes/Untitled/refine-dash-main
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "App\.tsx|AppSidebar\.tsx" || echo "ok"
```

Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/layout/AppSidebar.tsx
git commit -m "feat(mtech): route guard and sidebar honor can_access_mtech"
```

---

## Task 5: CreateUserModal — Switch + pipe-through

**Files:**
- Modify: `src/components/admin/CreateUserModal.tsx`
- Modify: `src/pages/admin/UsersPage.tsx`

- [ ] **Step 1: Extend `onSubmit` prop signature + `formData`**

In `src/components/admin/CreateUserModal.tsx`, change the `onSubmit` signature (lines 14–24) to accept the flag:

```typescript
  onSubmit: (user: {
    name: string;
    email: string;
    role: UserRole;
    group_id?: string;
    squad_id?: string;
    category_id?: string;
    is_coringa?: boolean;
    additional_pages?: string[];
    can_access_mtech?: boolean;
  }, password: string) => void;
```

Change the `formData` state initializer (lines 292–296):

```typescript
  const [formData, setFormData] = useState({
    name: '', email: '', password: '',
    role: '' as UserRole | '',
    group_id: '', squad_id: '', category_id: '',
    can_access_mtech: false,
  });
```

Also reset it in `handleClose` (around line 409):

```typescript
    setFormData({ name: '', email: '', password: '', role: '', group_id: '', squad_id: '', category_id: '', can_access_mtech: false });
```

- [ ] **Step 2: Derive the locked-by-role state**

After the existing `assignmentType` / `isCoringa` computations around line 304, add:

```typescript
  const mtechByRole = formData.role === 'ceo' || formData.role === 'cto' || formData.role === 'devs';
  const effectiveMtechAccess = mtechByRole || formData.can_access_mtech;
```

- [ ] **Step 3: Pipe `can_access_mtech` through `handleSubmit`**

In `handleSubmit` (lines 377–405), update **both** `onSubmit(...)` calls to include the flag. For the custom profile path (line 384), just pass `formData.can_access_mtech`. For the standard-role path (line 394), pass `effectiveMtechAccess` so the role-locked state propagates:

```typescript
    if (accessMode === 'custom' && selectedCustomRole) {
      onSubmit({
        name: formData.name,
        email: formData.email,
        role: 'gestor_projetos' as UserRole,
        additional_pages: selectedCustomRole.allowed_pages,
        can_access_mtech: formData.can_access_mtech,
      }, formData.password);
    } else {
      let finalAdditionalPages = [...additionalPages];

      onSubmit({
        name: formData.name,
        email: formData.email,
        role: formData.role as UserRole,
        group_id: assignmentType === 'group' ? formData.group_id : undefined,
        squad_id: assignmentType === 'group' && !isCoringa ? formData.squad_id : undefined,
        category_id: assignmentType === 'independent' ? formData.category_id : undefined,
        is_coringa: isCoringa,
        additional_pages: finalAdditionalPages.length > 0 ? finalAdditionalPages : undefined,
        can_access_mtech: effectiveMtechAccess,
      }, formData.password);
    }
```

- [ ] **Step 4: Add the Switch block at the end of the form**

In the same file, find the closing `</form>` near the bottom of the JSX. **Immediately before** the submit button (or just before `</form>`, whichever comes first — read the file first to anchor uniquely), insert:

```tsx
              {/* ═══ ACESSO A MÓDULOS ═══ */}
              <div className="space-y-2 pt-4 border-t border-border">
                <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                  <Shield size={14} />
                  Acesso a módulos
                </label>
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                    effectiveMtechAccess
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/30 border-border hover:bg-muted/50",
                    mtechByRole && "cursor-not-allowed opacity-90"
                  )}
                  title={mtechByRole ? 'Acesso garantido pelo cargo' : undefined}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                    checked={effectiveMtechAccess}
                    disabled={mtechByRole || isLoading}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, can_access_mtech: e.target.checked }))
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">Milennials Tech</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {mtechByRole
                        ? 'Acesso garantido pelo cargo.'
                        : 'Permite ver o kanban e backlog técnico independente do cargo.'}
                    </p>
                  </div>
                </label>
              </div>
```

(`Shield` and `cn` are already imported at the top of the file.)

- [ ] **Step 5: Update `handleCreateUser` in UsersPage to forward the flag**

In `src/pages/admin/UsersPage.tsx` (around line 60 — `handleCreateUser`), extend the type and the forward:

```typescript
  const handleCreateUser = async (newUser: {
    name: string;
    email: string;
    role: UserRole;
    group_id?: string;
    squad_id?: string;
    category_id?: string;
    is_coringa?: boolean;
    additional_pages?: string[];
    can_access_mtech?: boolean;
  }, password: string) => {
    try {
      await createUser.mutateAsync({
        email: newUser.email,
        password,
        name: newUser.name,
        role: newUser.role,
        group_id: newUser.group_id,
        squad_id: newUser.squad_id,
        category_id: newUser.category_id,
        is_coringa: newUser.is_coringa,
        additional_pages: newUser.additional_pages,
        can_access_mtech: newUser.can_access_mtech,
```

(Leave the `try/catch/toast` portion untouched — just add the one line.)

- [ ] **Step 6: Typecheck**

```bash
cd /Volumes/Untitled/refine-dash-main
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "CreateUserModal|UsersPage" || echo "ok"
```

Expected: `ok`.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/CreateUserModal.tsx src/pages/admin/UsersPage.tsx
git commit -m "feat(mtech): mtech access switch in CreateUserModal"
```

---

## Task 6: EditUserModal — Switch + pipe-through

**Files:**
- Modify: `src/components/admin/EditUserModal.tsx`
- Modify: `src/pages/admin/UsersPage.tsx`

- [ ] **Step 1: Extend `onSubmit` prop signature + `formData`**

In `src/components/admin/EditUserModal.tsx`, change the `onSubmit` signature (lines 14–23) to accept the flag:

```typescript
  onSubmit: (userId: string, updates: Partial<{
    name: string;
    email: string;
    role: UserRole;
    group_id: string | null;
    squad_id: string | null;
    category_id: string | null;
    is_coringa: boolean;
    additional_pages: string[];
    can_access_mtech: boolean;
  }>, newPassword?: string) => void;
```

Change the `formData` state (lines 87–97):

```typescript
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '' as UserRole,
    assignmentType: '' as 'group' | 'category' | '',
    group_id: '',
    squad_id: '',
    category_id: '',
    is_coringa: false,
    can_access_mtech: false,
  });
```

Change the `useEffect` that hydrates from `user` (lines 101–123) — add one line after `is_coringa`:

```typescript
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        assignmentType,
        group_id: user.group_id || '',
        squad_id: user.squad_id || '',
        category_id: user.category_id || '',
        is_coringa: user.is_coringa || false,
        can_access_mtech: user.can_access_mtech === true,
      });
```

- [ ] **Step 2: Derive locked-by-role state**

Just before `handleSubmit` (around line 174), add:

```typescript
  const mtechByRole = formData.role === 'ceo' || formData.role === 'cto' || formData.role === 'devs';
  const effectiveMtechAccess = mtechByRole || formData.can_access_mtech;
```

- [ ] **Step 3: Send the flag in `updates`**

In `handleSubmit` (starting line 176), right after the `additional_pages: additionalPages` assignment inside the `updates` object, also assign `can_access_mtech`:

```typescript
    const updates: Partial<{
      name: string;
      email: string;
      role: UserRole;
      group_id: string | null;
      squad_id: string | null;
      category_id: string | null;
      is_coringa: boolean;
      additional_pages: string[];
      can_access_mtech: boolean;
    }> = {
      name: formData.name,
      email: formData.email,
      additional_pages: additionalPages,
      can_access_mtech: effectiveMtechAccess,
    };
```

- [ ] **Step 4: Add the Switch block at the end of the form**

Read the file to locate the closing `</form>` near the bottom. **Immediately before** the submit button row, insert:

```tsx
          <div className="space-y-2 pt-4 border-t border-border">
            <label className="block text-sm font-medium text-foreground">Acesso a módulos</label>
            <label
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                effectiveMtechAccess ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border hover:bg-muted/50",
                mtechByRole && "cursor-not-allowed opacity-90"
              )}
              title={mtechByRole ? 'Acesso garantido pelo cargo' : undefined}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                checked={effectiveMtechAccess}
                disabled={mtechByRole || isLoading}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, can_access_mtech: e.target.checked }))
                }
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">Milennials Tech</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mtechByRole
                    ? 'Acesso garantido pelo cargo.'
                    : 'Permite ver o kanban e backlog técnico independente do cargo.'}
                </p>
              </div>
            </label>
          </div>
```

(`cn` is already imported at the top.)

- [ ] **Step 5: Update `handleUpdateUser` in UsersPage**

In `src/pages/admin/UsersPage.tsx`, find `handleUpdateUser` (or whatever the edit handler is named — grep `EditUserModal` usage in the file). Extend the partial-updates type to include `can_access_mtech?: boolean` and forward it through to `updateUser.mutateAsync`. Example shape (adjust to match the file's existing style):

```typescript
  const handleUpdateUser = async (
    userId: string,
    updates: Partial<{
      name: string;
      email: string;
      role: UserRole;
      group_id: string | null;
      squad_id: string | null;
      category_id: string | null;
      is_coringa: boolean;
      additional_pages: string[];
      can_access_mtech: boolean;
    }>,
    newPassword?: string
  ) => {
    await updateUser.mutateAsync({
      userId,
      ...updates,
      ...(newPassword ? { password: newPassword } : {}),
    });
  };
```

(If the existing handler already uses `...updates` spread, the only change is the type widening — no behavior change, because spread carries `can_access_mtech` automatically.)

- [ ] **Step 6: Typecheck**

```bash
cd /Volumes/Untitled/refine-dash-main
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "EditUserModal|UsersPage" || echo "ok"
```

Expected: `ok`.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/EditUserModal.tsx src/pages/admin/UsersPage.tsx
git commit -m "feat(mtech): mtech access switch in EditUserModal"
```

---

## Task 7: Quick toggle column in the users list

**Files:**
- Modify: `src/pages/admin/UsersPage.tsx`

- [ ] **Step 1: Add the optimistic mutation helper**

Near the other `useMutation` hooks at the top of `UsersPage` (after line 27), add an inline `useQueryClient` import if not present and a local optimistic toggle:

```typescript
import { useQueryClient } from '@tanstack/react-query';
// ... existing imports unchanged

export default function UsersPage() {
  // ... existing state and hooks

  const queryClient = useQueryClient();

  const toggleMtechAccess = async (row: DbUser) => {
    const prev = row.can_access_mtech;
    queryClient.setQueryData<DbUser[]>(['users'], (old) =>
      old?.map((u) => (u.user_id === row.user_id ? { ...u, can_access_mtech: !prev } : u)) ?? old
    );
    const { error } = await supabase
      .from('profiles')
      .update({ can_access_mtech: !prev })
      .eq('user_id', row.user_id);
    if (error) {
      queryClient.setQueryData<DbUser[]>(['users'], (old) =>
        old?.map((u) => (u.user_id === row.user_id ? { ...u, can_access_mtech: prev } : u)) ?? old
      );
      toast.error('Falha ao atualizar acesso Milennials Tech');
    }
  };
```

Also add `import { supabase } from '@/integrations/supabase/client';` at the top if it's not already imported (check with grep before adding).

- [ ] **Step 2: Add the header cell**

In the table header row (around lines 204–221), insert a new `<th>` right before the "Ações" column:

```tsx
                  <th className="px-6 py-4 text-left text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Milennials Tech
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Ações
                  </th>
```

Also change the `colSpan` on the empty-state row (line 226):

```tsx
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
```

becomes:

```tsx
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
```

- [ ] **Step 3: Add the body cell**

In the row body (around line 284, after the email `<td>` and before the Ações `<td>`), insert:

```tsx
                      <td className="px-6 py-4">
                        {user.role === 'ceo' || user.role === 'cto' || user.role === 'devs' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground" title="Acesso garantido pelo cargo">
                            Incluso
                          </span>
                        ) : (
                          <label className="inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={user.can_access_mtech}
                              onChange={() => toggleMtechAccess(user)}
                            />
                            <span className="relative h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-background after:transition-transform peer-checked:after:translate-x-4" />
                          </label>
                        )}
                      </td>
```

- [ ] **Step 4: Typecheck**

```bash
cd /Volumes/Untitled/refine-dash-main
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "UsersPage" || echo "ok"
```

Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/UsersPage.tsx
git commit -m "feat(mtech): quick toggle column for mtech access in users list"
```

---

## Task 8: End-to-end validation

- [ ] **Step 1: Full typecheck on touched files**

```bash
cd /Volumes/Untitled/refine-dash-main
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "AuthContext|useUsers|types/auth|App\.tsx|AppSidebar\.tsx|CreateUserModal|EditUserModal|UsersPage" || echo "no errors in touched files"
```

Expected: `no errors in touched files`.

- [ ] **Step 2: Lint touched files only**

```bash
cd /Volumes/Untitled/refine-dash-main
npx eslint \
  src/types/auth.ts \
  src/contexts/AuthContext.tsx \
  src/hooks/useUsers.ts \
  src/App.tsx \
  src/components/layout/AppSidebar.tsx \
  src/components/admin/CreateUserModal.tsx \
  src/components/admin/EditUserModal.tsx \
  src/pages/admin/UsersPage.tsx
```

Expected: exit code 0.

- [ ] **Step 3: End-to-end toggle via REST**

Create `/Volumes/Untitled/refine-dash-main/.tmp-e2e-toggle.mjs`:

```javascript
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const loadEnv = (p) => { for (const r of readFileSync(p, 'utf8').split('\n')) { const l = r.replace(/\r$/, '').trim(); if (!l || l.startsWith('#')) continue; const eq = l.indexOf('='); if (eq <= 0) continue; let v = l.slice(eq+1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[l.slice(0, eq).trim()] = v } }
loadEnv('/Volumes/Untitled/refine-dash-main/.env'); loadEnv('/Volumes/Untitled/refine-dash-main/.env.scripts')

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }})

// Fetch an existing design/rh user (role without mtech) to test the full loop
const { data: users, error } = await admin
  .from('profiles')
  .select('user_id, name, can_access_mtech, user_roles(role)')
  .limit(50)
if (error) { console.error(error); process.exit(1) }

const target = users.find(u => {
  const role = (u.user_roles?.[0]?.role ?? u.user_roles?.role) || null
  return role && !['ceo','cto','devs'].includes(role)
})
if (!target) { console.error('No suitable test user found'); process.exit(1) }

const prev = target.can_access_mtech
await admin.from('profiles').update({ can_access_mtech: !prev }).eq('user_id', target.user_id)
const { data: sawFlag } = await admin.rpc('can_see_tech', { _user_id: target.user_id })
if (sawFlag !== !prev) { console.error('FAIL — can_see_tech did not reflect new flag', { expected: !prev, got: sawFlag }); await admin.from('profiles').update({ can_access_mtech: prev }).eq('user_id', target.user_id); process.exit(1) }
console.log('OK — can_see_tech reflects toggled flag')

// restore
await admin.from('profiles').update({ can_access_mtech: prev }).eq('user_id', target.user_id)
console.log('restored')
```

Run:

```bash
cd /Volumes/Untitled/refine-dash-main
node .tmp-e2e-toggle.mjs
rm .tmp-e2e-toggle.mjs
```

Expected: `OK — can_see_tech reflects toggled flag` + `restored`.

- [ ] **Step 4: Manual browser smoke test**

Start the dev server (`npm run dev`) and verify in order:

1. Log in as CEO. `/admin/usuarios` opens. Create a new user with role `design`, **without** touching the "Milennials Tech" checkbox. Save. In the list, the new user's Milennials Tech column shows an off switch.
2. Click the switch in the list. It turns on (optimistic) and stays on.
3. Log out, log in as that new user. Verify the Milennials Tech item now appears in the sidebar and `/milennials-tech/kanban` loads without redirect.
4. Log out, log back in as CEO. Click the switch off. Log in as the test user again — sidebar item gone, `/milennials-tech/*` redirects to `/dashboard`.
5. In CEO session, open Edit on a `ceo`/`cto`/`devs` user. Verify the switch is `checked` and `disabled`, with tooltip "Acesso garantido pelo cargo".
6. As a `rh` user (not admin), try the REST update of another user's `can_access_mtech` via the browser devtools — should fail with `42501`.

If any step fails, note which and re-open the plan.

- [ ] **Step 5: Push**

```bash
git log --oneline -10
git push origin main
```
