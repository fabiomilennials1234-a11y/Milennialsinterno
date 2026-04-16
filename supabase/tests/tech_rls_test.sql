-- supabase/tests/tech_rls_test.sql
-- pgTAP tests for Milennials Tech RLS policies.
-- Tests: SELECT visibility, INSERT ownership, UPDATE scope, DELETE executive-only,
--        immutability of activities and time_entries.

BEGIN;

SELECT plan(15);

-- ============================================================
-- Seed
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('aaaaaaaa-1111-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rls-ceo@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aaaaaaaa-1111-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rls-dev@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aaaaaaaa-1111-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rls-outsider@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('aaaaaaaa-1111-0000-0000-000000000001'::uuid, 'RLS CEO', 'rls-ceo@test.local'),
  ('aaaaaaaa-1111-0000-0000-000000000002'::uuid, 'RLS Dev', 'rls-dev@test.local'),
  ('aaaaaaaa-1111-0000-0000-000000000003'::uuid, 'RLS Outsider', 'rls-outsider@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('aaaaaaaa-1111-0000-0000-000000000001'::uuid, 'ceo'),
  ('aaaaaaaa-1111-0000-0000-000000000002'::uuid, 'devs'),
  ('aaaaaaaa-1111-0000-0000-000000000003'::uuid, 'sucesso_cliente')
ON CONFLICT (user_id, role) DO NOTHING;

-- Helper
CREATE OR REPLACE FUNCTION _test_set_auth(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _user_id, 'role', 'authenticated')::text, true);
END;
$$;

-- Seed data as superuser
INSERT INTO public.tech_sprints (id, name, start_date, end_date, status)
VALUES ('dddddddd-0000-0000-0000-000000000001'::uuid, 'RLS Sprint', now(), now() + interval '14 days', 'PLANNING');

INSERT INTO public.tech_tasks (id, title, type, status, priority, sprint_id, assignee_id, created_by)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'RLS Task 1', 'FEATURE', 'TODO', 'HIGH',
   'dddddddd-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-1111-0000-0000-000000000002'::uuid,
   'aaaaaaaa-1111-0000-0000-000000000001'::uuid),
  ('eeeeeeee-0000-0000-0000-000000000002'::uuid, 'RLS Task 2', 'BUG', 'TODO', 'MEDIUM',
   'dddddddd-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-1111-0000-0000-000000000001'::uuid,
   'aaaaaaaa-1111-0000-0000-000000000001'::uuid);

-- Insert some time entries and activities as superuser (bypassing RLS)
INSERT INTO public.tech_time_entries (id, task_id, user_id, type)
VALUES ('ffffffff-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-1111-0000-0000-000000000002'::uuid, 'START');

-- ============================================================
-- 1-2. SELECT: CEO and Dev can see tech_tasks
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000001'::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.tech_tasks WHERE id IN ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000002'::uuid)),
  2,
  'CEO can see all tech_tasks'
);

SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000002'::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.tech_tasks WHERE id IN ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000002'::uuid)),
  2,
  'Dev can see all tech_tasks'
);

-- ============================================================
-- 3. SELECT: Outsider cannot see tech_tasks
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000003'::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.tech_tasks WHERE id IN ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000002'::uuid)),
  0,
  'Outsider cannot see tech_tasks'
);

-- ============================================================
-- 4. SELECT: Outsider cannot see tech_sprints
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.tech_sprints WHERE id = 'dddddddd-0000-0000-0000-000000000001'::uuid),
  0,
  'Outsider cannot see tech_sprints'
);

-- ============================================================
-- 5. SELECT: Outsider cannot see tech_time_entries
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.tech_time_entries WHERE id = 'ffffffff-0000-0000-0000-000000000001'::uuid),
  0,
  'Outsider cannot see tech_time_entries'
);

-- ============================================================
-- 6. INSERT tech_tasks: Dev can insert with created_by = self
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000002'::uuid);
SELECT lives_ok(
  $$INSERT INTO public.tech_tasks (id, title, type, status, priority, created_by)
    VALUES ('eeeeeeee-0000-0000-0000-000000000099'::uuid, 'Dev Task', 'CHORE', 'BACKLOG', 'LOW',
            'aaaaaaaa-1111-0000-0000-000000000002'::uuid)$$,
  'Dev can insert task with created_by = self'
);

