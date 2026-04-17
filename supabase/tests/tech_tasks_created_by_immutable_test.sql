-- supabase/tests/tech_tasks_created_by_immutable_test.sql
-- pgTAP regression test for the tech_tasks created_by immutability trigger.
--
-- Guards against: migration 20260417120000_tech_tasks_lock_created_by.sql (and
-- the 20260417120100 hardening follow-up) being reverted, or a future migration
-- dropping the trigger. If the trigger disappears, any UPDATE path (RLS own,
-- RLS exec, direct SQL) could silently rewrite the task's author — breaking
-- the audit trail the feature exists to preserve.

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

-- Test 1: harmless UPDATE (other columns) passes
SELECT lives_ok(
  $$ UPDATE public.tech_tasks
     SET title = 'Renamed fixture'
     WHERE id = 'dddddddd-0000-0000-0000-000000000001'::uuid $$,
  'UPDATE of non-created_by column succeeds'
);

-- Test 2: UPDATE attempting to change created_by raises 23514
SELECT throws_ok(
  $$ UPDATE public.tech_tasks
     SET created_by = 'cccccccc-0000-0000-0000-000000000002'::uuid
     WHERE id = 'dddddddd-0000-0000-0000-000000000001'::uuid $$,
  '23514',
  'created_by is immutable',
  'Direct UPDATE of created_by is rejected with SQLSTATE 23514 (check_violation)'
);

-- Test 3: created_by value is unchanged after attempted tamper
SELECT results_eq(
  $$ SELECT created_by
     FROM public.tech_tasks
     WHERE id = 'dddddddd-0000-0000-0000-000000000001'::uuid $$,
  $$ VALUES ('cccccccc-0000-0000-0000-000000000001'::uuid) $$,
  'created_by retains original author after rejected UPDATE'
);

SELECT * FROM finish();

ROLLBACK;
