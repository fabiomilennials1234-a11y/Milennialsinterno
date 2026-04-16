-- supabase/tests/tech_rpcs_test.sql
-- pgTAP tests for Milennials Tech RPCs.
-- Tests: timer lifecycle, auto-pause, status promotion, review/approve/reject,
--        block/unblock, sprint lifecycle, authorization.
--
-- NOTE: We do NOT switch to the 'authenticated' role because pgTAP functions
-- live in the extensions schema, inaccessible to 'authenticated'. Instead we
-- set request.jwt.claims so auth.uid() returns the desired user_id. All RPCs
-- are SECURITY DEFINER and gate on auth.uid() + user_roles lookups, so this
-- tests the actual authorization logic.

BEGIN;

SELECT plan(21);

-- ============================================================
-- Helper: set auth.uid() without switching role
-- ============================================================
CREATE OR REPLACE FUNCTION _test_set_auth(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _user_id, 'role', 'authenticated')::text, true);
END;
$$;

-- ============================================================
-- Seed
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'test-ceo@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'test-dev@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'test-outsider@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Test CEO', 'test-ceo@test.local'),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'Test Dev', 'test-dev@test.local'),
  ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'Test Outsider', 'test-outsider@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'ceo'),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'devs'),
  ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'sucesso_cliente')
ON CONFLICT (user_id, role) DO NOTHING;

-- Seed sprint
INSERT INTO public.tech_sprints (id, name, start_date, end_date, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'Sprint 1', now(), now() + interval '14 days', 'PLANNING');

