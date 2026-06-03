-- supabase/tests/modules/cliente/pode_ver_gp_group_scoped_test.sql
-- pgTAP — #87 — GP vê SÓ os clientes do PRÓPRIO grupo (decisão do fundador).
-- Prova a MATRIZ de visibilidade do predicado cliente.pode_ver_cliente após a
-- mudança (A)=is_executive + (B) GP-grupo efetivo + (D) GP exige grant direto.
--
-- Prova os DOIS lados e que SÓ o GP mudou:
--   GP vê cliente do SEU grupo / NÃO vê de outro grupo / NÃO vê NULL-group.
--   GP fora do grupo mas ENVOLVIDO (C) continua vendo (involvement não regrediu).
--   GP com GRANT DIRETO (D) vê (preserva grant explícito; neutraliza só o admin-bypass).
--   CEO/CTO continuam vendo TUDO (bypass executivo intacto).
--   Não-GP com page-grant (D) continua vendo (role-fallback intacto).
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/cliente/pode_ver_gp_group_scoped_test.sql
-- UUID prefix: '87000000' (namespace #87).

BEGIN;

SELECT plan(14);

-- ============================================================
-- Estrutura: (A) agora é is_executive; predicado não usa mais o bypass is_admin direto.
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='cliente' AND p.proname='pode_ver_cliente'
      AND pg_get_functiondef(p.oid) LIKE '%is_executive(p_user_id)%'),
  1,
  '(A) bypass total do predicado é is_executive (ceo/cto), não is_admin (#87)');

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname='public' AND tablename='clients'
      AND policyname='clients_select_visao_total' AND qual LIKE '%pode_ver_cliente%'),
  1,
  'RLS SELECT de public.clients delega ao predicado único (#87)');

-- ============================================================
-- Seed: 2 grupos. GP no grupo G1. CEO. CTO. design (não-GP). sucesso_cliente (page-grant D).
--   Clientes: CG1 (G1, do grupo do GP), CG2 (G2, outro grupo), CNULL (group NULL),
--             CINV (G2, mas o GP é ENVOLVIDO — assigned_ads_manager).
-- ============================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@s87.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
 ('87000000-0000-0000-0000-0000000000b1'::uuid),  -- GP grupo G1
 ('87000000-0000-0000-0000-0000000000b2'::uuid),  -- GP com grant DIRETO (D)
 ('87000000-0000-0000-0000-0000000000e1'::uuid),  -- ceo
 ('87000000-0000-0000-0000-0000000000e2'::uuid),  -- cto
 ('87000000-0000-0000-0000-0000000000d1'::uuid),  -- sucesso_cliente (page-grant D, não-GP)
 ('87000000-0000-0000-0000-0000000000f9'::uuid)   -- design (outsider limpo)
) AS t(u) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_groups (id,name,slug) VALUES
 ('87000000-0000-0000-0000-00000000a100'::uuid,'S87 G1','s87-g1'),
 ('87000000-0000-0000-0000-00000000a200'::uuid,'S87 G2','s87-g2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email,group_id) VALUES
 ('87000000-0000-0000-0000-0000000000b1'::uuid,'S87 GP1','b1@s87.test','87000000-0000-0000-0000-00000000a100'::uuid),
 ('87000000-0000-0000-0000-0000000000b2'::uuid,'S87 GP2','b2@s87.test','87000000-0000-0000-0000-00000000a100'::uuid),
 ('87000000-0000-0000-0000-0000000000e1'::uuid,'S87 CEO','e1@s87.test',NULL),
 ('87000000-0000-0000-0000-0000000000e2'::uuid,'S87 CTO','e2@s87.test',NULL),
 ('87000000-0000-0000-0000-0000000000d1'::uuid,'S87 SC','d1@s87.test',NULL),
 ('87000000-0000-0000-0000-0000000000f9'::uuid,'S87 Out','f9@s87.test',NULL)
ON CONFLICT (user_id) DO UPDATE SET group_id=EXCLUDED.group_id;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('87000000-0000-0000-0000-0000000000b1'::uuid,'gestor_projetos'),
 ('87000000-0000-0000-0000-0000000000b2'::uuid,'gestor_projetos'),
 ('87000000-0000-0000-0000-0000000000e1'::uuid,'ceo'),
 ('87000000-0000-0000-0000-0000000000e2'::uuid,'cto'),
 ('87000000-0000-0000-0000-0000000000d1'::uuid,'sucesso_cliente'),
 ('87000000-0000-0000-0000-0000000000f9'::uuid,'design')
ON CONFLICT (user_id,role) DO NOTHING;

-- grant DIRETO a cliente-list para o GP2 (caminho D legítimo, não admin-bypass).
INSERT INTO public.user_page_grants (user_id, page_slug, source, granted_by)
VALUES ('87000000-0000-0000-0000-0000000000b2'::uuid,'cliente-list','direct',
        '87000000-0000-0000-0000-0000000000e1'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.clients (id,name,group_id,assigned_ads_manager,created_by) VALUES
 ('87000000-0000-0000-0000-0000000c1100'::uuid,'S87 CG1','87000000-0000-0000-0000-00000000a100'::uuid,NULL,NULL),
 ('87000000-0000-0000-0000-0000000c2200'::uuid,'S87 CG2','87000000-0000-0000-0000-00000000a200'::uuid,NULL,NULL),
 ('87000000-0000-0000-0000-0000000c0000'::uuid,'S87 CNULL',NULL,NULL,NULL),
 ('87000000-0000-0000-0000-0000000c9999'::uuid,'S87 CINV','87000000-0000-0000-0000-00000000a200'::uuid,
   '87000000-0000-0000-0000-0000000000b1'::uuid, NULL)  -- GP1 é ads_manager (envolvido) de CINV (grupo G2)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- (B) GP1 VÊ cliente do SEU grupo (CG1 em G1).
-- ============================================================
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c1100'::uuid,'87000000-0000-0000-0000-0000000000b1'::uuid),
  true, '(B) GP vê CG1 (mesmo grupo G1)');

-- (B-) GP1 NÃO vê cliente de OUTRO grupo (CG2 em G2), sem involvement nem grant.
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c2200'::uuid,'87000000-0000-0000-0000-0000000000b1'::uuid),
  false, '(B-) GP NÃO vê CG2 (outro grupo G2) — restrição #87');

