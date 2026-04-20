-- supabase/tests/is_ceo_cto_test.sql
-- pgTAP regression test for the CTO inclusion fix in is_ceo().
--
-- Guards against: migration 20260416130000_is_ceo_includes_cto.sql being reverted
-- or a future migration narrowing is_ceo() back to role='ceo' only, which would
-- silently break RLS visibility for every CTO user (see session 2026-04-16 incident).

BEGIN;

SELECT plan(9);

-- ============================================================
-- Seed: one user per relevant role class
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('bbbbbbbb-2222-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'ceo-test@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('bbbbbbbb-2222-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'cto-test@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('bbbbbbbb-2222-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'gp-test@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('bbbbbbbb-2222-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'design-test@test.local', crypt('test', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('bbbbbbbb-2222-0000-0000-000000000001'::uuid, 'CEO Test', 'ceo-test@test.local'),
  ('bbbbbbbb-2222-0000-0000-000000000002'::uuid, 'CTO Test', 'cto-test@test.local'),
  ('bbbbbbbb-2222-0000-0000-000000000003'::uuid, 'GP Test', 'gp-test@test.local'),
  ('bbbbbbbb-2222-0000-0000-000000000004'::uuid, 'Design Test', 'design-test@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('bbbbbbbb-2222-0000-0000-000000000001'::uuid, 'ceo'),
  ('bbbbbbbb-2222-0000-0000-000000000002'::uuid, 'cto'),
  ('bbbbbbbb-2222-0000-0000-000000000003'::uuid, 'gestor_projetos'),
  ('bbbbbbbb-2222-0000-0000-000000000004'::uuid, 'design')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- Tests: is_ceo() — after fix, must return true for ceo AND cto
-- ============================================================
SELECT ok(
  public.is_ceo('bbbbbbbb-2222-0000-0000-000000000001'::uuid),
  'is_ceo(ceo user) returns true'
);

SELECT ok(
  public.is_ceo('bbbbbbbb-2222-0000-0000-000000000002'::uuid),
  'is_ceo(cto user) returns true — guards against regression of 20260416130000'
);

SELECT ok(
  NOT public.is_ceo('bbbbbbbb-2222-0000-0000-000000000003'::uuid),
  'is_ceo(gestor_projetos) returns false'
);

SELECT ok(
  NOT public.is_ceo('bbbbbbbb-2222-0000-0000-000000000004'::uuid),
  'is_ceo(design) returns false'
);

-- ============================================================
-- Tests: is_executive() — same semantics as is_ceo post-fix
-- ============================================================
SELECT ok(
  public.is_executive('bbbbbbbb-2222-0000-0000-000000000001'::uuid),
  'is_executive(ceo) returns true'
);

SELECT ok(
  public.is_executive('bbbbbbbb-2222-0000-0000-000000000002'::uuid),
  'is_executive(cto) returns true'
);

SELECT ok(
  NOT public.is_executive('bbbbbbbb-2222-0000-0000-000000000004'::uuid),
  'is_executive(design) returns false'
);

-- ============================================================
-- Tests: is_admin() — ceo + cto + gestor_projetos
-- ============================================================
SELECT ok(
  public.is_admin('bbbbbbbb-2222-0000-0000-000000000002'::uuid),
  'is_admin(cto) returns true'
);

SELECT ok(
  public.is_admin('bbbbbbbb-2222-0000-0000-000000000003'::uuid),
  'is_admin(gestor_projetos) returns true'
);

SELECT * FROM finish();

ROLLBACK;
