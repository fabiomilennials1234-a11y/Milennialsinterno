-- supabase/tests/rpc/delete_info_bank_file_test.sql
-- pgTAP tests for delete_info_bank_file RPC and updated DELETE RLS policy.
--
-- Covers: owner delete, admin delete, non-owner rejected,
--         auth guard, file_path returned, row actually removed,
--         updated RLS policy allows owner delete.

BEGIN;

SELECT plan(8);

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
-- Seed: test users — GP (admin), design (non-admin), CEO (admin)
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('cc000001-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'del-gp@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cc000001-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'del-design@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cc000001-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'del-ceo@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('cc000001-0000-0000-0000-000000000001'::uuid, 'DEL GP', 'del-gp@test.local'),
  ('cc000001-0000-0000-0000-000000000002'::uuid, 'DEL Design', 'del-design@test.local'),
  ('cc000001-0000-0000-0000-000000000003'::uuid, 'DEL CEO', 'del-ceo@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('cc000001-0000-0000-0000-000000000001'::uuid, 'gestor_projetos'),
  ('cc000001-0000-0000-0000-000000000002'::uuid, 'design'),
  ('cc000001-0000-0000-0000-000000000003'::uuid, 'ceo')
ON CONFLICT (user_id, role) DO NOTHING;

-- Client
INSERT INTO public.clients (id, name, cnpj, assigned_mktplace)
VALUES ('cc000003-0000-0000-0000-000000000001'::uuid, 'DEL Test Client', '00000000000300', 'cc000001-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Info bank record
SELECT _test_set_auth('cc000001-0000-0000-0000-000000000001'::uuid);

SELECT public.upsert_client_info_bank(
  p_client_id := 'cc000003-0000-0000-0000-000000000001'::uuid,
  p_brand_colors := '#DEL'
);

-- Seed files: one uploaded by design user, one by GP
-- File 1: uploaded by design user
SELECT _test_set_auth('cc000001-0000-0000-0000-000000000002'::uuid);
SELECT public.upload_info_bank_file(
  p_client_id    := 'cc000003-0000-0000-0000-000000000001'::uuid,
  p_section      := 'anuncios'::info_bank_file_section,
  p_file_name    := 'design-file.png',
  p_file_path    := 'cc000003/anuncios/design-file.png',
  p_file_size    := 1024,
  p_content_type := 'image/png'
);

-- File 2: uploaded by GP (admin)
SELECT _test_set_auth('cc000001-0000-0000-0000-000000000001'::uuid);
SELECT public.upload_info_bank_file(
  p_client_id    := 'cc000003-0000-0000-0000-000000000001'::uuid,
  p_section      := 'criativos'::info_bank_file_section,
  p_file_name    := 'gp-file.pdf',
  p_file_path    := 'cc000003/criativos/gp-file.pdf',
  p_file_size    := 2048,
  p_content_type := 'application/pdf'
);

-- File 3: another design file (for admin-delete test)
SELECT _test_set_auth('cc000001-0000-0000-0000-000000000002'::uuid);
SELECT public.upload_info_bank_file(
  p_client_id    := 'cc000003-0000-0000-0000-000000000001'::uuid,
  p_section      := 'marca'::info_bank_file_section,
  p_file_name    := 'admin-will-delete.png',
  p_file_path    := 'cc000003/marca/admin-will-delete.png',
  p_file_size    := 512,
  p_content_type := 'image/png'
);

-- ============================================================
-- 1. Auth guard: no auth context raises error
-- ============================================================
SELECT _test_clear_auth();

SELECT throws_ok(
  format(
    $$SELECT public.delete_info_bank_file(p_file_id := %L::uuid)$$,
    (SELECT id FROM public.client_info_bank_files WHERE file_name = 'design-file.png' LIMIT 1)
  ),
  '28000',
  NULL,
  'No auth context raises authentication required'
);

-- ============================================================
-- 2. Non-owner non-admin cannot delete (design trying to delete GP file)
-- ============================================================
SELECT _test_set_auth('cc000001-0000-0000-0000-000000000002'::uuid);

SELECT throws_ok(
  format(
    $$SELECT public.delete_info_bank_file(p_file_id := %L::uuid)$$,
    (SELECT id FROM public.client_info_bank_files WHERE file_name = 'gp-file.pdf' LIMIT 1)
  ),
  '42501',
  NULL,
  'Non-owner non-admin cannot delete file'
);

-- ============================================================
-- 3. Owner can delete own file — returns file_path
-- ============================================================
SELECT _test_set_auth('cc000001-0000-0000-0000-000000000002'::uuid);

SELECT is(
  public.delete_info_bank_file(
    p_file_id := (SELECT id FROM public.client_info_bank_files WHERE file_name = 'design-file.png' LIMIT 1)
  ),
  'cc000003/anuncios/design-file.png',
  'Owner delete returns file_path'
);

-- ============================================================
-- 4. Row actually removed after owner delete
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.client_info_bank_files WHERE file_name = 'design-file.png'),
  0,
  'Row removed from table after owner delete'
);

-- ============================================================
-- 5. Admin (CEO) can delete another users file
-- ============================================================
SELECT _test_set_auth('cc000001-0000-0000-0000-000000000003'::uuid);

SELECT is(
  public.delete_info_bank_file(
    p_file_id := (SELECT id FROM public.client_info_bank_files WHERE file_name = 'admin-will-delete.png' LIMIT 1)
  ),
  'cc000003/marca/admin-will-delete.png',
  'Admin (CEO) can delete another users file'
);

-- ============================================================
-- 6. Row removed after admin delete
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM public.client_info_bank_files WHERE file_name = 'admin-will-delete.png'),
  0,
  'Row removed from table after admin delete'
);

-- ============================================================
-- 7. Nonexistent file_id raises error
-- ============================================================
SELECT _test_set_auth('cc000001-0000-0000-0000-000000000001'::uuid);

SELECT throws_ok(
  $$SELECT public.delete_info_bank_file(p_file_id := 'deadbeef-0000-0000-0000-000000000000'::uuid)$$,
  'P0001',
  NULL,
  'Nonexistent file_id raises not found'
);

-- ============================================================
-- 8. Updated DELETE RLS policy allows owner (not just admin)
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'client_info_bank_files'
     AND policyname = 'delete_cib_files_owner_or_admin'
     AND cmd = 'DELETE'),
  1,
  'DELETE policy updated to allow owner or admin'
);

-- ============================================================
SELECT * FROM finish();
ROLLBACK;
