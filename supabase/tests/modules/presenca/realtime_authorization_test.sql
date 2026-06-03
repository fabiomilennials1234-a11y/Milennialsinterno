-- supabase/tests/modules/presenca/realtime_authorization_test.sql
-- pgTAP — Slice 5 (#81) — Presença ao vivo: Realtime Authorization. ADR 0007.
--
-- Prova a peça de SEGURANÇA CRÍTICA: o canal `presenca:client:<id>` só é
-- acessível a quem pode ver o cliente. Como pgTAP não abre websocket, testamos
-- (a) a ESTRUTURA da policy (existe, no alvo certo, SELECT, sem literal de role)
-- e (b) o COMPORTAMENTO do predicado que a policy aplica — a expressão
-- cliente.pode_ver_cliente(<clientId do topic>, user), espelhando a matriz de
-- não-regressão do ADR 0005 (vê / não-vê), os DOIS lados:
--   - envolvido (C)         -> autorizado
--   - admin/ceo (A)         -> autorizado (bypass)
--   - page-grant (D)        -> autorizado
--   - estranho              -> BARRADO (não vaza cross-cliente)
--   - topic de OUTRO cliente -> estranho continua barrado lá também.
-- Também prova o round-trip do substring (formato do topic = contrato com o front).
--
-- Runner: scripts/sb-pgtap.sh supabase/tests/modules/presenca/realtime_authorization_test.sql
-- UUID prefix: 'b6' (presenca namespace; evita colisão com ca/de/a2/e0).

BEGIN;

SELECT plan(15);

-- Helper de impersonação (padrão demanda_rpc_test / card_universal_test).
CREATE OR REPLACE FUNCTION _pr_set(_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_user_id,'role','authenticated')::text, true);
END;$$;

-- =============================================================================
-- ESTRUTURA das policies (LER = SELECT, ENVIAR = INSERT). As DUAS são necessárias:
-- sem a INSERT, track() é descartado silenciosamente (ninguém aparece).
-- =============================================================================
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policy WHERE polname='presenca_canal_ler'
            AND polrelid='realtime.messages'::regclass),
  'policy presenca_canal_ler (SELECT) existe em realtime.messages');

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policy WHERE polname='presenca_canal_enviar'
            AND polrelid='realtime.messages'::regclass),
  'policy presenca_canal_enviar (INSERT) existe — sem ela track() é descartado');

SELECT is(
  (SELECT polcmd FROM pg_policy WHERE polname='presenca_canal_ler'
     AND polrelid='realtime.messages'::regclass),
  'r', 'presenca_canal_ler é FOR SELECT (autoriza join/observação do canal private)');

SELECT is(
  (SELECT polcmd FROM pg_policy WHERE polname='presenca_canal_enviar'
     AND polrelid='realtime.messages'::regclass),
  'a', 'presenca_canal_enviar é FOR INSERT (autoriza track de presença)');

-- Ambas delegam a cliente.pode_ver_cliente (dono único de audiência) e filtram o prefixo.
SELECT ok(
  (SELECT bool_and(
            coalesce(pg_get_expr(polqual, polrelid),'') || coalesce(pg_get_expr(polwithcheck, polrelid),'')
            LIKE '%pode_ver_cliente%')
     FROM pg_policy
     WHERE polname IN ('presenca_canal_ler','presenca_canal_enviar')
       AND polrelid='realtime.messages'::regclass),
  'ambas as policies delegam a cliente.pode_ver_cliente (sem nova definição de visibilidade)');

SELECT ok(
  (SELECT bool_and(
            coalesce(pg_get_expr(polqual, polrelid),'') || coalesce(pg_get_expr(polwithcheck, polrelid),'')
            LIKE '%presenca:client:%')
     FROM pg_policy
     WHERE polname IN ('presenca_canal_ler','presenca_canal_enviar')
       AND polrelid='realtime.messages'::regclass),
  'ambas só atendem topics presenca:client:% (não interferem em outros usos)');

-- Sem literal de role nas policies (guard no_literal_role_in_policy permanece verde).
SELECT ok(
  (SELECT bool_and(
            coalesce(pg_get_expr(polqual, polrelid),'') || coalesce(pg_get_expr(polwithcheck, polrelid),'')
            NOT LIKE '%user_role%')
     FROM pg_policy
     WHERE polname IN ('presenca_canal_ler','presenca_canal_enviar')
       AND polrelid='realtime.messages'::regclass),
  'nenhuma policy usa literal de role (delega a helpers via pode_ver_cliente)');

-- Round-trip do formato do topic (contrato com o front: clientIdDoTopico).
SELECT is(
  substring('presenca:client:b6000000-0000-0000-0000-0000000c1100' FROM '^presenca:client:(.+)$'),
  'b6000000-0000-0000-0000-0000000c1100',
  'substring extrai o clientId do topic (espelha clientIdDoTopico no front)');

