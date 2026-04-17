# mtech Task Creator Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Milennials Tech task's creator reliably linked and visible in the UI, and permanently immutable at the database layer.

**Architecture:** One database migration adds a `BEFORE UPDATE` trigger on `public.tech_tasks` that rejects any change to `created_by` (pgTAP-tested). UI changes read `created_by` through the existing `useProfileMap()` hook — zero new queries — and render an avatar stack on task cards (with an "own" micro-badge when creator = assignee) plus a "Criada por" sidebar block in the detail modal.

**Tech Stack:** Supabase Postgres (plpgsql trigger), pgTAP, React + TypeScript, TanStack Query (already cached), Tailwind with `var(--mtech-*)` design tokens.

Spec: `docs/superpowers/specs/2026-04-17-mtech-task-creator-visibility-design.md`

---

## Task 1: Database — immutability trigger for `tech_tasks.created_by`

**Files:**
- Create: `supabase/migrations/20260417120000_tech_tasks_lock_created_by.sql`
- Create: `supabase/tests/tech_tasks_created_by_immutable_test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/tech_tasks_created_by_immutable_test.sql`:

```sql
-- supabase/tests/tech_tasks_created_by_immutable_test.sql
-- pgTAP regression test for the tech_tasks created_by immutability trigger.
--
-- Guards against: migration 20260417120000_tech_tasks_lock_created_by.sql being
-- reverted or a future migration dropping the trigger. If the trigger disappears,
-- any UPDATE path (RLS own, RLS exec, direct SQL) could silently rewrite the
-- task's author — breaking the audit trail the feature exists to preserve.

BEGIN;

SELECT plan(3);

-- ============================================================
-- Seed: two users + one task owned by user A
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('cccccccc-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'author-test@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'other-test@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('cccccccc-0000-0000-0000-000000000001'::uuid, 'Author Test', 'author-test@test.local'),
  ('cccccccc-0000-0000-0000-000000000002'::uuid, 'Other Test',  'other-test@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.tech_tasks
  (id, title, type, status, priority, acceptance_criteria, created_by)
VALUES
  ('dddddddd-0000-0000-0000-000000000001'::uuid,
   'Immutability fixture task', 'CHORE', 'BACKLOG', 'LOW', 'n/a',
   'cccccccc-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Test 1: harmless UPDATE (other columns) passes
-- ============================================================
SELECT lives_ok(
  $$ UPDATE public.tech_tasks
     SET title = 'Renamed fixture'
     WHERE id = 'dddddddd-0000-0000-0000-000000000001'::uuid $$,
  'UPDATE of non-created_by column succeeds'
);

-- ============================================================
-- Test 2: UPDATE attempting to change created_by raises
-- ============================================================
SELECT throws_ok(
  $$ UPDATE public.tech_tasks
     SET created_by = 'cccccccc-0000-0000-0000-000000000002'::uuid
     WHERE id = 'dddddddd-0000-0000-0000-000000000001'::uuid $$,
  '23514',
  'created_by is immutable',
  'Direct UPDATE of created_by is rejected with SQLSTATE 23514 (check_violation)'
);

-- ============================================================
-- Test 3: created_by value is unchanged after attempted tamper
-- ============================================================
SELECT results_eq(
  $$ SELECT created_by
     FROM public.tech_tasks
     WHERE id = 'dddddddd-0000-0000-0000-000000000001'::uuid $$,
  $$ VALUES ('cccccccc-0000-0000-0000-000000000001'::uuid) $$,
  'created_by retains original author after rejected UPDATE'
);

SELECT * FROM finish();

ROLLBACK;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db --linked --file supabase/tests/tech_tasks_created_by_immutable_test.sql`

