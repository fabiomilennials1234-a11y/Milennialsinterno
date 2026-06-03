-- supabase/tests/rpc/upsert_client_info_bank_test.sql
-- pgTAP tests for client_info_bank table, upsert RPC, RLS, and data migration.
--
-- Covers: insert, upsert, updated_by tracking, RLS read/delete.
--
-- Slice 3 (#79): public.upsert_client_info_bank agora DELEGA a
-- cliente.editar_card_universal — a escrita passou a ser GATEADA por
-- cliente.pode_ver_cliente (mesmo predicado da leitura, ADR 0005). Consequências
-- nos contratos abaixo (atualizados vs. o mundo de escrita aberta da Slice 0):
--   * o escritor precisa SER AUTORIZADO (envolvido/admin/GP-grupo/page-grant);
--     o seed agradece o GP como ENVOLVIDO do cliente.
--   * caller sem autorização → 42501 (era escrita livre);
--   * sem auth (auth.uid() NULL) → 42501 (não-autorizado), não mais 28000;
--   * cliente inexistente, caller NÃO-admin → 42501 (gate ANTES de existência:
--     não vaza existência a quem não pode ver). Admin nesse caso → P0002.
-- As semânticas PRESERVADAS pela delegação (COALESCE, created_by imutável,
-- updated_by = caller) continuam cobertas e devem permanecer verdes.

BEGIN;

SELECT plan(15);

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
-- Seed: 3 users (gp, design, ceo-admin) + 1 client
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('bb000001-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'cib-gp@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('bb000001-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'cib-design@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('bb000001-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'cib-ceo@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('bb000001-0000-0000-0000-000000000001'::uuid, 'CIB GP', 'cib-gp@test.local'),
  ('bb000001-0000-0000-0000-000000000002'::uuid, 'CIB Design', 'cib-design@test.local'),
  ('bb000001-0000-0000-0000-000000000003'::uuid, 'CIB CEO', 'cib-ceo@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('bb000001-0000-0000-0000-000000000001'::uuid, 'gestor_projetos'),
  ('bb000001-0000-0000-0000-000000000002'::uuid, 'design'),
  ('bb000001-0000-0000-0000-000000000003'::uuid, 'ceo')
ON CONFLICT (user_id, role) DO NOTHING;

-- Client for testing
INSERT INTO public.clients (id, name, cnpj, assigned_mktplace)
VALUES ('bb000002-0000-0000-0000-000000000001'::uuid, 'CIB Test Client', '00000000000100', 'bb000001-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Slice 3 (#79): a escrita é gateada por cliente.pode_ver_cliente. GP e Designer
-- escrevem como ENVOLVIDOS do cliente (caminho C). O CEO já passa por bypass (A).
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
VALUES
  ('bb000002-0000-0000-0000-000000000001'::uuid, 'bb000001-0000-0000-0000-000000000001'::uuid, 'gp'),
  ('bb000002-0000-0000-0000-000000000001'::uuid, 'bb000001-0000-0000-0000-000000000002'::uuid, 'designer')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 1. RPC insert: GP creates new info bank for client
-- ============================================================
SELECT _test_set_auth('bb000001-0000-0000-0000-000000000001'::uuid);

SELECT isnt(
  public.upsert_client_info_bank(
    p_client_id := 'bb000002-0000-0000-0000-000000000001'::uuid,
    p_brand_colors := '#FF0000, #00FF00',
    p_website_url := 'https://example.com',
    p_editing_style := 'cinematic',
    p_cms_platform := 'wordpress',
    p_notes := 'Test notes'
  ),
  NULL::uuid,
  'upsert_client_info_bank returns non-null uuid on insert'
);

SELECT is(
  (SELECT brand_colors FROM public.client_info_bank
   WHERE client_id = 'bb000002-0000-0000-0000-000000000001'::uuid),
  '#FF0000, #00FF00',
  'Insert stores brand_colors correctly'
);

SELECT is(
  (SELECT created_by FROM public.client_info_bank
   WHERE client_id = 'bb000002-0000-0000-0000-000000000001'::uuid),
  'bb000001-0000-0000-0000-000000000001'::uuid,
  'Insert sets created_by to caller'
);

SELECT is(
  (SELECT updated_by FROM public.client_info_bank
   WHERE client_id = 'bb000002-0000-0000-0000-000000000001'::uuid),
  'bb000001-0000-0000-0000-000000000001'::uuid,
  'Insert sets updated_by to caller'
);

-- ============================================================
-- 2. RPC upsert: Designer updates existing, COALESCE preserves
-- ============================================================
SELECT _test_set_auth('bb000001-0000-0000-0000-000000000002'::uuid);

SELECT public.upsert_client_info_bank(
  p_client_id := 'bb000002-0000-0000-0000-000000000001'::uuid,
  p_brand_colors := '#UPDATED',
  p_typography := 'Inter'
  -- website_url NOT passed → should be preserved via COALESCE
);

SELECT is(
  (SELECT brand_colors FROM public.client_info_bank
   WHERE client_id = 'bb000002-0000-0000-0000-000000000001'::uuid),
  '#UPDATED',
  'Upsert overwrites brand_colors with new value'
);

SELECT is(
  (SELECT website_url FROM public.client_info_bank
   WHERE client_id = 'bb000002-0000-0000-0000-000000000001'::uuid),
  'https://example.com',
  'Upsert preserves website_url via COALESCE when not passed'
);

SELECT is(
  (SELECT typography FROM public.client_info_bank
   WHERE client_id = 'bb000002-0000-0000-0000-000000000001'::uuid),
  'Inter',
  'Upsert sets new typography field'
);

-- ============================================================
-- 3. updated_by changes on upsert to new caller
-- ============================================================
SELECT is(
  (SELECT updated_by FROM public.client_info_bank
   WHERE client_id = 'bb000002-0000-0000-0000-000000000001'::uuid),
  'bb000001-0000-0000-0000-000000000002'::uuid,
  'Upsert changes updated_by to new caller (designer)'
);

-- created_by should NOT change
SELECT is(
  (SELECT created_by FROM public.client_info_bank
   WHERE client_id = 'bb000002-0000-0000-0000-000000000001'::uuid),
  'bb000001-0000-0000-0000-000000000001'::uuid,
  'Upsert does NOT change created_by (still GP)'
);

-- ============================================================
-- 4. Authz guard (Slice 3): no auth context → 42501 (não-autorizado).
--    A delegação aplica cliente.pode_ver_cliente; auth.uid() NULL não vê
--    nenhum cliente → escrita negada (era 28000 no contrato de escrita aberta).
-- ============================================================
SELECT _test_clear_auth();

SELECT throws_ok(
  $$SELECT public.upsert_client_info_bank(
    p_client_id := 'bb000002-0000-0000-0000-000000000001'::uuid,
    p_brand_colors := 'should fail'
  )$$,
  '42501',
  NULL,
  'No auth context → 42501 (escrita gateada por pode_ver_cliente)'
);

-- 4b. Authz guard: caller autenticado mas NÃO-autorizado (não-envolvido, sem
--     bypass, sem grant) → 42501. Prova o fechamento do furo de escrita aberta.
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES ('bb000001-0000-0000-0000-0000000000ff'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
        'cib-stranger@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (user_id, name, email)
VALUES ('bb000001-0000-0000-0000-0000000000ff'::uuid, 'CIB Stranger', 'cib-stranger@test.local')
ON CONFLICT (user_id) DO NOTHING;

SELECT _test_set_auth('bb000001-0000-0000-0000-0000000000ff'::uuid);

SELECT throws_ok(
  $$SELECT public.upsert_client_info_bank(
    p_client_id := 'bb000002-0000-0000-0000-000000000001'::uuid,
    p_brand_colors := 'should fail'
  )$$,
  '42501',
  NULL,
  'Caller não-autorizado → 42501 (furo de escrita aberta fechado)'
);

-- ============================================================
-- 5. Client guard: cliente inexistente, caller ADMIN → P0002.
--    Admin passa o gate (bypass A); então o gate de existência dispara P0002.
--    (Caller não-admin nesse caso receberia 42501 — gate antes de existência —
--     para não vazar existência; coberto pelo contrato do kernel #79.)
-- ============================================================
SELECT _test_set_auth('bb000001-0000-0000-0000-000000000003'::uuid);

SELECT throws_ok(
  $$SELECT public.upsert_client_info_bank(
    p_client_id := 'deadbeef-0000-0000-0000-000000000000'::uuid,
    p_brand_colors := 'should fail'
  )$$,
  'P0002',
  NULL,
  'Cliente inexistente (caller admin) → P0002 (gate de existência)'
);

-- ============================================================
-- 6. RLS: authenticated can SELECT (verified by reading our row)
-- ============================================================
SELECT _test_set_auth('bb000001-0000-0000-0000-000000000002'::uuid);

SELECT is(
  (SELECT count(*)::int FROM public.client_info_bank
   WHERE client_id = 'bb000002-0000-0000-0000-000000000001'::uuid),
  1,
  'Authenticated user can SELECT from client_info_bank'
);

-- ============================================================
-- 7-8. RLS: DELETE policy uses is_admin
-- ============================================================
-- Instead of switching roles (unreliable in remote pgTAP), verify
-- the DELETE policy references is_admin by inspecting pg_policies.
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'client_info_bank'
     AND policyname = 'delete_client_info_bank_admin'
     AND cmd = 'DELETE'
     AND qual::text LIKE '%is_admin%'),
  1,
  'DELETE policy exists and uses is_admin guard'
);

-- Verify non-admin roles have no DELETE policy granting access
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'client_info_bank'
     AND cmd = 'DELETE'
     AND qual::text NOT LIKE '%is_admin%'),
  0,
  'No DELETE policy exists without is_admin — non-admins blocked'
);

-- ============================================================
SELECT * FROM finish();
ROLLBACK;
