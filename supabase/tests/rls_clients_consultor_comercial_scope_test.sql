-- supabase/tests/rls_clients_consultor_comercial_scope_test.sql
--
-- pgTAP regression test para fix do leak em clients (RLS consultor_comercial).
-- Guarda contra:
--   - Reintroducao de policy SELECT sem filtro `assigned_comercial = auth.uid()`
--     para consultor_comercial (leak cross-consultor).
--   - Regressao em Admin/CEO que os impeca de ver todos os clients.
--
-- Migration guardada:
--   - 20260423160000_fix_clients_rls_scope_consultor_comercial.sql
--
-- UUID prefix: 'cccccccc' (kanban usa 'aaaaaaaa', is_ceo_cto usa 'bbbbbbbb',
-- tech_rls usa 'aaaaaaaa' em outro namespace). Evita colisao entre testes.

BEGIN;

SELECT plan(8);

-- ============================================================
-- 0. Pre-condicao: nao existe policy SELECT em clients para consultor_comercial
-- sem filtro por assigned_comercial
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'clients'
       AND policyname = 'Consultor Comercial can view all clients'),
  0,
  'legacy unscoped policy "Consultor Comercial can view all clients" does NOT exist (leak guard)'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'clients'
       AND policyname = 'Consultor Comercial can view assigned clients'
       AND qual LIKE '%assigned_comercial%'),
  1,
  'scoped policy "Consultor Comercial can view assigned clients" exists and filters by assigned_comercial'
);

-- ============================================================
-- Seed: 2 consultores (A, B), 1 CEO, 3 clients (X assigned A, Y assigned B,
-- Z sem assigned).
-- ============================================================

INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('cccccccc-1111-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rls-ceo-clients@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-1111-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rls-consultor-a@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-1111-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rls-consultor-b@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('cccccccc-1111-0000-0000-000000000001'::uuid, 'RLS CEO Clients', 'rls-ceo-clients@test.local'),
  ('cccccccc-1111-0000-0000-000000000002'::uuid, 'RLS Consultor A', 'rls-consultor-a@test.local'),
  ('cccccccc-1111-0000-0000-000000000003'::uuid, 'RLS Consultor B', 'rls-consultor-b@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('cccccccc-1111-0000-0000-000000000001'::uuid, 'ceo'),
  ('cccccccc-1111-0000-0000-000000000002'::uuid, 'consultor_comercial'),
  ('cccccccc-1111-0000-0000-000000000003'::uuid, 'consultor_comercial')
ON CONFLICT (user_id, role) DO NOTHING;

-- Clients como superuser (bypassa RLS no seed).
-- `name` e o unico NOT NULL obrigatorio sem default; assigned_comercial e
-- o campo que define o escopo.
INSERT INTO public.clients (id, name, assigned_comercial, created_by)
VALUES
  ('cccccccc-2222-0000-0000-000000000001'::uuid, 'Client X (A)',
   'cccccccc-1111-0000-0000-000000000002'::uuid,
   'cccccccc-1111-0000-0000-000000000001'::uuid),
  ('cccccccc-2222-0000-0000-000000000002'::uuid, 'Client Y (B)',
   'cccccccc-1111-0000-0000-000000000003'::uuid,
   'cccccccc-1111-0000-0000-000000000001'::uuid),
  ('cccccccc-2222-0000-0000-000000000003'::uuid, 'Client Z (none)',
   NULL,
   'cccccccc-1111-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Helper: impersonate user sem trocar de role Postgres.
-- Padrao de tech_rls_test.sql / user_page_grants_test.sql.
CREATE OR REPLACE FUNCTION _test_set_auth_clients(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _user_id, 'role', 'authenticated')::text, true);
END;
$$;

-- ============================================================
-- 1. Consultor A: SELECT retorna APENAS Client X (assigned A)
-- ============================================================
SELECT _test_set_auth_clients('cccccccc-1111-0000-0000-000000000002'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT array_agg(id ORDER BY id)::uuid[] FROM public.clients
     WHERE id IN (
       'cccccccc-2222-0000-0000-000000000001'::uuid,
       'cccccccc-2222-0000-0000-000000000002'::uuid,
       'cccccccc-2222-0000-0000-000000000003'::uuid
     )),
  ARRAY['cccccccc-2222-0000-0000-000000000001'::uuid]::uuid[],
  'Consultor A sees only Client X (assigned to A)'
);

-- ============================================================
-- 2. Consultor A: UPDATE em Client Y (nao-assigned) afeta 0 rows (RLS bloqueia)
-- Nota: consultor_comercial nao tem policy UPDATE dedicada, entao UPDATE retorna
-- 0 rows em qualquer client. Esse caso cobre especificamente que o RLS nao abre
-- brecha via SELECT leak.
-- ============================================================
WITH upd AS (
  UPDATE public.clients
     SET name = 'Hacked by A'
     WHERE id = 'cccccccc-2222-0000-0000-000000000002'::uuid
     RETURNING 1
)
SELECT is((SELECT count(*)::int FROM upd), 0,
  'Consultor A UPDATE on non-assigned Client Y affects 0 rows (RLS blocks)');

-- Confirma tambem que o nome nao mudou (via re-leitura como CEO depois).
RESET ROLE;

-- ============================================================
-- 3. Consultor B: SELECT retorna APENAS Client Y (assigned B)
-- ============================================================
SELECT _test_set_auth_clients('cccccccc-1111-0000-0000-000000000003'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT array_agg(id ORDER BY id)::uuid[] FROM public.clients
     WHERE id IN (
       'cccccccc-2222-0000-0000-000000000001'::uuid,
       'cccccccc-2222-0000-0000-000000000002'::uuid,
       'cccccccc-2222-0000-0000-000000000003'::uuid
     )),
  ARRAY['cccccccc-2222-0000-0000-000000000002'::uuid]::uuid[],
  'Consultor B sees only Client Y (assigned to B)'
);

RESET ROLE;

-- ============================================================
-- 4. CEO (admin): SELECT retorna X, Y e Z
-- ============================================================
SELECT _test_set_auth_clients('cccccccc-1111-0000-0000-000000000001'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT array_agg(id ORDER BY id)::uuid[] FROM public.clients
     WHERE id IN (
       'cccccccc-2222-0000-0000-000000000001'::uuid,
       'cccccccc-2222-0000-0000-000000000002'::uuid,
       'cccccccc-2222-0000-0000-000000000003'::uuid
     )),
  ARRAY[
    'cccccccc-2222-0000-0000-000000000001'::uuid,
    'cccccccc-2222-0000-0000-000000000002'::uuid,
    'cccccccc-2222-0000-0000-000000000003'::uuid
  ]::uuid[],
  'CEO sees all clients (X, Y, Z) via admin policy'
);

-- Confirma que o UPDATE do Consultor A nao passou: Client Y.name intacto.
SELECT is(
  (SELECT name FROM public.clients WHERE id = 'cccccccc-2222-0000-0000-000000000002'::uuid),
  'Client Y (B)',
  'Client Y name unchanged (Consultor A UPDATE attempt was blocked)'
);

RESET ROLE;

-- ============================================================
-- 5. Consultor A nao consegue ver Client Z (orfao sem assigned_comercial)
-- ============================================================
SELECT _test_set_auth_clients('cccccccc-1111-0000-0000-000000000002'::uuid);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.clients
     WHERE id = 'cccccccc-2222-0000-0000-000000000003'::uuid),
  0,
  'Consultor A does NOT see orphan Client Z (no assigned_comercial)'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