Expected: Test 2 FAILs ("UPDATE succeeded, expected throw") and Test 3 FAILs (created_by changed). Test 1 passes. The trigger does not exist yet.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260417120000_tech_tasks_lock_created_by.sql`:

```sql
-- 20260417120000_tech_tasks_lock_created_by.sql
-- Make tech_tasks.created_by immutable at the database layer.
--
-- Rationale: created_by identifies who authored the task and is the only
-- reliable signal for discussing a task with its originator. Nothing in the
-- existing RLS policies prevents an UPDATE from rewriting that column, so any
-- executive or hot path could (accidentally or not) erase authorship. RLS
-- cannot compare OLD/NEW on UPDATE — a BEFORE UPDATE trigger is the correct
-- primitive.

CREATE OR REPLACE FUNCTION public.tech_tasks_lock_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tech_tasks_lock_created_by ON public.tech_tasks;

CREATE TRIGGER trg_tech_tasks_lock_created_by
  BEFORE UPDATE ON public.tech_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tech_tasks_lock_created_by();
```

- [ ] **Step 4: Push the migration and re-run the test**

Run:
```
supabase db push --linked
supabase test db --linked --file supabase/tests/tech_tasks_created_by_immutable_test.sql
```

Expected: `ok 1 - UPDATE of non-created_by column succeeds`, `ok 2 - Direct UPDATE of created_by is rejected with SQLSTATE 23514 (check_violation)`, `ok 3 - created_by retains original author after rejected UPDATE`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260417120000_tech_tasks_lock_created_by.sql supabase/tests/tech_tasks_created_by_immutable_test.sql
git commit -m "feat(mtech): lock tech_tasks.created_by as immutable"
```

---

## Task 2: UI — `TaskCard` avatar stack + "own" micro-badge

**Files:**
- Modify: `src/features/milennials-tech/components/TaskCard.tsx:97-110` (row 3: assignee area)

Visual rule:
- `created_by === assignee_id`: single assignee avatar (20px) with a 6px accent dot at bottom-right, `aria-label="Criada pelo responsável"`.
- `created_by !== assignee_id`: two avatars in a `-space-x-2` stack; creator behind, assignee in front. Both have `title` tooltips ("Criada por …" and "Responsável: …").
- No assignee: single creator avatar, no badge. Label text shows "por {creator name}".
- `profileMap[created_by] === undefined`: initials render as `??` and tooltip says "Criador indisponível".

- [ ] **Step 1: Replace the existing row-3 assignee block**

In `src/features/milennials-tech/components/TaskCard.tsx`, after line 46 (`const totalTime = ...`), compute the creator values:

```typescript
  const assigneeName = task.assignee_id ? profileMap[task.assignee_id] : null;
  const assigneeInitials = assigneeName ? getInitials(assigneeName) : null;

  const creatorName = profileMap[task.created_by] ?? null;
  const creatorInitials = creatorName ? getInitials(creatorName) : '??';
  const creatorTooltip = creatorName ? `Criada por ${creatorName}` : 'Criador indisponível';
  const isSelfAssigned = !!task.assignee_id && task.assignee_id === task.created_by;
```

Then replace the old row-3 assignee block (currently the `<div className="flex items-center gap-1.5 min-w-0">` subtree at lines 99-110) with:

```tsx
        <div className="flex items-center gap-1.5 min-w-0">
          {isSelfAssigned ? (
            /* Creator == Assignee: one avatar with "own" accent dot */
            <span
              title={`Criada por ${assigneeName} (responsável)`}
              className="relative flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none"
            >
              {assigneeInitials}
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full"
                style={{ background: 'var(--mtech-accent)', boxShadow: '0 0 0 1.5px var(--mtech-surface)' }}
              />
            </span>
          ) : task.assignee_id ? (
            /* Different creator and assignee: stacked avatars */
            <span className="flex items-center -space-x-2 flex-shrink-0">
              <span
                title={creatorTooltip}
                className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none"
              >
                {creatorInitials}
              </span>
              <span
                title={`Responsável: ${assigneeName}`}
                className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none"
              >
                {assigneeInitials}
              </span>
            </span>
          ) : (
            /* No assignee: creator only */
            <span
              title={creatorTooltip}
              className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold text-[var(--mtech-text-muted)] select-none"
            >
              {creatorInitials}
            </span>
          )}
          {assigneeName ? (
            <span className="truncate text-[11px] text-[var(--mtech-text-muted)]">
              {assigneeName}
            </span>
          ) : (
            <span className="truncate text-[11px] text-[var(--mtech-text-subtle)]">
              por {creatorName ?? 'usuário removido'}
            </span>
          )}
        </div>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "TaskCard\.tsx" || echo "ok"`

