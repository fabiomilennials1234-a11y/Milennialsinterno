-- supabase/tests/modules/envolvimento/rls_clients_non_regression_test.sql
-- pgTAP — Slice 2 (#78) — GATE DE MERGE. Matriz de NÃO-REGRESSÃO da visibilidade
-- de cliente após reorientar a RLS de public.clients para delegar a e_envolvido.
--
-- O ADR 0005 decompõe a visibilidade SELECT em 4 grupos ortogonais:
--   (A) is_admin (ceo/cto/gestor_projetos)          — bypass, INTACTO
--   (B) gestor_projetos do MESMO grupo do cliente   — escopo-grupo, INTACTO
--   (C)+(C') assigned_* + secondary_managers         — involvement -> e_envolvido
--   (D) page-grant (can_access_page_data)            — bypass por função, INTACTO
--
-- Este teste prova OS DOIS LADOS (incidente RLS-silenciosa 200+vazio):
--   - quem via antes continua vendo (cada grupo A/B/C/C'/D);
--   - não-envolvido / fora-de-grupo / sem-grant continua NÃO vendo.
--
-- Depende de: tabela+predicado (migration ...130000), backfill (...130100),
-- trigger espelho (...130200), reorientação da RLS (...130300).
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/envolvimento/rls_clients_non_regression_test.sql
-- UUID prefix: 'd0000000' (não-regressão namespace).

BEGIN;

SELECT plan(13);

-- ============================================================
-- 0. Estrutura — a policy reorientada existe, delega a e_envolvido, e a policy
--    secondary legada foi removida (involvement agora é só client_members).
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE schemaname='public' AND tablename='clients'
       AND policyname='clients_select_visao_total'
       AND qual LIKE '%e_envolvido%'),
  1,
  'clients_select_visao_total existe e delega a e_envolvido');

SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE schemaname='public' AND tablename='clients'
       AND policyname='secondary_manager_can_view_client'),
  0,
  'policy secondary_manager_can_view_client foi removida (involvement em client_members)');

-- A policy reorientada PRESERVA os bypasses (A/B/D): grep de que ainda referencia
-- is_admin, gestor_projetos+group_id e can_access_page_data.
SELECT is(
  (SELECT count(*)::int FROM pg_policies
     WHERE schemaname='public' AND tablename='clients'
       AND policyname='clients_select_visao_total'
       AND qual LIKE '%is_admin%'
       AND qual LIKE '%get_user_group_id%'
       AND qual LIKE '%can_access_page_data%'),
  1,
  'policy reorientada preserva is_admin (A), escopo-grupo GP (B) e page-grant (D)');

-- ============================================================
-- Seed — usuários cobrindo cada grupo.
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u, '00000000-0000-0000-0000-000000000000'::uuid, u::text||'@nr.test',
       crypt('t', gen_salt('bf')), 'authenticated','authenticated', now(), now(), ''