-- =============================================================================
-- SEED — admin(ceo), envolvido, page-grant holder, estranho; 2 clientes.
-- =============================================================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, created_at, updated_at, confirmation_token)
SELECT u,'00000000-0000-0000-0000-000000000000'::uuid,u::text||'@pr.test',crypt('t',gen_salt('bf')),'authenticated','authenticated',now(),now(),''
FROM (VALUES
  ('b6000000-0000-0000-0000-0000000000a1'::uuid),  -- admin (ceo)
  ('b6000000-0000-0000-0000-0000000000e1'::uuid),  -- envolvido em client 1
  ('b6000000-0000-0000-0000-0000000000d1'::uuid),  -- page-grant holder (cliente-list)
  ('b6000000-0000-0000-0000-0000000000b0'::uuid)   -- estranho
) AS t(u)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id,name,email) VALUES
 ('b6000000-0000-0000-0000-0000000000a1'::uuid,'PR Admin','a1@pr.test'),
 ('b6000000-0000-0000-0000-0000000000e1'::uuid,'PR Envolvido','e1@pr.test'),
 ('b6000000-0000-0000-0000-0000000000d1'::uuid,'PR PageGrant','d1@pr.test'),
 ('b6000000-0000-0000-0000-0000000000b0'::uuid,'PR Estranho','b0@pr.test')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id,role) VALUES
 ('b6000000-0000-0000-0000-0000000000a1'::uuid,'ceo')
ON CONFLICT (user_id,role) DO NOTHING;

INSERT INTO public.clients (id,name) VALUES
 ('b6000000-0000-0000-0000-0000000c1100'::uuid,'PR Client 1'),
 ('b6000000-0000-0000-0000-0000000c2200'::uuid,'PR Client 2')
ON CONFLICT (id) DO NOTHING;

-- Envolvido em Client 1 (caminho C — involvement).
INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
VALUES ('b6000000-0000-0000-0000-0000000c1100'::uuid,
        'b6000000-0000-0000-0000-0000000000e1'::uuid, 'ads_manager')
ON CONFLICT DO NOTHING;

-- Page-grant 'cliente-list' (caminho D) para o holder. Coluna é page_slug;
-- source='direct' satisfaz has_page_access (cliente-list é não-sensível).
INSERT INTO public.user_page_grants (user_id, page_slug, source, granted_by)
VALUES ('b6000000-0000-0000-0000-0000000000d1'::uuid, 'cliente-list', 'direct',
        'b6000000-0000-0000-0000-0000000000a1'::uuid)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- COMPORTAMENTO — a expressão de autorização do canal, por persona.
-- A policy aplica cliente.pode_ver_cliente(<clientId do topic>, auth.uid()).
-- Avaliamos exatamente esse predicado para cada persona contra o topic do
-- Client 1, impersonando como o servidor Realtime faria.
-- =============================================================================

-- Envolvido (C) -> autorizado a entrar no canal do Client 1.
SELECT _pr_set('b6000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT ok(
  cliente.pode_ver_cliente(
    substring('presenca:client:b6000000-0000-0000-0000-0000000c1100' FROM '^presenca:client:(.+)$')::uuid,
    auth.uid()),
  'ENVOLVIDO entra no canal do seu cliente (autorizado)');
RESET ROLE;

-- Admin/ceo (A) -> autorizado (bypass).
SELECT _pr_set('b6000000-0000-0000-0000-0000000000a1'::uuid);
SET LOCAL ROLE authenticated;
SELECT ok(
  cliente.pode_ver_cliente('b6000000-0000-0000-0000-0000000c1100'::uuid, auth.uid()),
  'ADMIN/CEO entra no canal (bypass A) — não regredido para e_envolvido estrito');
RESET ROLE;

-- Page-grant (D) -> autorizado.
SELECT _pr_set('b6000000-0000-0000-0000-0000000000d1'::uuid);
SET LOCAL ROLE authenticated;
SELECT ok(
  cliente.pode_ver_cliente('b6000000-0000-0000-0000-0000000c1100'::uuid, auth.uid()),
  'PAGE-GRANT (cliente-list, D) entra no canal — não regredido');
RESET ROLE;

-- Estranho -> BARRADO no Client 1 (não vaza presença cross-cliente).
SELECT _pr_set('b6000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT ok(
  NOT cliente.pode_ver_cliente('b6000000-0000-0000-0000-0000000c1100'::uuid, auth.uid()),
  'ESTRANHO é BARRADO no canal do Client 1 (sem vazamento cross-cliente)');
RESET ROLE;

-- Envolvido do Client 1 NÃO entra no canal do Client 2 (escopo por cliente).
SELECT _pr_set('b6000000-0000-0000-0000-0000000000e1'::uuid);
SET LOCAL ROLE authenticated;
SELECT ok(
  NOT cliente.pode_ver_cliente('b6000000-0000-0000-0000-0000000c2200'::uuid, auth.uid()),
  'envolvido do Client 1 é barrado no canal do Client 2 (isolamento por cliente)');
RESET ROLE;

-- Estranho também barrado no Client 2 (controle).
SELECT _pr_set('b6000000-0000-0000-0000-0000000000b0'::uuid);
SET LOCAL ROLE authenticated;
SELECT ok(
  NOT cliente.pode_ver_cliente('b6000000-0000-0000-0000-0000000c2200'::uuid, auth.uid()),
  'estranho barrado no Client 2 também (controle)');
RESET ROLE;

-- RLS de realtime.messages está LIGADA (pré-condição do private channel gating).
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid='realtime.messages'::regclass),
  'realtime.messages tem RLS ligada (pré-condição do gating de canal private)');

SELECT * FROM finish();
ROLLBACK;