Expected: `ok` (no errors in TaskCard.tsx).

- [ ] **Step 3: Manual visual check**

Start dev server (`npm run dev`) and open `/milennials-tech/kanban`. Verify:
- Task where creator = assignee → one avatar + accent dot.
- Task with different creator and assignee → two overlapping avatars, hover shows the right tooltip on each.
- Task with no assignee → single creator avatar + "por {name}" text.
- Tasks where `profileMap` is still loading briefly show the creator's initials once it resolves (no flicker of broken state).

- [ ] **Step 4: Commit**

```bash
git add src/features/milennials-tech/components/TaskCard.tsx
git commit -m "feat(mtech): show creator avatar on task cards"
```

---

## Task 3: UI — `TaskDetailModal` "Criada por" sidebar block

**Files:**
- Modify: `src/features/milennials-tech/components/TaskDetailModal.tsx` (add block before the "Assignee" block at line 324)

- [ ] **Step 1: Add the "Criada por" block above "Responsável"**

In `src/features/milennials-tech/components/TaskDetailModal.tsx`, locate the Assignee block starting at line 324 (`{/* Assignee */}`) and **immediately before** that comment insert:

```tsx
            {/* Creator */}
            <div>
              <h3 className="text-xs font-medium text-[var(--mtech-text-muted)] uppercase tracking-wide mb-1">
                Criada por
              </h3>
              {(() => {
                const creatorName = profileMap[task.created_by] ?? null;
                const creatorLabel = creatorName ?? 'Usuário removido';
                const createdAt = new Date(task.created_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div className="flex flex-col gap-0.5">
                    <p
                      className={
                        creatorName
                          ? 'text-sm font-medium text-[var(--mtech-text)]'
                          : 'text-sm italic text-[var(--mtech-text-muted)]'
                      }
                    >
                      {creatorLabel}
                    </p>
                    <time
                      data-mono
                      dateTime={task.created_at}
                      className="text-[11px] text-[var(--mtech-text-subtle)]"
                    >
                      {createdAt}
                    </time>
                  </div>
                );
              })()}
            </div>
```

Note: the date format uses the same `toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })` pattern already used in the activity timeline (lines 478-483), keeping formatting consistent across the modal without adding a date-fns import.