-- (B-) GP1 NÃO vê cliente NULL-group.
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c0000'::uuid,'87000000-0000-0000-0000-0000000000b1'::uuid),
  false, '(B-) GP NÃO vê CNULL (group NULL — fail-closed #87)');

-- (C) GP1 fora do grupo mas ENVOLVIDO em CINV (G2) → VÊ (involvement não regrediu).
-- (depende do trigger espelho assigned_ads_manager -> client_members; o INSERT acima dispara)
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c9999'::uuid,'87000000-0000-0000-0000-0000000000b1'::uuid),
  true, '(C) GP envolvido (ads_manager) vê CINV mesmo fora do seu grupo (involvement intacto)');

-- (D) GP2 com GRANT DIRETO cliente-list → VÊ qualquer cliente (CG2, outro grupo).
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c2200'::uuid,'87000000-0000-0000-0000-0000000000b2'::uuid),
  true, '(D) GP com grant DIRETO cliente-list vê CG2 (grant explícito preservado)');

-- ============================================================
-- (A) CEO e CTO veem TUDO (bypass executivo intacto) — incl. CNULL e CG2.
-- ============================================================
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c2200'::uuid,'87000000-0000-0000-0000-0000000000e1'::uuid),
  true, '(A) CEO vê CG2 (bypass executivo intacto)');
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c0000'::uuid,'87000000-0000-0000-0000-0000000000e1'::uuid),
  true, '(A) CEO vê CNULL (bypass executivo intacto)');
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c2200'::uuid,'87000000-0000-0000-0000-0000000000e2'::uuid),
  true, '(A) CTO vê CG2 (is_executive cobre cto)');

-- ============================================================
-- (D não-GP) sucesso_cliente (page-grant cliente-list por role-fallback) VÊ CG2.
-- Prova que (D) p/ não-GP permanece como hoje (não regrediu).
-- ============================================================
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c2200'::uuid,'87000000-0000-0000-0000-0000000000d1'::uuid),
  true, '(D) sucesso_cliente (não-GP) vê CG2 via page-grant — intacto');

-- ============================================================
-- (-) OUTSIDER limpo (design) NÃO vê nada.
-- ============================================================
SELECT is(cliente.pode_ver_cliente(
  '87000000-0000-0000-0000-0000000c1100'::uuid,'87000000-0000-0000-0000-0000000000f9'::uuid),
  false, '(-) outsider design NÃO vê CG1');

-- ============================================================
-- Via RLS da tabela-base: GP1 (role authenticated) vê SÓ CG1 e CINV (2), não CG2/CNULL.
-- ============================================================
CREATE OR REPLACE FUNCTION _s87_auth(_u uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',_u::text,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_u,'role','authenticated')::text, true);
END;$$;

SELECT _s87_auth('87000000-0000-0000-0000-0000000000b1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id IN (
    '87000000-0000-0000-0000-0000000c1100'::uuid,'87000000-0000-0000-0000-0000000c2200'::uuid,
    '87000000-0000-0000-0000-0000000c0000'::uuid,'87000000-0000-0000-0000-0000000c9999'::uuid)),
  2,
  'RLS base: GP1 vê SÓ CG1 (grupo) + CINV (envolvido) = 2, não CG2/CNULL (#87)');
RESET ROLE;

-- CEO via RLS vê os 4.
SELECT _s87_auth('87000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT count(*)::int FROM public.clients WHERE id IN (
    '87000000-0000-0000-0000-0000000c1100'::uuid,'87000000-0000-0000-0000-0000000c2200'::uuid,
    '87000000-0000-0000-0000-0000000c0000'::uuid,'87000000-0000-0000-0000-0000000c9999'::uuid)),
  4,
  'RLS base: CEO vê os 4 (bypass executivo intacto)');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