FROM (VALUES
  ('d0000000-0000-0000-0000-0000000000a1'::uuid),  -- (A) ceo
  ('d0000000-0000-0000-0000-0000000000b1'::uuid),  -- (B) GP grupo G1
  ('d0000000-0000-0000-0000-0000000000c1'::uuid),  -- (C) ads_manager assigned
  ('d0000000-0000-0000-0000-0000000000c2'::uuid),  -- (C) mktplace assigned (quirk TEXT->UUID)
  ('d0000000-0000-0000-0000-0000000000c3'::uuid),  -- (C') secondary manager
  ('d0000000-0000-0000-0000-0000000000d1'::uuid),  -- (D) page-grant cliente-list
  ('d0000000-0000-0000-0000-0000000000f0'::uuid),  -- não-envolvido (gestor_ads: tem page-grant gestor-ads)
  ('d0000000-0000-0000-0000-0000000000f9'::uuid)   -- OUTSIDER LIMPO: role design, SEM page-grant a cliente
) AS t(u)
ON CONFLICT (id) DO NOTHING;

-- group G1 para o teste de escopo-grupo (B)
INSERT INTO public.organization_groups (id, name, slug)
VALUES ('d0000000-0000-0000-0000-00000000a100'::uuid, 'NR Group G1', 'nr-group-g1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, name, email, group_id)
VALUES
  ('d0000000-0000-0000-0000-0000000000a1'::uuid,'NR CEO','a1@nr.test', NULL),
  ('d0000000-0000-0000-0000-0000000000b1'::uuid,'NR GP','b1@nr.test','d0000000-0000-0000-0000-00000000a100'::uuid),
  ('d0000000-0000-0000-0000-0000000000c1'::uuid,'NR Ads','c1@nr.test', NULL),
  ('d0000000-0000-0000-0000-0000000000c2'::uuid,'NR Mkt','c2@nr.test', NULL),
  ('d0000000-0000-0000-0000-0000000000c3'::uuid,'NR Sec','c3@nr.test', NULL),
  ('d0000000-0000-0000-0000-0000000000d1'::uuid,'NR Grant','d1@nr.test', NULL),
  ('d0000000-0000-0000-0000-0000000000f0'::uuid,'NR Outsider','f0@nr.test', NULL),
  ('d0000000-0000-0000-0000-0000000000f9'::uuid,'NR CleanOutsider','f9@nr.test', NULL)
-- NB: o trigger auth.on_auth_user_created -> handle_new_user já cria um profile
-- (group_id NULL) ao inserir em auth.users. DO UPDATE garante que o group_id de
-- teste (escopo do GP, grupo B) seja aplicado mesmo sobre o profile auto-criado.
ON CONFLICT (user_id) DO UPDATE SET group_id = EXCLUDED.group_id;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('d0000000-0000-0000-0000-0000000000a1'::uuid,'ceo'),
  ('d0000000-0000-0000-0000-0000000000b1'::uuid,'gestor_projetos'),
  ('d0000000-0000-0000-0000-0000000000c1'::uuid,'gestor_ads'),
  ('d0000000-0000-0000-0000-0000000000c2'::uuid,'consultor_mktplace'),
  ('d0000000-0000-0000-0000-0000000000c3'::uuid,'gestor_ads'),
  ('d0000000-0000-0000-0000-0000000000d1'::uuid,'sucesso_cliente'),
  ('d0000000-0000-0000-0000-0000000000f0'::uuid,'gestor_ads'),
  ('d0000000-0000-0000-0000-0000000000f9'::uuid,'design')
ON CONFLICT (user_id, role) DO NOTHING;

-- page-grant direto para d1 em 'cliente-list' (caminho D). cliente-list não é
-- sensível -> has_page_access/role-fallback resolve; mas damos grant direto p/
-- robustez (sucesso_cliente já tem cliente-list por matrix, então isso é (D)).
-- Clientes:
--   CX (G1) — assigned_ads_manager=c1, assigned_mktplace=c2 (TEXT), secondary=c3
--   CY (G1) — sem assignment (só visível por A, B-grupo, D)
--   CZ (G2-diff/NULL) — sem assignment, fora do grupo do GP
INSERT INTO public.clients (id, name, group_id, assigned_ads_manager, assigned_mktplace, created_by)
VALUES
  ('d0000000-0000-0000-0000-0000000c1100'::uuid,
   'NR Client CX', 'd0000000-0000-0000-0000-00000000a100'::uuid,
   'd0000000-0000-0000-0000-0000000000c1'::uuid,
   'd0000000-0000-0000-0000-0000000000c2'::text, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clients (id, name, group_id, created_by)
VALUES
  ('d0000000-0000-0000-0000-0000000c2200'::uuid, 'NR Client CY',
   'd0000000-0000-0000-0000-00000000a100'::uuid, NULL),
  ('d0000000-0000-0000-0000-0000000c3300'::uuid, 'NR Client CZ', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- secondary manager c3 -> CX
INSERT INTO public.client_secondary_managers (id, client_id, secondary_manager_id, phase, created_by)
VALUES ('d0000000-0000-0000-0000-0000000c3399'::uuid,
        'd0000000-0000-0000-0000-0000000c1100'::uuid,
        'd0000000-0000-0000-0000-0000000000c3'::uuid, 'onboarding',
        'd0000000-0000-0000-0000-0000000000a1'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Helper de impersonação (padrão tech_rls_test.sql).
CREATE OR REPLACE FUNCTION _nr_auth(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- helper de visibilidade: o cliente X aparece para o viewer?
CREATE OR REPLACE FUNCTION _nr_sees(_client uuid) RETURNS boolean
LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.clients WHERE id = _client) $$;

-- ============================================================
-- (C) ads_manager assigned vê CX (involvement via backfill -> e_envolvido)
-- ============================================================
SELECT _nr_auth('d0000000-0000-0000-0000-0000000000c1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(_nr_sees('d0000000-0000-0000-0000-0000000c1100'::uuid), true,
  '(C) ads_manager assigned continua vendo CX após colapso');
RESET ROLE;

-- ============================================================
-- (C quirk) mktplace assigned (TEXT->UUID) vê CX
-- ============================================================
SELECT _nr_auth('d0000000-0000-0000-0000-0000000000c2'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(_nr_sees('d0000000-0000-0000-0000-0000000c1100'::uuid), true,
  '(C) mktplace assigned (TEXT->UUID normalizado) continua vendo CX');
RESET ROLE;

-- ============================================================
-- (C') secondary manager vê CX
-- ============================================================
SELECT _nr_auth('d0000000-0000-0000-0000-0000000000c3'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(_nr_sees('d0000000-0000-0000-0000-0000000c1100'::uuid), true,
  '(C'') secondary manager continua vendo CX via client_members');
RESET ROLE;

-- ============================================================
-- (A) CEO vê todos (CX, CY, CZ)
-- ============================================================
SELECT _nr_auth('d0000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id IN
    ('d0000000-0000-0000-0000-0000000c1100'::uuid,
     'd0000000-0000-0000-0000-0000000c2200'::uuid,
     'd0000000-0000-0000-0000-0000000c3300'::uuid)),
  3, '(A) CEO vê todos os 3 clientes (bypass admin intacto)');
RESET ROLE;

-- ============================================================
-- (B) gestor_projetos. ATENÇÃO — descoberta: is_admin() INCLUI gestor_projetos
-- (ceo/cto/gestor_projetos), então o GP é BYPASS TOTAL de visibilidade de
-- cliente. A clause `(has_role('gestor_projetos') AND group_id=...)` da policy
-- é, na prática, REDUNDANTE — o is_admin já abre tudo. Comportamento PRESERVADO
-- do original (o backup tinha exatamente os mesmos dois termos). O teste valida
-- a realidade: GP vê CY E CZ (via is_admin), não só o seu grupo.
-- [Ponto de sign-off HITL: o escopo-grupo do GP é ilusório hoje. Manter? Ver
--  matriz de não-regressão no reporte.]
-- ============================================================
SELECT _nr_auth('d0000000-0000-0000-0000-0000000000b1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(_nr_sees('d0000000-0000-0000-0000-0000000c2200'::uuid), true,
  '(B/A) gestor_projetos vê CY (via is_admin — bypass preservado)');
SELECT is(_nr_sees('d0000000-0000-0000-0000-0000000c3300'::uuid), true,
  '(B/A) gestor_projetos vê CZ também (is_admin inclui GP — comportamento preservado do original)');
RESET ROLE;

-- ============================================================
-- (D) page-grant sucesso_cliente (cliente-list) vê CY (sem assignment)
-- ============================================================
SELECT _nr_auth('d0000000-0000-0000-0000-0000000000d1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(_nr_sees('d0000000-0000-0000-0000-0000000c2200'::uuid), true,
  '(D) page-grant (cliente-list) continua vendo CY sem assignment');
RESET ROLE;

-- ============================================================
-- OUTSIDER — gestor_ads sem assignment, sem grant p/ esse cliente, fora do grupo.
-- NÃO vê CY (sem involvement). Os dois lados.
-- Obs: gestor_ads tem page-grant 'gestor-ads' por matrix -> veria via (D).
-- Por isso o outsider é testado contra CZ (grupo NULL) e validamos que NÃO é
-- envolvido. gestor-ads page-grant cobre clientes? can_access_page_data('gestor-ads')
-- é true p/ gestor_ads SEMPRE -> então (D) abriria. Esse é o ponto: page-grant
-- É visibilidade ampla por design. O outsider real de involvement é f0 NÃO ser
-- membro: provamos via e_envolvido direto.
-- ============================================================
SELECT is(
  cliente.e_envolvido('d0000000-0000-0000-0000-0000000c1100'::uuid,
                      'd0000000-0000-0000-0000-0000000000f0'::uuid),
  false,
  'OUTSIDER não é Envolvido em CX (e_envolvido=false — não-regressão do lado negativo)');

-- ============================================================
-- LADO NEGATIVO da involvement: ads_manager c1 NÃO é envolvido em CY/CZ
-- (não tem assignment lá) — prova que o colapso não super-abre.
-- ============================================================
SELECT is(
  cliente.e_envolvido('d0000000-0000-0000-0000-0000000c2200'::uuid,
                      'd0000000-0000-0000-0000-0000000000c1'::uuid),
  false,
  'ads_manager de CX NÃO é Envolvido em CY (involvement é per-cliente, não vaza)');

-- ============================================================
-- LADO NEGATIVO via POLICY — outsider LIMPO (role design, sem involvement, sem
-- grupo, sem page-grant a cliente, não-admin) NÃO vê nenhum cliente. Prova que
-- o colapso não regrediu o lado negativo nem super-abriu (200+vazio honesto).
-- ============================================================
SELECT _nr_auth('d0000000-0000-0000-0000-0000000000f9'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id IN
    ('d0000000-0000-0000-0000-0000000c1100'::uuid,
     'd0000000-0000-0000-0000-0000000c2200'::uuid,
     'd0000000-0000-0000-0000-0000000c3300'::uuid)),
  0,
  'OUTSIDER LIMPO (design, sem involvement/grupo/grant) NÃO vê nenhum cliente');
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
