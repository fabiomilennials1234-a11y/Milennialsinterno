-- supabase/tests/profiles_mtech_access_guard_test.sql
-- Validates the canonical flag-toggle path: public.set_mtech_access()
-- enforces admin-role check at the RPC body, succeeds for admins, raises
-- 42501 for non-admins, and can_see_tech() reflects the flag.

BEGIN;

SELECT plan(4);

INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'ceo-access@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeeeeeee-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'design-access@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeeeeeee-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'gp-access@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('eeeeeeee-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'rh-access@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'CEO Access', 'ceo-access@test.local'),
  ('eeeeeeee-0000-0000-0000-000000000002'::uuid, 'Design Access', 'design-access@test.local'),
  ('eeeeeeee-0000-0000-0000-000000000003'::uuid, 'GP Access', 'gp-access@test.local'),
  ('eeeeeeee-0000-0000-0000-000000000004'::uuid, 'RH Access', 'rh-access@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001'::uuid, 'ceo'),
  ('eeeeeeee-0000-0000-0000-000000000002'::uuid, 'design'),
  ('eeeeeeee-0000-0000-0000-000000000003'::uuid, 'gestor_projetos'),
  ('eeeeeeee-0000-0000-0000-000000000004'::uuid, 'rh')
ON CONFLICT (user_id, role) DO NOTHING;

-- Test 1: gestor_projetos succeeds via the RPC (admin path)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-000000000003', true);

SELECT lives_ok(
  $$ SELECT public.set_mtech_access(
       'eeeeeeee-0000-0000-0000-000000000002'::uuid,
       true
     ) $$,
  'gestor_projetos grants mtech access via RPC'
);

-- Test 2: rh is rejected at the RPC body
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-000000000004', true);

SELECT throws_ok(
  $$ SELECT public.set_mtech_access(
       'eeeeeeee-0000-0000-0000-000000000002'::uuid,
       false
     ) $$,
  '42501',
  'Only admin roles may change can_access_mtech',
  'rh role blocked by set_mtech_access'
);

-- Test 3: can_see_tech reflects the flag for a non-tech role
RESET ROLE;
SELECT ok(
  public.can_see_tech('eeeeeeee-0000-0000-0000-000000000002'::uuid),
  'can_see_tech returns true for design user with can_access_mtech=true'
);

-- Test 4: can_see_tech is false for an unflagged non-tech role
SELECT ok(
  NOT public.can_see_tech('eeeeeeee-0000-0000-0000-000000000004'::uuid),
  'can_see_tech returns false for rh user with can_access_mtech=false'
);

SELECT * FROM finish();

ROLLBACK;