`task.created_at` is already present on the `TechTask` type — it is the generated Supabase row type (`Database['public']['Tables']['tech_tasks']['Row']` in `src/features/milennials-tech/types.ts:3`) and the column has always existed on the table. No type change needed.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "TaskDetailModal\.tsx" || echo "ok"`

Expected: `ok`.

- [ ] **Step 3: Manual visual check**

Open any task in `/milennials-tech/kanban` or `/milennials-tech/backlog` by clicking its card. Verify:
- Sidebar (right column) shows a "Criada por" block above "Responsável".
- Name is full user name (or "Usuário removido" in italic if the profile was deleted).
- Date format matches the activity timeline (`16/abr 14:32`).
- The block renders even when `created_by === assignee_id`.

- [ ] **Step 4: Commit**

```bash
git add src/features/milennials-tech/components/TaskDetailModal.tsx
git commit -m "feat(mtech): show creator + created_at in task detail sidebar"
```

---

## Task 4: UI — `TaskRow` creator avatar in list view

**Files:**
- Modify: `src/features/milennials-tech/components/TaskRow.tsx:76-79` (assignee cell)

- [ ] **Step 1: Import `getInitials` and render stacked avatars in the assignee cell**

In `src/features/milennials-tech/components/TaskRow.tsx`, change the import at line 4:

```typescript
import { useProfileMap, getInitials } from '../hooks/useProfiles';
```

Then replace the assignee cell at lines 76-79 (`{/* Assignee placeholder */}` through the closing `</span>`) with:

```tsx
      {/* Creator + assignee */}
      <span className="w-28 flex items-center justify-end gap-1.5 text-xs text-[var(--mtech-text-muted)] flex-shrink-0">
        {(() => {
          const creatorName = profileMap[task.created_by] ?? null;
          const creatorInitials = creatorName ? getInitials(creatorName) : '??';
          const assigneeName = task.assignee_id ? profileMap[task.assignee_id] ?? null : null;
          const assigneeInitials = assigneeName ? getInitials(assigneeName) : null;
          const isSelfAssigned = !!task.assignee_id && task.assignee_id === task.created_by;
          const creatorTooltip = creatorName ? `Criada por ${creatorName}` : 'Criador indisponível';

          if (isSelfAssigned) {
            return (
              <>
                <span
                  title={`Criada por ${assigneeName} (responsável)`}
                  className="relative flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold select-none"
                >
                  {assigneeInitials}
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full"
                    style={{ background: 'var(--mtech-accent)', boxShadow: '0 0 0 1.5px var(--mtech-bg)' }}
                  />
                </span>
                <span className="truncate">{assigneeName}</span>
              </>
            );
          }
          if (task.assignee_id) {
            return (
              <>
                <span className="flex items-center -space-x-2">
                  <span
                    title={creatorTooltip}
                    className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold select-none"
                  >
                    {creatorInitials}
                  </span>
                  <span
                    title={`Responsável: ${assigneeName}`}
                    className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold select-none"
                  >
                    {assigneeInitials}
                  </span>
                </span>
                <span className="truncate">{assigneeName}</span>
              </>
            );
          }
          return (
            <>
              <span
                title={creatorTooltip}
                className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[9px] font-semibold select-none"
              >
                {creatorInitials}
              </span>
              <span className="truncate text-[var(--mtech-text-subtle)]">por {creatorName ?? 'removido'}</span>
            </>
          );
        })()}
      </span>
```

Note: the cell width grew from `w-20` to `w-28` to accommodate two 20px avatars (`-space-x-2` → 30px overlap) plus the name. Verify on a narrow viewport that no horizontal scroll appears.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "TaskRow\.tsx" || echo "ok"`

Expected: `ok`.

- [ ] **Step 3: Manual visual check**

Open `/milennials-tech/backlog` (list view uses `TaskRow`). Verify the new cell renders avatars in the same three shapes as `TaskCard` and row height stays at `h-10` (no wrap).

- [ ] **Step 4: Commit**

```bash
git add src/features/milennials-tech/components/TaskRow.tsx
git commit -m "feat(mtech): show creator avatar in backlog list row"
```

---

## Task 5: UI — `SprintFormModal` creator avatar in task picker

**Files:**
- Modify: `src/features/milennials-tech/components/SprintFormModal.tsx:244-293` (available-tasks picker block)

- [ ] **Step 1: Import `getInitials` and add a creator avatar to each picker row**

In `src/features/milennials-tech/components/SprintFormModal.tsx`, change the import at line 18:

```typescript
import { useProfileMap, getInitials } from '../hooks/useProfiles';
```

In the `availableTasks.map` body, right after the current `const assigneeName = ...` line (249), add:

```typescript
                  const creatorName = profileMap[task.created_by] ?? null;
                  const creatorInitials = creatorName ? getInitials(creatorName) : '??';
                  const creatorTooltip = creatorName ? `Criada por ${creatorName}` : 'Criador indisponível';
                  const isSelfAssigned = !!task.assignee_id && task.assignee_id === task.created_by;
                  const assigneeInitials = assigneeName ? getInitials(assigneeName) : null;
```