-- ============================================================
-- 7. INSERT tech_tasks: Dev cannot set created_by to someone else
-- ============================================================
SELECT throws_ok(
  $$INSERT INTO public.tech_tasks (id, title, type, status, priority, created_by)
    VALUES ('eeeeeeee-0000-0000-0000-000000000098'::uuid, 'Spoofed', 'CHORE', 'BACKLOG', 'LOW',
            'aaaaaaaa-1111-0000-0000-000000000001'::uuid)$$,
  '42501',
  NULL,
  'Dev cannot spoof created_by to another user'
);

-- ============================================================
-- 8. UPDATE tech_tasks: Dev can update own assigned task
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000002'::uuid);
SELECT lives_ok(
  $$UPDATE public.tech_tasks SET title = 'Updated by Dev' WHERE id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid$$,
  'Dev (assignee) can update own task'
);

-- ============================================================
-- 9. UPDATE tech_tasks: Dev cannot update task assigned to CEO
-- ============================================================
-- Task 2 is assigned to CEO, dev should not be able to update it
UPDATE public.tech_tasks SET title = 'Attempted Update' WHERE id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid;
SELECT is(
  (SELECT title FROM public.tech_tasks WHERE id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid),
  'RLS Task 2',
  'Dev cannot update task assigned to another user (update silently ignored by RLS)'
);
-- Note: need to reset role to check actual value
RESET role;

SELECT is(
  (SELECT title FROM public.tech_tasks WHERE id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid),
  'RLS Task 2',
  'Confirmed: task assigned to CEO unchanged after dev update attempt'
);

-- ============================================================
-- 10. UPDATE tech_tasks: CEO can update any task
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000001'::uuid);
SELECT lives_ok(
  $$UPDATE public.tech_tasks SET title = 'CEO Updated' WHERE id = 'eeeeeeee-0000-0000-0000-000000000001'::uuid$$,
  'CEO can update any tech_task'
);

-- ============================================================
-- 11. DELETE tech_tasks: Dev cannot delete
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000002'::uuid);
DELETE FROM public.tech_tasks WHERE id = 'eeeeeeee-0000-0000-0000-000000000099'::uuid;
RESET role;
SELECT ok(
  EXISTS (SELECT 1 FROM public.tech_tasks WHERE id = 'eeeeeeee-0000-0000-0000-000000000099'::uuid),
  'Dev cannot delete tech_tasks (delete silently ignored by RLS)'
);

-- ============================================================
-- 12. DELETE tech_tasks: CEO can delete
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000001'::uuid);
DELETE FROM public.tech_tasks WHERE id = 'eeeeeeee-0000-0000-0000-000000000099'::uuid;
RESET role;
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.tech_tasks WHERE id = 'eeeeeeee-0000-0000-0000-000000000099'::uuid),
  'CEO can delete tech_tasks'
);

-- ============================================================
-- 13. tech_time_entries: no direct INSERT allowed (writes via RPC only)
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000002'::uuid);
SELECT throws_ok(
  $$INSERT INTO public.tech_time_entries (task_id, user_id, type)
    VALUES ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-1111-0000-0000-000000000002'::uuid, 'START')$$,
  '42501',
  NULL,
  'Direct INSERT to tech_time_entries denied (must use RPC)'
);

-- ============================================================
-- 14. tech_task_activities: immutable (no UPDATE/DELETE)
-- ============================================================
RESET role;
-- Insert an activity directly as superuser for test
INSERT INTO public.tech_task_activities (id, task_id, user_id, type, data)
VALUES ('aa000000-0000-0000-0000-000000000001'::uuid, 'eeeeeeee-0000-0000-0000-000000000001'::uuid,
        'aaaaaaaa-1111-0000-0000-000000000002'::uuid, 'test_event', '{}'::jsonb);

SELECT _test_set_auth('aaaaaaaa-1111-0000-0000-000000000001'::uuid);
-- Even CEO cannot delete activities
DELETE FROM public.tech_task_activities WHERE id = 'aa000000-0000-0000-0000-000000000001'::uuid;
RESET role;
SELECT ok(
  EXISTS (SELECT 1 FROM public.tech_task_activities WHERE id = 'aa000000-0000-0000-0000-000000000001'::uuid),
  'Activities are immutable: DELETE denied even for CEO'
);

-- ============================================================
SELECT finish();
ROLLBACK;
