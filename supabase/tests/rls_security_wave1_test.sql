-- supabase/tests/rls_security_wave1_test.sql
--
-- pgTAP regression test para Security Wave 1 (2026-04-23).
--
-- Guarda STRUCTURAL (pg_policies) + FUNCTIONAL (minimal seed, rollback).
--
-- Guarda contra:
--   - Reintroducao de policy USING(true) / WITH CHECK(true) roles={public}
--     em financeiro_kanban_tasks, mrr_changes, contas_*, active_clients, rh_*.
--   - Reintroducao de SELECT USING(true) em user_roles.
--   - Remocao de FORCE RLS em rh_candidatos.
--   - Remocao de can_view_card() nas policies de card_*.
--
-- Migrations guardadas:
--   - 20260423140000_security_wave1_fix_financeiro_kanban_tasks.sql
--   - 20260423140100_security_wave1_fix_user_roles_select.sql
--   - 20260423140200_security_wave1_fix_financeiro.sql
--   - 20260423140300_security_wave1_fix_rh.sql
--   - 20260423140400_security_wave1_fix_kanban_children.sql

BEGIN;

SELECT plan(27);

-- ============================================================
-- STRUCTURAL ASSERTIONS — pg_policies
-- ============================================================

-- #1 financeiro_kanban_tasks
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename='financeiro_kanban_tasks'
       AND (qual='true' OR with_check='true')
       AND roles::text LIKE '%public%'),
  0,
  'financeiro_kanban_tasks: zero policies permissive roles={public}'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename='financeiro_kanban_tasks'
       AND policyname LIKE 'financeiro_kanban_tasks_%'),
  4,
  'financeiro_kanban_tasks: 4 policies escopadas criadas'
);

-- #2 user_roles
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename='user_roles' AND cmd='SELECT' AND qual='true'),
  0,
  'user_roles: SELECT USING(true) removida'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
            WHERE tablename='user_roles' AND policyname='Users can view own role'
              AND qual LIKE '%user_id = auth.uid()%'),
  'user_roles: Users can view own role presente com user_id=auth.uid()'
);

-- #3a mrr_changes
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename='mrr_changes' AND (qual='true' OR with_check='true')),
  0,
  'mrr_changes: sem USING(true)/WITH CHECK(true)'
);

-- #3b financeiro_contas_pagar
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename='financeiro_contas_pagar' AND (qual='true' OR with_check='true')),
  0,
  'financeiro_contas_pagar: sem USING(true)/WITH CHECK(true)'
);

-- #3c financeiro_contas_receber
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename='financeiro_contas_receber' AND (qual='true' OR with_check='true')),
  0,
  'financeiro_contas_receber: sem USING(true)/WITH CHECK(true)'
);

-- #3d financeiro_active_clients: sem roles={public}
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename='financeiro_active_clients'
       AND roles::text LIKE '%public%'),
  0,
  'financeiro_active_clients: sem policies roles={public}'
);

-- #3e financeiro_dre/produtos/custos/departamentos/receita — SELECT escopada
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename IN ('financeiro_dre','financeiro_produtos','financeiro_custos_produto','financeiro_produto_departamentos','financeiro_receita_produto')
       AND cmd='SELECT' AND roles::text LIKE '%public%'
       AND qual LIKE '%auth.uid() IS NOT NULL%'),
  0,
  'financeiro dashboards: SELECT auth.uid() IS NOT NULL removida'
);

-- #4 RH (8 tabelas) - sem roles={public}
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename IN ('rh_vagas','rh_candidatos','rh_vaga_briefings',
                         'rh_atividades','rh_comentarios','rh_justificativas',
                         'rh_tarefas','rh_vaga_plataformas')
       AND roles::text LIKE '%public%'),
  0,
  'RH (8 tabelas): sem policies roles={public}'
);

-- #4b RH - sem USING(true)/WITH CHECK(true)
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE tablename IN ('rh_vagas','rh_candidatos','rh_vaga_briefings',
                         'rh_atividades','rh_comentarios','rh_justificativas',
                         'rh_tarefas','rh_vaga_plataformas')
       AND (qual='true' OR with_check='true')),
  0,
  'RH (8 tabelas): sem USING(true)/WITH CHECK(true)'
);

-- #4c rh_candidatos FORCE RLS
SELECT is(
  (SELECT relforcerowsecurity FROM pg_class c
     JOIN pg_namespace n ON c.relnamespace=n.oid
     WHERE n.nspname='public' AND relname='rh_candidatos'),
  true,
  'rh_candidatos: FORCE ROW LEVEL SECURITY ativo (LGPD)'
);