-- Seed tasks
INSERT INTO public.tech_tasks (id, title, type, status, priority, sprint_id, assignee_id, created_by)
VALUES
  ('cccccccc-0000-0000-0000-000000000001'::uuid, 'Task A', 'FEATURE', 'BACKLOG', 'HIGH',
   'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid),
  ('cccccccc-0000-0000-0000-000000000002'::uuid, 'Task B', 'BUG', 'TODO', 'MEDIUM',
   'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
   'aaaaaaaa-0000-0000-0000-000000000001'::uuid);

-- ============================================================
-- 1. tech_timer_is_active: false by default
-- ============================================================
SELECT ok(
  NOT public.tech_timer_is_active('cccccccc-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  'Timer inactive by default'
);

-- ============================================================
-- 2-3. tech_start_timer: promotes BACKLOG → IN_PROGRESS + activates timer
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-0000-0000-0000-000000000002'::uuid);
SELECT public.tech_start_timer('cccccccc-0000-0000-0000-000000000001'::uuid);

SELECT is(
  (SELECT status FROM public.tech_tasks WHERE id = 'cccccccc-0000-0000-0000-000000000001'::uuid),
  'IN_PROGRESS'::public.tech_task_status,
  'start_timer promotes BACKLOG → IN_PROGRESS'
);

SELECT ok(
  public.tech_timer_is_active('cccccccc-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  'Timer active after start'
);

-- ============================================================
-- 4-5. tech_start_timer: auto-pauses other active timers
-- ============================================================
SELECT public.tech_start_timer('cccccccc-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT public.tech_timer_is_active('cccccccc-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  'Starting timer on Task B auto-pauses Task A timer'
);

SELECT ok(
  public.tech_timer_is_active('cccccccc-0000-0000-0000-000000000002'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  'Task B timer is now active'
);

-- ============================================================
-- 6-7. tech_pause_timer / tech_resume_timer
-- ============================================================
SELECT public.tech_pause_timer('cccccccc-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT public.tech_timer_is_active('cccccccc-0000-0000-0000-000000000002'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  'Timer inactive after pause'
);

SELECT public.tech_resume_timer('cccccccc-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  public.tech_timer_is_active('cccccccc-0000-0000-0000-000000000002'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  'Timer active after resume'
);

-- ============================================================
-- 8. tech_stop_timer
-- ============================================================
SELECT public.tech_stop_timer('cccccccc-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT public.tech_timer_is_active('cccccccc-0000-0000-0000-000000000002'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  'Timer inactive after stop'
);

-- ============================================================
-- 9-10. tech_send_to_review: stops timer + sets REVIEW
-- ============================================================
SELECT public.tech_start_timer('cccccccc-0000-0000-0000-000000000001'::uuid);
SELECT public.tech_send_to_review('cccccccc-0000-0000-0000-000000000001'::uuid);

SELECT is(
  (SELECT status FROM public.tech_tasks WHERE id = 'cccccccc-0000-0000-0000-000000000001'::uuid),
  'REVIEW'::public.tech_task_status,
  'send_to_review sets status to REVIEW'
);

SELECT ok(
  NOT public.tech_timer_is_active('cccccccc-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid),
  'send_to_review stops active timer'
);

-- ============================================================
-- 11-12. tech_approve_task: requires executive
-- ============================================================

-- Dev cannot approve
SELECT _test_set_auth('aaaaaaaa-0000-0000-0000-000000000002'::uuid);
SELECT throws_ok(
  $$SELECT public.tech_approve_task('cccccccc-0000-0000-0000-000000000001'::uuid)$$,
  'Forbidden',
  'Dev cannot approve tasks'
);

-- CEO can approve
SELECT _test_set_auth('aaaaaaaa-0000-0000-0000-000000000001'::uuid);
SELECT public.tech_approve_task('cccccccc-0000-0000-0000-000000000001'::uuid);

SELECT is(
  (SELECT status FROM public.tech_tasks WHERE id = 'cccccccc-0000-0000-0000-000000000001'::uuid),
  'DONE'::public.tech_task_status,
  'CEO approve sets status to DONE'
);

-- ============================================================
-- 13. tech_reject_task: requires executive + sets IN_PROGRESS
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-0000-0000-0000-000000000002'::uuid);
SELECT public.tech_send_to_review('cccccccc-0000-0000-0000-000000000002'::uuid);

SELECT _test_set_auth('aaaaaaaa-0000-0000-0000-000000000001'::uuid);
SELECT public.tech_reject_task('cccccccc-0000-0000-0000-000000000002'::uuid);

SELECT is(
  (SELECT status FROM public.tech_tasks WHERE id = 'cccccccc-0000-0000-0000-000000000002'::uuid),
  'IN_PROGRESS'::public.tech_task_status,
  'Reject sends task back to IN_PROGRESS'
);

-- ============================================================
-- 14-15. tech_block_task / tech_unblock_task
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-0000-0000-0000-000000000002'::uuid);
SELECT public.tech_block_task('cccccccc-0000-0000-0000-000000000002'::uuid, 'Waiting on API key');

SELECT ok(
  (SELECT is_blocked FROM public.tech_tasks WHERE id = 'cccccccc-0000-0000-0000-000000000002'::uuid),
  'block_task sets is_blocked = true'
);

SELECT public.tech_unblock_task('cccccccc-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT (SELECT is_blocked FROM public.tech_tasks WHERE id = 'cccccccc-0000-0000-0000-000000000002'::uuid),
  'unblock_task clears is_blocked'
);

-- ============================================================
-- 16-17. tech_start_sprint: PLANNING → ACTIVE, promotes BACKLOG → TODO
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-0000-0000-0000-000000000001'::uuid);
UPDATE public.tech_tasks SET status = 'BACKLOG' WHERE id = 'cccccccc-0000-0000-0000-000000000002'::uuid;

SELECT public.tech_start_sprint('bbbbbbbb-0000-0000-0000-000000000001'::uuid);

SELECT is(
  (SELECT status FROM public.tech_sprints WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'::uuid),
  'ACTIVE'::public.tech_sprint_status,
  'start_sprint sets sprint to ACTIVE'
);

SELECT is(
  (SELECT status FROM public.tech_tasks WHERE id = 'cccccccc-0000-0000-0000-000000000002'::uuid),
  'TODO'::public.tech_task_status,
  'start_sprint promotes BACKLOG tasks to TODO'
);

-- ============================================================
-- 18. tech_start_sprint: second active sprint blocked
-- ============================================================
INSERT INTO public.tech_sprints (id, name, start_date, end_date, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'Sprint 2', now() + interval '15 days', now() + interval '29 days', 'PLANNING');

SELECT throws_ok(
  $$SELECT public.tech_start_sprint('bbbbbbbb-0000-0000-0000-000000000002'::uuid)$$,
  'Another sprint is already ACTIVE',
  'Cannot start a second sprint while one is ACTIVE'
);

-- ============================================================
-- 19-20. tech_end_sprint: ACTIVE → COMPLETED, undone tasks → BACKLOG
-- ============================================================
SELECT public.tech_end_sprint('bbbbbbbb-0000-0000-0000-000000000001'::uuid);

SELECT is(
  (SELECT status FROM public.tech_sprints WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001'::uuid),
  'COMPLETED'::public.tech_sprint_status,
  'end_sprint sets sprint to COMPLETED'
);

SELECT is(
  (SELECT status FROM public.tech_tasks WHERE id = 'cccccccc-0000-0000-0000-000000000002'::uuid),
  'BACKLOG'::public.tech_task_status,
  'end_sprint returns undone tasks to BACKLOG'
);

-- ============================================================
-- 21. Authorization: outsider cannot start timer
-- ============================================================
SELECT _test_set_auth('aaaaaaaa-0000-0000-0000-000000000003'::uuid);
SELECT throws_ok(
  $$SELECT public.tech_start_timer('cccccccc-0000-0000-0000-000000000002'::uuid)$$,
  'Forbidden',
  'Outsider role cannot use tech RPCs'
);

-- ============================================================
SELECT finish();
ROLLBACK;
