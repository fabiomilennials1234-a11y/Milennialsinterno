-- supabase/tests/tech_billing_hours_test.sql
-- pgTAP for SLICE #164 — billing hours (period-clipped, project + client grain).
-- Covers tech_billing_hours(p_start, p_end):
--   • no-arg totals replay the unclipped tech_task_time_totals contract exactly
--     (closed START/STOP intervals, summed per task, rolled to the project);
--   • the window clips each interval — START before the window counts only from
--     the window start; an interval that spans the window on both sides counts
--     the window length; a window after all activity yields 0 seconds / 0 issues;
--   • a project with NULL client_id is KEPT (client_id/name NULL), not dropped;
--   • two projects under the same client both surface with that client_id so the
--     client rollup is a client-side group of these rows;
--   • non-staff are blocked (42501).
--
-- Mirrors tech_team_throughput_test.sql: set request.jwt.claims rather than
-- switching role, so auth.uid() resolves while the RPC runs its own auth gate.
-- All intervals are CLOSED (START+STOP at fixed timestamps) so now() never enters
-- the math and every assertion is deterministic. BEGIN/ROLLBACK — never touches
-- committed state. Every assertion scopes to our seeded project ids so any real
-- billing data already on the remote can never warp the result.

BEGIN;

SELECT plan(10);

CREATE OR REPLACE FUNCTION _bh_set_auth(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _user_id, 'role', 'authenticated')::text, true);
END;
$$;

-- ============================================================
-- Seed users / roles
--   01 CEO      — staff caller.
--   09 outsider — non-staff, used for the 42501 assertion.
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'bh-ceo@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('bbbbbbbb-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'bh-outsider@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'BH CEO', 'bh-ceo@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000009'::uuid, 'BH Outsider', 'bh-outsider@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'ceo'),
  ('bbbbbbbb-0000-0000-0000-000000000009'::uuid, 'sucesso_cliente')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- Seed client + projects.
