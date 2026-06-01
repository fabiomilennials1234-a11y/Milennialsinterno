-- supabase/tests/clients_status_allowlist_test.sql
-- pgTAP regression test for the clients.status allowlist CHECK constraint.
--
-- Guards against: migration 20260601183544_deprecate_campaign_published_status.sql
-- being reverted or the constraint dropped. The constraint exists to make the
-- legacy 'campaign_published' status (and any value outside the canonical
-- lifecycle in src/lib/clientStatus.ts) impossible to write — it caused the
-- Ágape limbo where clients vanished from the ads board. If the constraint
-- disappears, the limbo can silently return.
--
-- Allowlist: active | onboarding | new_client | churned. NULL is permitted
-- (nullable column; onboarding triggers treat NULL as new_client).

BEGIN;

SELECT plan(9);

-- ============================================================
-- Fixture: one client per allowlist value to prove existing rows stay valid.
-- ============================================================
INSERT INTO public.clients (id, name, status) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Fixture Active',     'active'),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'Fixture Onboarding', 'onboarding'),
  ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'Fixture NewClient',  'new_client'),
  ('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'Fixture Churned',    'churned'),
  ('aaaaaaaa-0000-0000-0000-000000000005'::uuid, 'Fixture Null',       NULL);

-- ============================================================
-- Rejection: campaign_published must fail on INSERT and UPDATE (SQLSTATE 23514)
-- ============================================================
SELECT throws_ok(
  $$ INSERT INTO public.clients (id, name, status)
     VALUES ('aaaaaaaa-0000-0000-0000-0000000000ff'::uuid, 'Limbo', 'campaign_published') $$,
  '23514',
  NULL,
  'INSERT of campaign_published is rejected with SQLSTATE 23514 (check_violation)'
);

SELECT throws_ok(
  $$ UPDATE public.clients SET status = 'campaign_published'
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid $$,
  '23514',
  NULL,
  'UPDATE to campaign_published is rejected with SQLSTATE 23514 (check_violation)'
);

-- Arbitrary off-allowlist value is rejected too (constraint is an allowlist, not a denylist)
SELECT throws_ok(
  $$ UPDATE public.clients SET status = 'paused'
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid $$,
  '23514',
  NULL,
  'UPDATE to an arbitrary off-allowlist value is rejected'
);

-- ============================================================
-- Acceptance: every allowlist value + NULL passes on UPDATE
-- ============================================================
SELECT lives_ok(
  $$ UPDATE public.clients SET status = 'active'
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004'::uuid $$,
  'UPDATE to active is accepted'
);
SELECT lives_ok(
  $$ UPDATE public.clients SET status = 'onboarding'
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004'::uuid $$,
  'UPDATE to onboarding is accepted'
);
SELECT lives_ok(
  $$ UPDATE public.clients SET status = 'new_client'
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004'::uuid $$,
  'UPDATE to new_client is accepted'
);
SELECT lives_ok(
  $$ UPDATE public.clients SET status = 'churned'
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004'::uuid $$,
  'UPDATE to churned is accepted'
);
SELECT lives_ok(
  $$ UPDATE public.clients SET status = NULL
     WHERE id = 'aaaaaaaa-0000-0000-0000-000000000004'::uuid $$,
  'UPDATE to NULL is accepted (nullable column)'
);

-- ============================================================
-- Existing rows: all 5 seeded fixtures satisfy the constraint
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.clients
   WHERE id IN (
     'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
     'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
     'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
     'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
     'aaaaaaaa-0000-0000-0000-000000000005'::uuid
   )),
  5,
  'all 5 allowlist/NULL fixtures persisted and remain valid'
);

SELECT * FROM finish();

ROLLBACK;
