-- supabase/tests/rpc/upload_info_bank_file_test.sql
-- pgTAP tests for client_info_bank_files table, upload RPC, RLS, and bucket.
--
-- Covers: RPC insert + return uuid, auth guard, info_bank guard,
--         RLS read/insert/delete, enum type, bucket existence.

BEGIN;

SELECT plan(17);

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

CREATE OR REPLACE FUNCTION _test_clear_auth()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
END;
$$;

-- ============================================================
-- Seed: reuse same test users from upsert_client_info_bank_test
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('bb000001-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'cibf-gp@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('bb000001-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'cibf-design@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('bb000001-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'cibf-ceo@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('bb000001-0000-0000-0000-000000000001'::uuid, 'CIBF GP', 'cibf-gp@test.local'),
  ('bb000001-0000-0000-0000-000000000002'::uuid, 'CIBF Design', 'cibf-design@test.local'),
  ('bb000001-0000-0000-0000-000000000003'::uuid, 'CIBF CEO', 'cibf-ceo@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('bb000001-0000-0000-0000-000000000001'::uuid, 'gestor_projetos'),
  ('bb000001-0000-0000-0000-000000000002'::uuid, 'design'),
  ('bb000001-0000-0000-0000-000000000003'::uuid, 'ceo')
ON CONFLICT (user_id, role) DO NOTHING;

-- Client
INSERT INTO public.clients (id, name, cnpj, assigned_mktplace)
VALUES ('bb000003-0000-0000-0000-000000000001'::uuid, 'CIBF Test Client', '00000000000200', 'bb000001-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Info bank record (required for RPC)
SELECT _test_set_auth('bb000001-0000-0000-0000-000000000001'::uuid);

SELECT public.upsert_client_info_bank(
  p_client_id := 'bb000003-0000-0000-0000-000000000001'::uuid,
  p_brand_colors := '#TEST'
);

-- ============================================================
-- 1. RPC insert: returns non-null uuid
-- ============================================================
SELECT isnt(
  public.upload_info_bank_file(
    p_client_id    := 'bb000003-0000-0000-0000-000000000001'::uuid,
    p_section      := 'anuncios'::info_bank_file_section,
    p_file_name    := 'test-ad.png',
    p_file_path    := 'bb000003-0000-0000-0000-000000000001/anuncios/abc123.png',
    p_file_size    := 1024,
    p_content_type := 'image/png'
  ),
  NULL::uuid,
  'upload_info_bank_file returns non-null uuid on insert'
);

-- ============================================================
-- 2. Metadata row exists with correct fields
-- ============================================================
SELECT is(
  (SELECT file_name FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
   LIMIT 1),
  'test-ad.png',
  'Inserted row has correct file_name'
);

-- ============================================================
-- 3. uploaded_by set to caller
-- ============================================================
SELECT is(
  (SELECT uploaded_by FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
   LIMIT 1),
  'bb000001-0000-0000-0000-000000000001'::uuid,
  'uploaded_by set to calling user'
);

-- ============================================================
-- 4. Different section works (criativos)
-- ============================================================
SELECT isnt(
  public.upload_info_bank_file(
    p_client_id    := 'bb000003-0000-0000-0000-000000000001'::uuid,
    p_section      := 'criativos'::info_bank_file_section,
    p_file_name    := 'creative.pdf',
    p_file_path    := 'bb000003-0000-0000-0000-000000000001/criativos/def456.pdf',
    p_file_size    := 2048,
    p_content_type := 'application/pdf'
  ),
  NULL::uuid,
  'upload_info_bank_file works for criativos section'
);

-- ============================================================
-- 5. Auth guard: no auth context → error
-- ============================================================
SELECT _test_clear_auth();

SELECT throws_ok(
  $$SELECT public.upload_info_bank_file(
    p_client_id    := 'bb000003-0000-0000-0000-000000000001'::uuid,
    p_section      := 'marca'::info_bank_file_section,
    p_file_name    := 'should-fail.png',
    p_file_path    := 'test/fail.png',
    p_file_size    := 100,
    p_content_type := 'image/png'
  )$$,
  '28000',
  NULL,
  'No auth context raises authentication required'
);

-- ============================================================
-- 6. Info bank guard: nonexistent client → error
-- ============================================================
SELECT _test_set_auth('bb000001-0000-0000-0000-000000000001'::uuid);

SELECT throws_ok(
  $$SELECT public.upload_info_bank_file(
    p_client_id    := 'deadbeef-0000-0000-0000-000000000000'::uuid,
    p_section      := 'videos'::info_bank_file_section,
    p_file_name    := 'should-fail.mp4',
    p_file_path    := 'test/fail.mp4',
    p_file_size    := 100,
    p_content_type := 'video/mp4'
  )$$,
  'P0001',
  NULL,
  'Nonexistent client raises client_info_bank not found'
);

-- ============================================================
-- 7. RLS: authenticated can SELECT
-- ============================================================
SELECT _test_set_auth('bb000001-0000-0000-0000-000000000002'::uuid);

SELECT is(
  (SELECT count(*)::int FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid),
  2,
  'Authenticated user (design) can SELECT files'
);

-- ============================================================
-- 8. DELETE policy exists and uses is_admin
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'client_info_bank_files'
     AND cmd = 'DELETE'
     AND qual::text LIKE '%is_admin%'),
  1,
  'DELETE policy exists and uses is_admin guard'
);

-- ============================================================
-- 9. No DELETE policy without is_admin
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'client_info_bank_files'
     AND cmd = 'DELETE'
     AND qual::text NOT LIKE '%is_admin%'),
  0,
  'No DELETE policy exists without is_admin'
);

-- ============================================================
-- 10. Bucket exists and is private
-- ============================================================
SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'client-info-bank-files'),
  false,
  'Bucket client-info-bank-files exists and is private'
);