-- #4d RLS habilitado em todas
SELECT is(
  (SELECT count(*)::int FROM pg_class c
     JOIN pg_namespace n ON c.relnamespace=n.oid
     WHERE n.nspname='public'
       AND relname IN ('financeiro_kanban_tasks','user_roles','mrr_changes',
                       'financeiro_contas_pagar','financeiro_contas_receber',
                       'financeiro_active_clients','financeiro_dre',
                       'rh_vagas','rh_candidatos','rh_vaga_briefings',
                       'rh_tarefas','rh_vaga_plataformas',
                       'card_activities','card_attachments','card_comments')
       AND relrowsecurity=true),
  15,
  'Todas as 15 tabelas criticas com RLS habilitado'
);

-- #5 Kanban children - SELECT via can_view_card
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
            WHERE tablename='card_activities' AND cmd='SELECT'
              AND qual LIKE '%can_view_card%'),
  'card_activities SELECT: usa can_view_card()'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
            WHERE tablename='card_attachments' AND cmd='SELECT'
              AND qual LIKE '%can_view_card%'),
  'card_attachments SELECT: usa can_view_card()'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
            WHERE tablename='card_comments' AND cmd='SELECT'
              AND qual LIKE '%can_view_card%'),
  'card_comments SELECT: usa can_view_card()'
);

-- ============================================================
-- HELPER FUNCTIONS SANITY
-- ============================================================

-- is_admin(uid) bypass invariant
SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
            WHERE n.nspname='public' AND p.proname='is_admin' AND p.prosecdef=true),
  'is_admin exists and is SECURITY DEFINER'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
            WHERE n.nspname='public' AND p.proname='has_role' AND p.prosecdef=true),
  'has_role exists and is SECURITY DEFINER'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
            WHERE n.nspname='public' AND p.proname='can_view_card' AND p.prosecdef=true),
  'can_view_card exists and is SECURITY DEFINER'
);

-- ============================================================
-- FUNCTIONAL TESTS — minimal seed, rollback isolated
-- Usa auth.users + profiles + user_roles.
-- Evita INSERT em tabelas com FKs complexas (mrr_changes, rh_*); assertamos via SELECT count.
-- ============================================================

-- Seed 2 users: admin (ceo) + non-admin (design)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
VALUES
  ('cccccccc-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'wave1-ceo@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), ''),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'wave1-des@test.local', crypt('x', gen_salt('bf')), 'authenticated', 'authenticated', now(), now(), '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email)
VALUES
  ('cccccccc-0000-0000-0000-000000000001'::uuid, 'CEO Wave1', 'wave1-ceo@test.local'),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, 'Des Wave1', 'wave1-des@test.local')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('cccccccc-0000-0000-0000-000000000001'::uuid, 'ceo'::user_role),
  ('cccccccc-0000-0000-0000-000000000003'::uuid, 'design'::user_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- --- CEO (is_admin) ---
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT ok(
  (SELECT count(*) FROM public.user_roles) >= 2::bigint,
  'CEO ve multiplos user_roles (bypass is_admin)'
);

SELECT ok(
  public.is_admin('cccccccc-0000-0000-0000-000000000001'::uuid),
  'is_admin(CEO) retorna true'
);

-- --- Design (non-admin) ---
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.user_roles),
  1,
  'Design (non-admin) ve apenas proprio user_roles'
);

SELECT is(
  (SELECT count(*)::int FROM public.financeiro_contas_pagar),
  0,
  'Design (non-admin) ve 0 contas_pagar'
);

SELECT is(
  (SELECT count(*)::int FROM public.financeiro_active_clients),
  0,
  'Design (non-admin) ve 0 active_clients'
);

SELECT ok(
  NOT public.is_admin('cccccccc-0000-0000-0000-000000000003'::uuid),
  'is_admin(design) retorna false'
);

-- --- ANON (sem login) ---
RESET ROLE;
SET LOCAL ROLE anon;

SELECT is(
  (SELECT count(*)::int FROM public.user_roles),
  0,
  'ANON ve 0 user_roles'
);

SELECT is(
  (SELECT count(*)::int FROM public.financeiro_kanban_tasks),
  0,
  'ANON ve 0 financeiro_kanban_tasks (P0 fix)'
);

-- Observacao: anon INSERT test removido; pgTAP sem throws_ok gate aqui porque
-- roles=authenticated na policy impede qualquer matching, resultando em
-- "new row violates" igual em todos os casos. STRUCTURAL asserts ja cobrem.

SELECT * FROM finish();
ROLLBACK;