Then replace the existing assignee-name span (lines 288-293, the block starting with `{/* Assignee */}`) with:

```tsx
                      {/* Creator + assignee avatars */}
                      <span className="flex-shrink-0 flex items-center gap-1.5 text-[10px] text-[var(--mtech-text-subtle)]">
                        {isSelfAssigned && assigneeInitials ? (
                          <span
                            title={`Criada por ${assigneeName} (responsável)`}
                            className="relative flex items-center justify-center h-4 w-4 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[8px] font-semibold select-none"
                          >
                            {assigneeInitials}
                            <span
                              aria-hidden
                              className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full"
                              style={{ background: 'var(--mtech-accent)', boxShadow: '0 0 0 1px var(--mtech-bg)' }}
                            />
                          </span>
                        ) : task.assignee_id && assigneeInitials ? (
                          <span className="flex items-center -space-x-1.5">
                            <span
                              title={creatorTooltip}
                              className="flex items-center justify-center h-4 w-4 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[8px] font-semibold select-none"
                            >
                              {creatorInitials}
                            </span>
                            <span
                              title={`Responsável: ${assigneeName}`}
                              className="flex items-center justify-center h-4 w-4 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[8px] font-semibold select-none"
                            >
                              {assigneeInitials}
                            </span>
                          </span>
                        ) : (
                          <span
                            title={creatorTooltip}
                            className="flex items-center justify-center h-4 w-4 rounded-full bg-[var(--mtech-surface-elev)] border border-[var(--mtech-border)] text-[8px] font-semibold select-none"
                          >
                            {creatorInitials}
                          </span>
                        )}
                        {assigneeName ?? (creatorName ? `por ${creatorName}` : '')}
                      </span>
```

Note: avatars here are 16px (`h-4 w-4`) since rows are denser than the kanban card. The accent-dot size scales to 6px to match.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "SprintFormModal\.tsx" || echo "ok"`

Expected: `ok`.

- [ ] **Step 3: Manual visual check**

Open `/milennials-tech/sprints`, click "Criar sprint" (or edit an existing one). The task picker should show the same three avatar shapes. Verify no row wraps.

- [ ] **Step 4: Commit**

```bash
git add src/features/milennials-tech/components/SprintFormModal.tsx
git commit -m "feat(mtech): show creator avatar in sprint task picker"
```

---

## Task 6: End-to-end validation

- [ ] **Step 1: Run the full typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: exit code 0, no errors.

- [ ] **Step 2: Run the lint**

Run: `npm run lint -- src/features/milennials-tech`

Expected: exit code 0.

- [ ] **Step 3: Re-run all mtech pgTAP tests together**

Run:
```
supabase test db --linked --file supabase/tests/tech_tasks_created_by_immutable_test.sql
supabase test db --linked --file supabase/tests/is_ceo_cto_test.sql
```

Expected: both `ok` for all planned tests.

- [ ] **Step 4: Manual acceptance pass**

With dev server on, go through the spec's acceptance criteria (section 7) and tick each:
1. Migration applied, pgTAP green. ✓
2. Direct UPDATE of `created_by` via Supabase dashboard SQL editor returns `23514 - created_by is immutable`. ✓
3. Kanban card shows creator (and assignee when different), with correct hover tooltips. ✓
4. Card with creator = assignee shows single avatar + accent dot. ✓
5. Detail modal sidebar shows "Criada por {name} / {date}" above "Responsável". ✓
6. Task whose creator has been removed from `profiles` shows "Usuário removido" in italic; app does not crash. Test by temporarily updating a `profiles.name` to `NULL` or deleting the row in a non-prod environment. ✓
7. Network tab does not show a new `profiles` request caused by the card changes (existing `useTechProfiles` stays the only call). ✓

- [ ] **Step 5: Final sanity commit (if any docs drift)**

If the manual pass reveals anything needing adjustment, fix and commit with a `fix(mtech): …` message. Otherwise move on.