-- ============================================================
-- VERSION CHAIN TESTS (Issue #46)
-- ============================================================

-- Restore auth for version chain tests
SELECT _test_set_auth('bb000001-0000-0000-0000-000000000001'::uuid);

-- ============================================================
-- 11. Upload same file name → second gets version=2
-- ============================================================
-- First upload already happened in test 1 (test-ad.png, anuncios, version=1)
-- Upload same name again:
SELECT public.upload_info_bank_file(
  p_client_id    := 'bb000003-0000-0000-0000-000000000001'::uuid,
  p_section      := 'anuncios'::info_bank_file_section,
  p_file_name    := 'test-ad.png',
  p_file_path    := 'bb000003-0000-0000-0000-000000000001/anuncios/second.png',
  p_file_size    := 2048,
  p_content_type := 'image/png'
);

SELECT is(
  (SELECT version FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
     AND file_name = 'test-ad.png'
     AND replaced_by IS NULL),
  2,
  'Second upload of same file name has version=2'
);

-- ============================================================
-- 12. First version now has replaced_by pointing to v2
-- ============================================================
SELECT is(
  (SELECT replaced_by FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
     AND file_name = 'test-ad.png'
     AND version = 1),
  (SELECT id FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
     AND file_name = 'test-ad.png'
     AND version = 2),
  'v1 replaced_by points to v2 id'
);

-- ============================================================
-- 13. Third upload → version=3, full chain v1→v2→v3
-- ============================================================
SELECT public.upload_info_bank_file(
  p_client_id    := 'bb000003-0000-0000-0000-000000000001'::uuid,
  p_section      := 'anuncios'::info_bank_file_section,
  p_file_name    := 'test-ad.png',
  p_file_path    := 'bb000003-0000-0000-0000-000000000001/anuncios/third.png',
  p_file_size    := 4096,
  p_content_type := 'image/png'
);

SELECT is(
  (SELECT version FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
     AND file_name = 'test-ad.png'
     AND replaced_by IS NULL),
  3,
  'Third upload has version=3'
);

-- ============================================================
-- 14. v2 now has replaced_by pointing to v3
-- ============================================================
SELECT is(
  (SELECT replaced_by FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
     AND file_name = 'test-ad.png'
     AND version = 2),
  (SELECT id FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
     AND file_name = 'test-ad.png'
     AND version = 3),
  'v2 replaced_by points to v3 id'
);

-- ============================================================
-- 15. v3 (latest) has replaced_by IS NULL
-- ============================================================
SELECT is(
  (SELECT replaced_by FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
     AND file_name = 'test-ad.png'
     AND version = 3),
  NULL::uuid,
  'v3 (latest) has replaced_by IS NULL'
);

-- ============================================================
-- 16. Different file name → version=1, no chain
-- ============================================================
SELECT public.upload_info_bank_file(
  p_client_id    := 'bb000003-0000-0000-0000-000000000001'::uuid,
  p_section      := 'anuncios'::info_bank_file_section,
  p_file_name    := 'totally-different.jpg',
  p_file_path    := 'bb000003-0000-0000-0000-000000000001/anuncios/diff.jpg',
  p_file_size    := 512,
  p_content_type := 'image/jpeg'
);

SELECT is(
  (SELECT version FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND section = 'anuncios'
     AND file_name = 'totally-different.jpg'),
  1,
  'Different file name gets version=1'
);

-- ============================================================
-- 17. Grid query (replaced_by IS NULL) returns only latest versions
-- ============================================================
-- We have: test-ad.png (v1,v2,v3), creative.pdf (v1), totally-different.jpg (v1)
-- Only v3 of test-ad.png + creative.pdf + totally-different.jpg should show = 3
SELECT is(
  (SELECT count(*)::int FROM public.client_info_bank_files
   WHERE client_id = 'bb000003-0000-0000-0000-000000000001'::uuid
     AND replaced_by IS NULL),
  3,
  'Grid query (replaced_by IS NULL) shows only latest versions'
);

-- ============================================================
SELECT * FROM finish();
ROLLBACK;