--   Client CX.
--   P1 -> CX.   (one task T1)
--   P2 -> NULL. (one task T3 — internal/unattributed work, must NOT drop)
--   P3 -> CX.   (one task T2 — second project under the same client)
-- ============================================================
INSERT INTO public.clients (id, name)
VALUES ('caaaaaaa-0000-0000-0000-00000000000c'::uuid, 'BH Client CX')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tech_projects (id, name, type, created_by, client_id)
VALUES
  ('40000000-0000-0000-0000-000000000001'::uuid, 'BH Project P1', 'internal',
   'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'caaaaaaa-0000-0000-0000-00000000000c'::uuid),
  ('40000000-0000-0000-0000-000000000002'::uuid, 'BH Project P2', 'internal',
   'bbbbbbbb-0000-0000-0000-000000000001'::uuid, NULL),
  ('40000000-0000-0000-0000-000000000003'::uuid, 'BH Project P3', 'internal',
   'bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'caaaaaaa-0000-0000-0000-00000000000c'::uuid);

-- ============================================================
-- Seed tasks.
--   T1 (P1): START 10:00 STOP 11:30  -> 5400s closed.
--   T3 (P2): START 10:00 STOP 10:30  -> 1800s closed (NULL-client project).
--   T2 (P3): START 09:00 STOP 11:00  -> 7200s closed (clip target, isolated in P3).
-- ============================================================
INSERT INTO public.tech_tasks (id, title, type, status, priority, project_id, created_by)
VALUES
  ('70000000-0000-0000-0000-000000000001'::uuid, 'BH T1', 'FEATURE', 'DONE', 'MEDIUM',
   '40000000-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid),
  ('70000000-0000-0000-0000-000000000003'::uuid, 'BH T3', 'FEATURE', 'DONE', 'MEDIUM',
   '40000000-0000-0000-0000-000000000002'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid),
  ('70000000-0000-0000-0000-000000000002'::uuid, 'BH T2', 'FEATURE', 'DONE', 'MEDIUM',
   '40000000-0000-0000-0000-000000000003'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid);

-- ============================================================
-- Seed time entries — fixed timestamps, all closed pairs.
-- seq is GENERATED ALWAYS (identity); we omit it. Insertion order matches the
-- created_at order within each task, so the LEAD pairing is unambiguous.
-- ============================================================
INSERT INTO public.tech_time_entries (task_id, user_id, type, created_at)
VALUES
  -- T1: 10:00 -> 11:30 = 5400s
  ('70000000-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
   'START', '2026-03-10 10:00:00+00'),
  ('70000000-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
   'STOP',  '2026-03-10 11:30:00+00'),
  -- T3: 10:00 -> 10:30 = 1800s
  ('70000000-0000-0000-0000-000000000003'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
   'START', '2026-03-10 10:00:00+00'),
  ('70000000-0000-0000-0000-000000000003'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
   'STOP',  '2026-03-10 10:30:00+00'),
  -- T2: 09:00 -> 11:00 = 7200s
  ('70000000-0000-0000-0000-000000000002'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
   'START', '2026-03-10 09:00:00+00'),
  ('70000000-0000-0000-0000-000000000002'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
   'STOP',  '2026-03-10 11:00:00+00');

SELECT _bh_set_auth('bbbbbbbb-0000-0000-0000-000000000001'::uuid);

-- ============================================================
-- 1. No-arg total for P1 = 5400 (T1 closed interval), exact.
-- ============================================================
SELECT is(
  (SELECT total_seconds FROM public.tech_billing_hours(NULL, NULL)
     WHERE project_id = '40000000-0000-0000-0000-000000000001'::uuid),
  5400::bigint,
  'no-arg P1 total = 5400 (single closed START/STOP interval)'
);

-- ============================================================
-- 2. No-arg total replays the raw view: P1 RPC total == Σ tech_task_time_totals
--    for P1's tasks (dynamic parity — guards against replay drift from the view).
-- ============================================================
SELECT is(
  (SELECT total_seconds FROM public.tech_billing_hours(NULL, NULL)
     WHERE project_id = '40000000-0000-0000-0000-000000000001'::uuid),
  (SELECT COALESCE(sum(tt.total_seconds), 0)::bigint
     FROM public.tech_task_time_totals tt
    WHERE tt.task_id = '70000000-0000-0000-0000-000000000001'::uuid),
  'no-arg P1 total equals the unclipped tech_task_time_totals sum for its tasks'
);

-- ============================================================
-- 3. P3 no-arg total = 7200, issue_count = 1.
-- ============================================================
SELECT is(
  (SELECT ARRAY[total_seconds::int, issue_count] FROM public.tech_billing_hours(NULL, NULL)
     WHERE project_id = '40000000-0000-0000-0000-000000000003'::uuid),
  ARRAY[7200, 1],
  'no-arg P3 total = 7200, issue_count = 1'
);

-- ============================================================
-- 4. Clip p_start = 10:00 : T2 (09:00-11:00) counts only 10:00-11:00 = 3600.
--    START before the window must NOT over-bill the pre-window hour.
-- ============================================================
SELECT is(
  (SELECT total_seconds FROM public.tech_billing_hours('2026-03-10 10:00:00+00', NULL)
     WHERE project_id = '40000000-0000-0000-0000-000000000003'::uuid),
  3600::bigint,
  'p_start=10:00 clips T2 to the post-10:00 hour (3600), not the full 7200'
);

-- ============================================================
-- 5. Window strictly inside the interval (09:30-10:30) -> window length (3600).
--    Interval spans the window on both sides; only the overlap is billed.
-- ============================================================
SELECT is(
  (SELECT total_seconds FROM public.tech_billing_hours('2026-03-10 09:30:00+00', '2026-03-10 10:30:00+00')
     WHERE project_id = '40000000-0000-0000-0000-000000000003'::uuid),
  3600::bigint,
  'window inside the interval bills the window length (3600)'
);

-- ============================================================
-- 6. NULL-client project P2 is KEPT with client_id NULL — never dropped.
-- ============================================================
SELECT is(
  (SELECT ARRAY[(client_id IS NULL)::int, total_seconds::int] FROM public.tech_billing_hours(NULL, NULL)
     WHERE project_id = '40000000-0000-0000-0000-000000000002'::uuid),
  ARRAY[1, 1800],
  'project with NULL client_id surfaces (client_id NULL, total 1800), not dropped'
);

-- ============================================================
-- 7. client_name resolves for an attributed project (P1 -> CX).
-- ============================================================
SELECT is(
  (SELECT client_name FROM public.tech_billing_hours(NULL, NULL)
     WHERE project_id = '40000000-0000-0000-0000-000000000001'::uuid),
  'BH Client CX',
  'attributed project resolves client_name via the LEFT JOIN'
);

-- ============================================================
-- 8. Client grouping: P1 and P3 both carry the same client_id (CX) so the
--    client-side rollup groups two project rows into one client.
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.tech_billing_hours(NULL, NULL)
     WHERE client_id = 'caaaaaaa-0000-0000-0000-00000000000c'::uuid
       AND project_id IN (
         '40000000-0000-0000-0000-000000000001'::uuid,
         '40000000-0000-0000-0000-000000000003'::uuid)),
  2,
  'two projects under one client both surface with that client_id'
);

-- ============================================================
-- 9. Window after all activity -> 0 seconds AND 0 issue_count (no >0 task).
-- ============================================================
SELECT is(
  (SELECT ARRAY[total_seconds::int, issue_count] FROM public.tech_billing_hours('2026-03-10 12:00:00+00', '2026-03-10 13:00:00+00')
     WHERE project_id = '40000000-0000-0000-0000-000000000003'::uuid),
  ARRAY[0, 0],
  'window after all activity: total 0, issue_count 0 (no task with >0 clipped time)'
);

-- ============================================================
-- 10. Security: non-staff cannot read billing hours (42501).
-- ============================================================
SELECT _bh_set_auth('bbbbbbbb-0000-0000-0000-000000000009'::uuid);
SELECT throws_ok(
  $$SELECT * FROM public.tech_billing_hours(NULL, NULL)$$,
  '42501',
  NULL,
  'non-staff blocked from tech_billing_hours (42501)'
);

SELECT finish();
ROLLBACK;
