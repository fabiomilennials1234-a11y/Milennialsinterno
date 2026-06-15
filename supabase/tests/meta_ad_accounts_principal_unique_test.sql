-- pgTAP regression test for the single-principal invariant on meta_ad_accounts.
--
-- Guards: migration 20260615130000_meta_ad_accounts_multi_account.sql and its
-- partial unique index uq_meta_ad_accounts_principal. The multi-account feature
-- relies on EXACTLY ONE is_principal=true row (the UI's default account). If the
-- index is dropped or made non-partial, two principals could coexist (UI default
-- becomes nondeterministic) OR every non-principal row would collide (inserts of
-- the ~40 client accounts would all fail). Both are silent regressions.
--
-- Invariants asserted:
--   1. The partial unique index exists.
--   2. Two is_principal=true rows are rejected (23505).
--   3. Many is_principal=false rows coexist freely (partial predicate works).
--   4. sync_policy CHECK rejects values outside {cron, on_demand}.

BEGIN;

SELECT plan(4);

-- ============================================================
-- 1. The partial unique index exists with the expected predicate.
-- ============================================================
SELECT is(
  (SELECT count(*)::int
   FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename = 'meta_ad_accounts'
     AND indexname = 'uq_meta_ad_accounts_principal'),
  1,
  'partial unique index uq_meta_ad_accounts_principal exists'
);

-- Fixture: a principal account (mirrors the migrated Milennials row in a clean
-- transaction — we insert our own to avoid coupling to prod data).
INSERT INTO public.meta_ad_accounts (account_id, account_name, sync_policy, is_principal)
VALUES ('act_test_principal', 'Test Principal', 'cron', true);

-- ============================================================
-- 2. A SECOND principal must be rejected (unique violation 23505).
-- ============================================================
SELECT throws_ok(
  $$ INSERT INTO public.meta_ad_accounts (account_id, account_name, sync_policy, is_principal)
     VALUES ('act_test_principal_2', 'Second Principal', 'cron', true) $$,
  '23505',
  NULL,
  'second is_principal=true row is rejected by the partial unique index'
);

-- ============================================================
-- 3. Many non-principal rows coexist (the partial predicate excludes them).
-- ============================================================
INSERT INTO public.meta_ad_accounts (account_id, account_name, sync_policy, is_principal) VALUES
  ('act_test_client_1', 'Client 1', 'on_demand', false),
  ('act_test_client_2', 'Client 2', 'on_demand', false),
  ('act_test_client_3', 'Client 3', 'on_demand', false);

SELECT is(
  (SELECT count(*)::int FROM public.meta_ad_accounts
   WHERE account_id LIKE 'act_test_client_%' AND is_principal = false),
  3,
  'multiple is_principal=false rows coexist (partial index does not collide them)'
);

-- ============================================================
-- 4. sync_policy CHECK rejects unknown values.
-- ============================================================
SELECT throws_ok(
  $$ INSERT INTO public.meta_ad_accounts (account_id, account_name, sync_policy)
     VALUES ('act_test_bad_policy', 'Bad Policy', 'hourly') $$,
  '23514',
  NULL,
  'sync_policy outside {cron, on_demand} is rejected by CHECK constraint'
);

SELECT * FROM finish();

ROLLBACK;
