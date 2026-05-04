BEGIN;
SELECT plan(10);

-- Setup: users
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('dd000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'dg-ceo@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('dd000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'dg-gestor1@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('dd000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'dg-gestor2@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('dd000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'dg-outsider@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email) VALUES
  ('dd000000-0000-0000-0000-000000000001', 'DG CEO', 'dg-ceo@test.local'),
  ('dd000000-0000-0000-0000-000000000002', 'DG Gestor1', 'dg-gestor1@test.local'),
  ('dd000000-0000-0000-0000-000000000003', 'DG Gestor2', 'dg-gestor2@test.local'),
  ('dd000000-0000-0000-0000-000000000004', 'DG Outsider', 'dg-outsider@test.local')
ON CONFLICT (user_id) DO NOTHING;

DELETE FROM public.user_roles WHERE user_id IN (
  'dd000000-0000-0000-0000-000000000001',
  'dd000000-0000-0000-0000-000000000002',
  'dd000000-0000-0000-0000-000000000003',
  'dd000000-0000-0000-0000-000000000004'
);
INSERT INTO public.user_roles (user_id, role) VALUES
  ('dd000000-0000-0000-0000-000000000001', 'ceo'),
  ('dd000000-0000-0000-0000-000000000002', 'gestor_ads'),
  ('dd000000-0000-0000-0000-000000000003', 'gestor_ads'),
  ('dd000000-0000-0000-0000-000000000004', 'gestor_ads');

-- Setup: client
INSERT INTO public.clients (id, name, assigned_ads_manager) VALUES
  ('dd110000-0000-0000-0000-000000000001', 'DG Test Client', 'dd000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Setup: secondary manager record
INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by) VALUES
  ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000003', 'onboarding', 'dd000000-0000-0000-0000-000000000001');

-- Test 1: admin can SELECT
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
SELECT is((SELECT count(*)::int FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001'), 1, 'admin can see secondary manager record');

-- Test 2: secondary manager can SELECT own record
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000003')::text, true);
SELECT is((SELECT count(*)::int FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001'), 1, 'secondary manager can see own record');

-- Test 3: outsider cannot SELECT
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000004')::text, true);
SELECT is((SELECT count(*)::int FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001'), 0, 'outsider cannot see secondary manager record');

-- Test 4: admin can INSERT
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
DELETE FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001';
SELECT lives_ok($$ INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by) VALUES ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000003', 'acompanhamento', 'dd000000-0000-0000-0000-000000000001') $$, 'admin can insert secondary manager');

-- Test 5: non-admin cannot INSERT
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000003')::text, true);
SELECT throws_ok($$ INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by) VALUES ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000004', 'onboarding', 'dd000000-0000-0000-0000-000000000003') $$, NULL, NULL, 'non-admin cannot insert secondary manager');

-- Test 6: admin can UPDATE
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
SELECT lives_ok($$ UPDATE public.client_secondary_managers SET phase = 'onboarding' WHERE client_id = 'dd110000-0000-0000-0000-000000000001' $$, 'admin can update phase');

-- Test 7: non-admin cannot UPDATE
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000003')::text, true);
SELECT throws_ok($$ UPDATE public.client_secondary_managers SET phase = 'acompanhamento' WHERE client_id = 'dd110000-0000-0000-0000-000000000001' $$, NULL, NULL, 'non-admin cannot update secondary manager');

-- Test 8: admin can DELETE
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
SELECT lives_ok($$ DELETE FROM public.client_secondary_managers WHERE client_id = 'dd110000-0000-0000-0000-000000000001' $$, 'admin can delete secondary manager');

-- Test 9: UNIQUE constraint prevents 2 secondary managers per client
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000001')::text, true);
INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by) VALUES ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000003', 'onboarding', 'dd000000-0000-0000-0000-000000000001');
SELECT throws_ok($$ INSERT INTO public.client_secondary_managers (client_id, secondary_manager_id, phase, created_by) VALUES ('dd110000-0000-0000-0000-000000000001', 'dd000000-0000-0000-0000-000000000004', 'onboarding', 'dd000000-0000-0000-0000-000000000001') $$, '23505', NULL, 'UNIQUE constraint prevents 2 secondary managers per client');

-- Test 10: secondary manager can SELECT client via secondary_manager_can_view policy
SELECT set_config('request.jwt.claims', json_build_object('sub', 'dd000000-0000-0000-0000-000000000003')::text, true);
SELECT is((SELECT count(*)::int FROM public.clients WHERE id = 'dd110000-0000-0000-0000-000000000001'), 1, 'secondary manager can SELECT client via secondary_manager_can_view policy');

SELECT * FROM finish();
ROLLBACK;
