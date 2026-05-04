-- supabase/tests/justifications_scope_test.sql
BEGIN;
SELECT plan(7);

-- Setup: seed users com diferentes roles e grupos
DO $$
DECLARE
  v_group_a uuid := gen_random_uuid();
  v_group_b uuid := gen_random_uuid();
  v_ceo uuid := gen_random_uuid();
  v_gp uuid := gen_random_uuid();
  v_ads_a uuid := gen_random_uuid();
  v_sc_a uuid := gen_random_uuid();
  v_ads_b uuid := gen_random_uuid();
  v_design uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.organization_groups (id, name, slug) VALUES
    (v_group_a, 'Group A', 'group-a'),
    (v_group_b, 'Group B', 'group-b');

  INSERT INTO auth.users (id, email) VALUES
    (v_ceo, 'ceo@x.com'),
    (v_gp, 'gp@x.com'),
    (v_ads_a, 'adsa@x.com'),
    (v_sc_a, 'sca@x.com'),
    (v_ads_b, 'adsb@x.com'),
    (v_design, 'design@x.com');

  INSERT INTO public.profiles (user_id, name, group_id) VALUES
    (v_ceo, 'CEO', NULL),
    (v_gp, 'GP', NULL),
    (v_ads_a, 'AdsA', v_group_a),
    (v_sc_a, 'ScA', v_group_a),
    (v_ads_b, 'AdsB', v_group_b),
    (v_design, 'Design', v_group_a);

  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_ceo, 'ceo'),
    (v_gp, 'gestor_projetos'),
    (v_ads_a, 'gestor_ads'),
    (v_sc_a, 'sucesso_cliente'),
    (v_ads_b, 'gestor_ads'),
    (v_design, 'design');

  PERFORM set_config('request.jwt.claim.sub', v_ceo::text, true);
  PERFORM ok((SELECT count(*) FROM public.get_team_users_in_scope()) >= 6, 'CEO sees all users');

  PERFORM set_config('request.jwt.claim.sub', v_gp::text, true);
  PERFORM ok((SELECT count(*) FROM public.get_team_users_in_scope()) >= 6, 'gestor_projetos sees all users');

  PERFORM set_config('request.jwt.claim.sub', v_ads_a::text, true);
  PERFORM ok(EXISTS (SELECT 1 FROM public.get_team_users_in_scope() s WHERE s.user_id = v_sc_a), 'gestor_ads vê sucesso_cliente do mesmo grupo');
  PERFORM ok(NOT EXISTS (SELECT 1 FROM public.get_team_users_in_scope() s WHERE s.user_id = v_ads_b), 'gestor_ads NÃO vê ads_b de outro grupo');
  PERFORM ok(NOT EXISTS (SELECT 1 FROM public.get_team_users_in_scope() s WHERE s.user_id = v_design), 'gestor_ads NÃO vê design (role fora do escopo)');

  PERFORM set_config('request.jwt.claim.sub', v_sc_a::text, true);
  PERFORM ok(EXISTS (SELECT 1 FROM public.get_team_users_in_scope() s WHERE s.user_id = v_ads_a), 'sucesso_cliente vê gestor_ads do mesmo grupo');

  PERFORM set_config('request.jwt.claim.sub', v_design::text, true);
  PERFORM ok((SELECT count(*) FROM public.get_team_users_in_scope()) = 0, 'design (sem escopo) vê 0 users');
END $$;

SELECT * FROM finish();
ROLLBACK;
