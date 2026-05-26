-- supabase/tests/rpc/growth_advance_info_bank_gate_test.sql
-- pgTAP tests for the client_info_bank gate in growth_advance_gp_step.
--
-- The V2 transition realizar_call_1 → escolher_equipe must be BLOCKED
-- when no client_info_bank record exists for the client. Other transitions
-- must NOT be affected.

BEGIN;

SELECT plan(3);

-- ============================================================
-- Helper: set auth.uid()
-- ============================================================
CREATE OR REPLACE FUNCTION _test_set_auth(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _user_id, 'role', 'authenticated')::text, true);
END;
$$;

-- ============================================================
-- Seed: GP user + V2 client at realizar_call_1
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('cc000001-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'gate-gp@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES ('cc000001-0000-0000-0000-000000000001'::uuid, 'Gate GP', 'gate-gp@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('cc000001-0000-0000-0000-000000000001'::uuid, 'gestor_projetos')
ON CONFLICT (user_id, role) DO NOTHING;

-- Client at V2 realizar_call_1
INSERT INTO public.clients (id, name, cnpj, assigned_mktplace, growth_gp_step, growth_flow_version)
VALUES ('cc000002-0000-0000-0000-000000000001'::uuid, 'Gate Test Client', '99999999000199', 'cc000001-0000-0000-0000-000000000001', 'realizar_call_1', 2)
ON CONFLICT (id) DO NOTHING;

-- Ensure NO client_info_bank record exists for this client
DELETE FROM public.client_info_bank WHERE client_id = 'cc000002-0000-0000-0000-000000000001'::uuid;

-- ============================================================
-- 1. Gate blocks: realizar_call_1 → escolher_equipe WITHOUT info bank
-- ============================================================
SELECT _test_set_auth('cc000001-0000-0000-0000-000000000001'::uuid);

SELECT throws_ok(
  $$SELECT public.growth_advance_gp_step(
    'cc000002-0000-0000-0000-000000000001'::uuid,
    'escolher_equipe'
  )$$,
  'P0002',
  NULL,
  'V2 realizar_call_1 → escolher_equipe blocked without client_info_bank record'
);

-- ============================================================
-- 2. Gate passes: realizar_call_1 → escolher_equipe WITH info bank
-- ============================================================

-- Insert info bank record
INSERT INTO public.client_info_bank (client_id, brand_colors, created_by, updated_by)
VALUES ('cc000002-0000-0000-0000-000000000001'::uuid, '#TEST', 'cc000001-0000-0000-0000-000000000001'::uuid, 'cc000001-0000-0000-0000-000000000001'::uuid);

-- Reset client step back to realizar_call_1 (in case prior test changed it)
UPDATE public.clients SET growth_gp_step = 'realizar_call_1' WHERE id = 'cc000002-0000-0000-0000-000000000001'::uuid;

SELECT lives_ok(
  $$SELECT public.growth_advance_gp_step(
    'cc000002-0000-0000-0000-000000000001'::uuid,
    'escolher_equipe'
  )$$,
  'V2 realizar_call_1 → escolher_equipe succeeds with client_info_bank record'
);

-- ============================================================
-- 3. Other V2 transitions NOT affected by the gate
-- ============================================================

-- Set up a different client at novos_clientes
INSERT INTO public.clients (id, name, cnpj, assigned_mktplace, growth_gp_step, growth_flow_version)
VALUES ('cc000002-0000-0000-0000-000000000002'::uuid, 'Gate Test Client 2', '99999999000288', 'cc000001-0000-0000-0000-000000000001', 'novos_clientes', 2)
ON CONFLICT (id) DO UPDATE SET growth_gp_step = 'novos_clientes';

-- No info bank for this client — novos → realizar_call_1 should still work
SELECT lives_ok(
  $$SELECT public.growth_advance_gp_step(
    'cc000002-0000-0000-0000-000000000002'::uuid,
    'realizar_call_1'
  )$$,
  'V2 novos_clientes → realizar_call_1 NOT affected by info bank gate'
);

-- ============================================================
SELECT * FROM finish();
ROLLBACK;
